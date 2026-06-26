'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, FileText, LayoutGrid, Award, Clock, Terminal, Search } from 'lucide-react';
import Timeline from '@/components/Timeline';
import ClusterDetail from '@/components/ClusterDetail';
import TrendingTopics from '@/components/TrendingTopics';
import RefreshButton from '@/components/RefreshButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getTimeline, getClusterById, TimelineData } from '@/lib/api';

interface ActivityEvent {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function Home() {
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // KPI states
  const [topSource, setTopSource] = useState('BBC');
  const [topSourceCount, setTopSourceCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');

  // Activity log states
  const [activities, setActivities] = useState<ActivityEvent[]>([
    {
      timestamp: new Date().toLocaleTimeString(),
      message: 'System initialization completed. Dashboard online.',
      type: 'info',
    },
  ]);

  const timelineDataRef = useRef<TimelineData[]>([]);
  useEffect(() => {
    timelineDataRef.current = timelineData;
  }, [timelineData]);

  /**
   * background=true → preserve existing data on screen until fetch completes (used by Refresh).
   * background=false → show skeleton on initial mount only.
   */
  const loadDashboardData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await getTimeline();
      setTimelineData(data);
      setLastSyncTime(new Date().toLocaleTimeString());

      // Compare timeline changes if background update (refresh)
      const prevData = timelineDataRef.current;
      if (background && prevData.length > 0) {
        const oldMap = new Map(prevData.map((t) => [t.id, t.articleCount]));
        let newArticles = 0;
        let newClusters = 0;
        let updatedClusters = 0;

        data.forEach((item) => {
          const oldCount = oldMap.get(item.id);
          if (oldCount === undefined) {
            newClusters++;
            newArticles += item.articleCount;
          } else if (item.articleCount > oldCount) {
            updatedClusters++;
            newArticles += (item.articleCount - oldCount);
          }
        });

        let msg = '';
        if (newArticles > 0 || newClusters > 0 || updatedClusters > 0) {
          msg = `Ingestion success: Fetched ${newArticles} articles. Created ${newClusters} new topics, updated ${updatedClusters} existing topics.`;
        } else {
          msg = 'Ingestion success: All feeds up-to-date. No new articles found.';
        }

        setActivities((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            message: msg,
            type: newArticles > 0 ? 'success' : 'info',
          },
          ...prev,
        ]);
      }

      // Calculate Top Source dynamically from the largest cluster
      if (data.length > 0) {
        const sortedByCount = [...data].sort((a, b) => b.articleCount - a.articleCount);
        const largest = sortedByCount[0];
        try {
          const detailRes = await getClusterById(largest.id, 1, 40);
          const sourceMap: Record<string, number> = {};
          detailRes.articles.forEach((art) => {
            sourceMap[art.source] = (sourceMap[art.source] || 0) + 1;
          });
          let maxSrc = 'BBC';
          let maxCount = 0;
          Object.entries(sourceMap).forEach(([src, count]) => {
            if (count > maxCount) {
              maxCount = count;
              maxSrc = src;
            }
          });
          setTopSource(maxSrc);
          setTopSourceCount(maxCount);
        } catch {
          // ignore fallback
        }
      }

    } catch {
      setError('Unable to reach the backend API. Make sure the server is running on port 4000.');
      setActivities((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          message: 'Connection failed: Unable to poll timeline statistics.',
          type: 'error',
        },
        ...prev,
      ]);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchTimeline = async () => {
      if (isMounted) {
        await loadDashboardData(false);
      }
    };
    fetchTimeline();
    return () => {
      isMounted = false;
    };
  }, [loadDashboardData]);

  const handleSelectCluster = (id: number) => {
    setSelectedClusterId(id);
    setSelectedSources([]);
  };

  // Compute stats metrics
  const totalTopics = timelineData.length;
  const totalArticles = timelineData.reduce((acc, t) => acc + t.articleCount, 0);

  return (
    <main className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Activity size={18} className="text-primary" />
              <span className="font-semibold text-sm tracking-tight hidden sm:inline">News Pulse</span>
              <span className="text-xs text-muted-foreground hidden md:inline">|</span>
              <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider hidden md:inline">
                AI News Intelligence Dashboard
              </span>
            </div>

            {/* Topic Search Input */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search news topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-secondary/50 border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <RefreshButton onComplete={() => loadDashboardData(true)} />
          </div>
        </header>

        {/* Dashboard workspace content */}
        <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle size={15} />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* KPI Dashboard Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/40 border-border">
              <CardHeader className="p-4 pb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutGrid size={11} /> Total Topics
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold tracking-tight">{totalTopics}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Clustered event categories</p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader className="p-4 pb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={11} /> Total Articles
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold tracking-tight">{totalArticles}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ingested from RSS channels</p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader className="p-4 pb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={11} /> Top Source
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold tracking-tight truncate">
                  {topSource}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {topSourceCount > 0 ? `${topSourceCount} articles in top topic` : 'Scraped feed volume'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader className="p-4 pb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={11} /> Last Ingested
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold tracking-tight">{lastSyncTime}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Scraper sync status time</p>
              </CardContent>
            </Card>
          </div>

          {/* Chronological Staggered Timeline Section */}
          <Timeline
            data={timelineData}
            onSelectCluster={handleSelectCluster}
            selectedClusterId={selectedClusterId}
            searchQuery={searchQuery}
            loading={loading}
          />

          {/* Lower Grid (Trending Topics + Detail Panel) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendingTopics
              data={timelineData}
              onSelectCluster={handleSelectCluster}
              selectedClusterId={selectedClusterId}
              searchQuery={searchQuery}
            />

            <ClusterDetail
              key={selectedClusterId ?? 'empty'}
              clusterId={selectedClusterId}
              selectedSources={selectedSources}
              onChangeSources={setSelectedSources}
            />
          </div>
        </div>
      </div>

      {/* Terminal-style Activity Log Footer */}
      <footer className="border-t border-border bg-secondary/15 py-4 px-6 shrink-0 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <Terminal size={12} className="text-primary" />
            Recent Scraper & Clustering Activity
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] mt-1 bg-black/45 p-3 rounded border border-border">
            {activities.map((act, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground select-none">[{act.timestamp}]</span>
                <span className={act.type === 'success' ? 'text-green-400' : act.type === 'error' ? 'text-red-400' : 'text-zinc-300'}>
                  {act.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
