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
  const [liveTime, setLiveTime] = useState<string>('--:--:--');

  const [newClustersCount, setNewClustersCount] = useState<number>(0);
  const [newArticlesCount, setNewArticlesCount] = useState<number>(0);
  const [secondsSinceSync, setSecondsSinceSync] = useState<number | null>(null);
  const [topicsToday, setTopicsToday] = useState<number>(0);
  const [articlesToday, setArticlesToday] = useState<number>(0);

  const lastSyncTimestampRef = useRef<number | null>(null);

  const updateSyncTimestamp = useCallback((time: number) => {
    lastSyncTimestampRef.current = time;
    setSecondsSinceSync(0);
  }, []);

  // Activity log states
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
      if (lastSyncTimestampRef.current) {
        const elapsed = Math.floor((now.getTime() - lastSyncTimestampRef.current) / 1000);
        setSecondsSinceSync(elapsed);
      }
    };
    const delay = setTimeout(updateTime, 0);
    const timer = setInterval(updateTime, 1000);

    // Initialize activities log asynchronously to avoid cascading renders
    const initDelay = setTimeout(() => {
      setActivities([
        {
          timestamp: new Date().toLocaleTimeString(),
          message: 'System initialization completed. Dashboard online.',
          type: 'info',
        },
      ]);
    }, 0);

    return () => {
      clearTimeout(delay);
      clearTimeout(initDelay);
      clearInterval(timer);
    };
  }, [setActivities]);

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
      updateSyncTimestamp(Date.now());

      const nowTime = Date.now();
      const oneDayAgo = nowTime - 24 * 60 * 60 * 1000;
      const todayTopics = data.filter((t) => new Date(t.startTime).getTime() >= oneDayAgo).length;
      const todayArticles = data
        .filter((t) => new Date(t.startTime).getTime() >= oneDayAgo)
        .reduce((acc, t) => acc + t.articleCount, 0);

      setTopicsToday(todayTopics);
      setArticlesToday(todayArticles);

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

        setNewClustersCount(newClusters);
        setNewArticlesCount(newArticles);

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
      } else if (!background) {
        setNewClustersCount(0);
        setNewArticlesCount(0);
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
  }, [
    setTimelineData,
    setActivities,
    setTopSource,
    setTopSourceCount,
    setError,
    setLoading,
    updateSyncTimestamp,
    setNewClustersCount,
    setNewArticlesCount,
    setTopicsToday,
    setArticlesToday,
  ]);

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

  // Derived state values are calculated safely within the data loading lifecycle to maintain component purity

  const topicsSubText =
    newClustersCount > 0 ? `+${newClustersCount} this sync` : `+${topicsToday} today`;

  const articlesSubText =
    newArticlesCount > 0 ? `+${newArticlesCount} this sync` : `+${articlesToday} today`;

  let lastUpdatedSubText = 'Live • Synced just now';
  if (secondsSinceSync !== null) {
    if (secondsSinceSync < 60) {
      lastUpdatedSubText = `Live • Synced ${secondsSinceSync}s ago`;
    } else {
      const mins = Math.floor(secondsSinceSync / 60);
      lastUpdatedSubText = `Live • Synced ${mins}m ago`;
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-[#27272A] bg-[#09090B]/95 backdrop-blur-sm min-h-[80px] flex items-center">
          <div className="max-w-[1650px] w-full mx-auto px-6 md:px-12 py-4 md:py-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8">
            <div className="space-y-1">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-lg shadow-[#4F46E5]/20 shrink-0">
                  <Activity size={27} className="animate-pulse text-[#FAFAFA]" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold tracking-tight text-[#FAFAFA] leading-tight">
                    News Pulse
                  </h1>
                  <p className="text-xs text-zinc-400 font-medium leading-tight mt-0.5">
                    AI News Intelligence Dashboard
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 md:gap-7 w-full md:w-auto">
              {/* Topic Search Input */}
              <div className="relative w-full md:w-[360px]">
                <Search className="absolute left-3.5 top-[14px] h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search topics, sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 text-xs md:text-sm bg-[#18181B] border border-[#27272A] rounded-xl text-[#FAFAFA] placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] transition-all"
                />
              </div>

              {/* Pulsing Live Status Indicator */}
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#22C55E]/5 border border-[#22C55E]/15 rounded-xl text-xs font-semibold text-[#22C55E] select-none shrink-0 h-11 justify-center">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse duration-[2000ms]" />
                <span>Live</span>
              </div>

              <RefreshButton onComplete={() => loadDashboardData(true)} />
            </div>
          </div>
        </header>

        {/* Dashboard workspace content */}
        <div className="max-w-[1650px] mx-auto px-6 md:px-12 py-10 space-y-10">
          {/* Error Banner */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle size={15} />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* KPI Dashboard Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Topics Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5] hover:shadow-lg hover:shadow-[#4F46E5]/10 transform transition-all duration-200 hover:-translate-y-[2px] cursor-pointer shadow-md min-h-[160px] flex items-center">
              <CardContent className="p-8 flex items-center justify-between w-full">
                <div className="space-y-2 min-w-0">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Topics
                  </span>
                  <div className="text-4xl font-bold tracking-tight text-white leading-none">
                    {totalTopics}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-1">
                    {topicsSubText}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#4F46E5] flex items-center justify-center text-white shadow-lg shadow-[#4F46E5]/20 shrink-0 ml-4">
                  <LayoutGrid size={28} />
                </div>
              </CardContent>
            </Card>

            {/* Total Articles Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5] hover:shadow-lg hover:shadow-[#4F46E5]/10 transform transition-all duration-200 hover:-translate-y-[2px] cursor-pointer shadow-md min-h-[160px] flex items-center">
              <CardContent className="p-8 flex items-center justify-between w-full">
                <div className="space-y-2 min-w-0">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Articles
                  </span>
                  <div className="text-4xl font-bold tracking-tight text-white leading-none">
                    {totalArticles}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-1">
                    {articlesSubText}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#4F46E5] flex items-center justify-center text-white shadow-lg shadow-[#4F46E5]/20 shrink-0 ml-4">
                  <FileText size={28} />
                </div>
              </CardContent>
            </Card>

            {/* Top Source Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5] hover:shadow-lg hover:shadow-[#4F46E5]/10 transform transition-all duration-200 hover:-translate-y-[2px] cursor-pointer shadow-md min-h-[160px] flex items-center">
              <CardContent className="p-8 flex items-center justify-between w-full">
                <div className="space-y-2 min-w-0 flex-1">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Top Source
                  </span>
                  <div className="text-4xl font-bold tracking-tight text-white leading-none truncate max-w-[180px]">
                    {topSource}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-1 truncate">
                    {topSourceCount > 0 ? `${topSourceCount} articles` : 'Scraped feed volume'}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#4F46E5] flex items-center justify-center text-white shadow-lg shadow-[#4F46E5]/20 shrink-0 ml-4">
                  <Award size={28} />
                </div>
              </CardContent>
            </Card>

            {/* Last Updated Card */}
            <Card className="bg-[#18181B] border-[#27272A] rounded-xl hover:border-[#4F46E5] hover:shadow-lg hover:shadow-[#4F46E5]/10 transform transition-all duration-200 hover:-translate-y-[2px] cursor-pointer shadow-md min-h-[160px] flex items-center">
              <CardContent className="p-8 flex items-center justify-between w-full">
                <div className="space-y-2 min-w-0">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Last Updated
                  </span>
                  <div className="text-4xl font-bold tracking-tight text-white leading-none">
                    {liveTime}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-1">
                    {lastUpdatedSubText}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#4F46E5] flex items-center justify-center text-white shadow-lg shadow-[#4F46E5]/20 shrink-0 ml-4">
                  <Clock size={28} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
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
      <footer className="border-t border-[#27272A] bg-[#09090B]/50 py-6 px-6 md:px-12 shrink-0 mt-10">
        <div className="max-w-[1650px] mx-auto flex flex-col gap-2">
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
