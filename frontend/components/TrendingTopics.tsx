'use client';

import React from 'react';
import { TrendingUp, Calendar, Newspaper, Clock, Search, WifiOff, X } from 'lucide-react';
import { TimelineData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface TrendingTopicsProps {
  data: TimelineData[];
  onSelectCluster: (id: number) => void;
  selectedClusterId: number | null;
  searchQuery: string;
  loading?: boolean;
  error?: string | null;
  onClearSearch?: () => void;
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (startStr === endStr) {
    return startStr;
  }
  return `${startStr} - ${endStr}`;
}

function calculateDuration(startIso: string, endIso: string): string {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'less than an hour';
  if (diffHours < 24) return `${diffHours}h active`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d active`;
}

/** Skeleton row that precisely matches the real topic-row layout */
function TopicRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="w-full p-4 rounded-xl border border-[#27272A]/60 bg-[#18181B] flex items-start justify-between gap-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="space-y-2 flex-1 min-w-0">
        {/* Rank + title row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-5 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        {/* Date + duration row */}
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      {/* Article count badge */}
      <Skeleton className="h-6 w-20 rounded-md shrink-0" />
    </div>
  );
}

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({
  data,
  onSelectCluster,
  selectedClusterId,
  searchQuery,
  loading = false,
  error = null,
  onClearSearch,
}) => {
  // Sort clusters by articleCount descending to find trending
  const sortedData = [...data].sort((a, b) => b.articleCount - a.articleCount);

  // Filter based on search query
  const filteredData = sortedData.filter((topic) =>
    topic.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Card className="flex flex-col h-[540px] border-[#27272A] bg-[#18181B] rounded-xl shadow-lg">
      <CardHeader className="p-5 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-[#4F46E5]" />
          <CardTitle className="text-base font-bold tracking-tight text-[#FAFAFA]">Trending News Topics</CardTitle>
        </div>
        <CardDescription className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Ranked by article volume and chronologically tracked
        </CardDescription>
      </CardHeader>
      <ScrollArea className="flex-1 min-h-0 border-t border-[#27272A]">
        <CardContent className="p-5 space-y-3.5 h-full">
          {loading ? (
            /* Shimmer skeleton rows matching the real layout */
            <>
              {[0, 80, 160, 240, 320].map((delay, i) => (
                <TopicRowSkeleton key={i} delay={delay} />
              ))}
            </>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center text-[#EF4444]">
                <WifiOff size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#FAFAFA]">Topics Offline</h4>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  Could not retrieve trending list. Backend server is offline.
                </p>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-[#4F46E5]/10 border border-[#4F46E5]/20 flex items-center justify-center text-[#4F46E5]">
                <Newspaper size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#FAFAFA]">No active news topics</h4>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  No news database entries found.
                </p>
              </div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center gap-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center text-zinc-400">
                <Search size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#FAFAFA]">No matching trending topics</h4>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  No topics match search keyword <span className="text-[#FAFAFA] font-mono bg-zinc-800 px-1 py-0.5 rounded text-xs">&quot;{searchQuery}&quot;</span>.
                </p>
              </div>
              {onClearSearch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearSearch}
                  className="h-8 px-4 text-xs font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <X size={13} />
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="animate-fade-in space-y-3.5">
              {filteredData.map((topic, index) => {
                const isSelected = selectedClusterId === topic.id;
                return (
                  <button
                    key={topic.id}
                    onClick={() => onSelectCluster(topic.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#4F46E5]/10 border-[#4F46E5] text-[#FAFAFA] shadow-md shadow-[#4F46E5]/5'
                        : 'bg-transparent border-transparent hover:border-[#27272A] hover:bg-[#27272A]/10 text-muted-foreground hover:text-[#FAFAFA]'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm md:text-base font-extrabold ${isSelected ? 'text-[#818CF8]' : 'text-[#4F46E5]'}`}>
                          #{index + 1}
                        </span>
                        <h4 className="text-sm md:text-base font-bold truncate text-[#FAFAFA]">
                          {topic.label}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3.5 text-[13px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} className="text-[#4F46E5]/70 shrink-0" />
                          {formatDateRange(topic.startTime, topic.endTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} className="text-[#4F46E5]/70 shrink-0" />
                          {calculateDuration(topic.startTime, topic.endTime)}
                        </span>
                      </div>
                    </div>

                    <Badge
                      className={`text-xs font-bold px-2.5 py-1 shrink-0 rounded-md tracking-wider uppercase ${
                        isSelected
                          ? 'bg-[#4F46E5] text-[#FAFAFA] hover:bg-[#4F46E5]'
                          : 'bg-[#27272A] text-zinc-300 border border-[#27272A]/50 hover:bg-[#27272A]'
                      }`}
                    >
                      {topic.articleCount} articles
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default TrendingTopics;
