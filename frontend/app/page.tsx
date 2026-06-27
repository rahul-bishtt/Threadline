'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, FileText, LayoutGrid, Award, Clock, Terminal, Search } from 'lucide-react';
import Timeline from '@/components/Timeline';
import ClusterDetail, { ArticleList } from '@/components/ClusterDetail';
import TrendingTopics from '@/components/TrendingTopics';
import RefreshButton from '@/components/RefreshButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { getTimeline, getClusterById, TimelineData, ClusterDetail as ClusterDetailType, Article } from '@/lib/api';

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
  const [activities, setActivities] = useState<ActivityEvent[]>(() => [
    {
      timestamp: typeof window !== 'undefined' ? new Date().toLocaleTimeString() : '12:00:00 AM',
      message: 'System initialization completed. Dashboard online.',
      type: 'info',
    },
  ]);

  // Lifted cluster detail states
  const [clusterDetail, setClusterDetail] = useState<ClusterDetailType | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [clusterPage, setClusterPage] = useState(1);
  const [clusterArticles, setClusterArticles] = useState<Article[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);

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

  // Load cluster detail when ID or Page changes
  useEffect(() => {
    if (!selectedClusterId) return;

    let isMounted = true;
    const loadDetail = async () => {
      setClusterLoading(true);
      setClusterError(null);
      try {
        const data = await getClusterById(selectedClusterId, clusterPage, 20);
        if (isMounted) {
          setClusterDetail(data);
          setClusterArticles(data.articles);
          const sources = [...new Set(data.articles.map((a) => a.source))];
          setAvailableSources(sources);
        }
      } catch {
        if (isMounted) {
          setClusterError('Failed to load topic details.');
        }
      } finally {
        if (isMounted) {
          setClusterLoading(false);
        }
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedClusterId, clusterPage]);

  const handleSelectCluster = (id: number | null) => {
    setSelectedClusterId(id);
    setSelectedSources([]);
    setClusterPage(1);
    if (!id) {
      setClusterDetail(null);
      setClusterArticles([]);
      setAvailableSources([]);
    }
  };

  // Compute stats metrics
  const totalTopics = timelineData.length;
  const totalArticles = timelineData.reduce((acc, t) => acc + t.articleCount, 0);

  return (
    <main className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-[#27272A] bg-[#09090B]/95 backdrop-blur-sm">
          <div className="max-w-screen-xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#4F46E5] flex items-center justify-center text-white shadow-lg shadow-[#4F46E5]/20 shrink-0">
                  <Activity size={18} className="animate-pulse text-[#FAFAFA]" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-[#FAFAFA] flex items-center gap-2">
                    News Pulse
                  </h1>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground max-w-xl leading-relaxed">
                Track how news stories evolve by clustering related articles from multiple sources.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Topic Search Input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search news topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-[#18181B] border border-[#27272A] rounded-lg text-[#FAFAFA] placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] transition-all"
                />
              </div>

              <RefreshButton onComplete={() => loadDashboardData(true)} />
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Topics Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5]/50 transition-all duration-300 shadow-md">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Topics
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-[#FAFAFA]">{totalTopics}</div>
                  <p className="text-[10px] text-muted-foreground truncate">Clustered event categories</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center text-[#4F46E5] shrink-0 ml-3">
                  <LayoutGrid size={18} />
                </div>
              </CardContent>
            </Card>

            {/* Total Articles Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5]/50 transition-all duration-300 shadow-md">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Articles
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-[#FAFAFA]">{totalArticles}</div>
                  <p className="text-[10px] text-muted-foreground truncate">Ingested RSS content</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center text-[#4F46E5] shrink-0 ml-3">
                  <FileText size={18} />
                </div>
              </CardContent>
            </Card>

            {/* Top Source Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5]/50 transition-all duration-300 shadow-md">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Top Source
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-[#FAFAFA] truncate">{topSource}</div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {topSourceCount > 0 ? `${topSourceCount} articles in top topic` : 'Scraped feed volume'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center text-[#4F46E5] shrink-0 ml-3">
                  <Award size={18} />
                </div>
              </CardContent>
            </Card>

            {/* Last Updated Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#22C55E]/50 transition-all duration-300 shadow-md">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Last Updated
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-[#FAFAFA]">{lastSyncTime}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    <span className="text-[10px] text-[#22C55E] font-medium">System Active</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E] shrink-0 ml-3">
                  <Clock size={18} />
                </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <TrendingTopics
              data={timelineData}
              onSelectCluster={handleSelectCluster}
              selectedClusterId={selectedClusterId}
              searchQuery={searchQuery}
            />

            <ClusterDetail
              clusterId={selectedClusterId}
              detail={clusterDetail}
              loading={clusterLoading}
              error={clusterError}
              selectedSources={selectedSources}
              onChangeSources={setSelectedSources}
              availableSources={availableSources}
            />
          </div>

          {/* Article List Section (below two-column layout) */}
          <ArticleList
            clusterId={selectedClusterId}
            articles={clusterArticles}
            filteredArticles={
              selectedSources.length
                ? clusterArticles.filter((a) => selectedSources.includes(a.source))
                : clusterArticles
            }
            loading={clusterLoading}
            error={clusterError}
            page={clusterPage}
            onPageChange={setClusterPage}
          />
        </div>
      </div>

      {/* Terminal-style Activity Log Footer */}
      <footer className="border-t border-[#27272A] bg-[#09090B]/50 py-4 px-6 shrink-0 mt-6">
        <div className="max-w-screen-xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            <Terminal size={12} className="text-[#4F46E5]" />
            Recent Scraper & Clustering Activity
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1.5 font-mono text-[10px] mt-1 bg-black/40 p-3.5 rounded-lg border border-[#27272A]">
            {activities.map((act, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground select-none">[{act.timestamp}]</span>
                <span className={act.type === 'success' ? 'text-[#22C55E]' : act.type === 'error' ? 'text-red-400' : 'text-zinc-300'}>
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
