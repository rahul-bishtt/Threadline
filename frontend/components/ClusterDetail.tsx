'use client';

import React, { useRef, useEffect } from 'react';
import { ExternalLink, Clock, Sparkles, ChevronLeft, ChevronRight, Filter, BookOpen, Calendar, BarChart2, AlertCircle, RotateCw, X } from 'lucide-react';
import { ClusterDetail as ClusterDetailType, Article } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_LIMIT = 20;

interface ClusterDetailProps {
  clusterId: number | null;
  detail: ClusterDetailType | null;
  loading: boolean;
  error: string | null;
  selectedSources: string[];
  onChangeSources: (sources: string[]) => void;
  availableSources: string[];
  onRetry?: () => void;
}

function ArticleCardSkeleton() {
  return (
    <div className="space-y-3.5 p-5 rounded-xl border border-[#27272A] bg-[#18181B]">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-14 rounded bg-zinc-800" />
        <Skeleton className="h-3 w-24 rounded bg-zinc-800" />
      </div>
      <Skeleton className="h-5 w-full rounded bg-zinc-800" />
      <Skeleton className="h-3.5 w-full rounded bg-zinc-800" />
      <Skeleton className="h-3.5 w-4/5 rounded bg-zinc-800" />
    </div>
  );
}

export const ClusterDetail: React.FC<ClusterDetailProps> = ({
  clusterId,
  detail,
  loading,
  error,
  selectedSources,
  onChangeSources,
  availableSources,
  onRetry,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to Topic Detail card on selection
  useEffect(() => {
    if (clusterId && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [clusterId]);

  const toggleSource = (src: string) => {
    if (selectedSources.includes(src)) {
      onChangeSources(selectedSources.filter((s) => s !== src));
    } else {
      onChangeSources([...selectedSources, src]);
    }
  };

  // Compute Source Distribution
  const sourceDistribution = React.useMemo(() => {
    if (!detail || !detail.articles) return {};
    const dist: Record<string, number> = {};
    detail.articles.forEach((a) => {
      dist[a.source] = (dist[a.source] || 0) + 1;
    });
    return dist;
  }, [detail]);

  // Generate Synthetic Topic Description
  const topicDescription = React.useMemo(() => {
    if (!detail) return '';
    const dateStr = new Date(detail.startTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const sourcesStr = availableSources.slice(0, 3).join(', ') + (availableSources.length > 3 ? ', and others' : '');
    return `This news cluster emerged on ${dateStr}, compiling ${detail.articleCount} reports tracked across ${sourcesStr}. The cluster represents a focused narrative thread from multiple publishers.`;
  }, [detail, availableSources]);

  // No Selection Empty State (matches h-[540px] of Trending Topics)
  if (!clusterId) {
    return (
      <Card className="h-[540px] flex flex-col justify-center items-center border-dashed border border-[#27272A] p-10 bg-[#18181B]/20 rounded-xl animate-fade-in">
        <div className="flex flex-col items-center max-w-[340px] text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#4F46E5]/10 border border-[#4F46E5]/20 flex items-center justify-center text-[#4F46E5]">
            <Sparkles size={22} />
          </div>
          <h3 className="text-base font-bold tracking-tight text-[#FAFAFA]">Select a News Topic</h3>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            Click on a timeline track above or select a ranked topic from the trending panel to generate real-time AI cluster synthesis, view publisher breakdowns, and inspect individual reports.
          </p>
        </div>
      </Card>
    );
  }

  // Loading skeleton state (matches h-[540px])
  if (loading && !detail) {
    return (
      <Card className="h-[540px] flex flex-col border-[#27272A] p-7 bg-[#18181B] rounded-xl justify-between">
        <div className="space-y-4">
          <Skeleton className="h-5 w-24 rounded bg-zinc-800" />
          <Skeleton className="h-7 w-3/4 rounded bg-zinc-800" />
          <Skeleton className="h-4.5 w-1/2 rounded bg-zinc-800" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full rounded bg-zinc-800" />
          <Skeleton className="h-4 w-full rounded bg-zinc-800" />
          <Skeleton className="h-4.5 w-4/5 rounded bg-zinc-800" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/4 rounded bg-zinc-800" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-12 rounded bg-zinc-800" />
            <Skeleton className="h-6 w-12 rounded bg-zinc-800" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[540px] flex flex-col justify-center items-center border-[#27272A] bg-[#18181B] rounded-xl p-10 animate-fade-in">
        <div className="flex flex-col items-center max-w-[340px] text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center text-[#EF4444]">
            <AlertCircle size={22} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#FAFAFA]">Failed to load details</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {error}
            </p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-8 px-4 text-xs font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw size={13} />
              Retry Load
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (!detail) return null;

  // Calculate Duration
  const startTime = new Date(detail.startTime).getTime();
  const endTime = new Date(detail.endTime).getTime();
  const diffHours = Math.round((endTime - startTime) / (1000 * 60 * 60));
  const durationStr = diffHours >= 24 
    ? `${Math.round(diffHours / 24)}d active` 
    : `${diffHours || 1}h active`;

  return (
    <Card ref={cardRef} className="flex flex-col h-[540px] border-[#27272A] bg-[#18181B] rounded-xl shadow-lg justify-between">
      <CardHeader className="p-7 pb-3 shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Badge className="bg-[#4F46E5]/10 text-[#4F46E5] hover:bg-[#4F46E5]/15 border border-[#4F46E5]/20 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full">
            Topic Focus
          </Badge>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
            <span className="text-xs text-muted-foreground font-bold">
              {detail.articleCount} articles total
            </span>
          </div>
        </div>
        
        <div>
          <CardTitle className="text-xl font-bold leading-snug text-[#FAFAFA] line-clamp-1" title={detail.label}>
            {detail.label}
          </CardTitle>
          
          {/* Clean Metadata Section */}
          <div className="flex items-center gap-5 text-[13px] text-muted-foreground mt-3 font-medium">
            <div className="flex items-center gap-1">
              <Calendar size={13} className="text-[#4F46E5]/70 shrink-0" />
              <span>
                {new Date(detail.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(detail.endTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={13} className="text-[#4F46E5]/70 shrink-0" />
              <span>{durationStr}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Main Analysis scroll area to avoid empty areas */}
      <CardContent className="flex-1 overflow-y-auto px-7 py-3 space-y-5">
        {/* AI Synthesis block */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#FAFAFA] tracking-wide uppercase">
            <Sparkles size={13} className="text-[#4F46E5]" />
            <span>AI Intelligence Synthesis</span>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            {topicDescription}
          </p>
        </div>

        {/* Source breakdown chart/filter widgets */}
        {availableSources.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#27272A]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#FAFAFA] tracking-wide uppercase">
              <BarChart2 size={13} className="text-[#4F46E5]" />
              <span>Publisher Distribution</span>
            </div>
            <div className="space-y-2.5">
              {availableSources.map((src) => {
                const count = sourceDistribution[src] || 0;
                const total = detail.articles?.length || 1;
                const percent = Math.round((count / total) * 100);
                const isActive = selectedSources.includes(src);

                return (
                  <div
                    key={src}
                    onClick={() => toggleSource(src)}
                    className={`group/bar flex flex-col gap-1 cursor-pointer p-1.5 -mx-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-[#4F46E5]/5' : 'hover:bg-[#27272A]/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={`text-xs ${isActive ? 'text-[#818CF8]' : 'text-zinc-300'} group-hover/bar:text-[#FAFAFA] transition-colors`}>
                        {src}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {count} {count === 1 ? 'article' : 'articles'} ({percent}%)
                      </span>
                    </div>
                    {/* Progress Bar container */}
                    <div className="h-1.5 w-full bg-[#27272A]/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isActive ? 'bg-[#818CF8]' : 'bg-[#4F46E5]'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer Pill Filters */}
      {availableSources.length > 0 && (
        <div className="px-7 py-4.5 border-t border-[#27272A] flex flex-wrap items-center gap-1.5 bg-[#18181B]/40 shrink-0">
          <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter size={12} className="text-[#4F46E5]" /> Filters:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangeSources([])}
            className={`h-5.5 px-2.5 text-[10px] font-semibold rounded-full border cursor-pointer transition-all duration-150 ${
              selectedSources.length === 0
                ? 'bg-[#4F46E5] text-[#FAFAFA] border-transparent hover:bg-[#4F46E5]/90'
                : 'bg-transparent text-muted-foreground border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA]'
            }`}
          >
            All
          </Button>
          {availableSources.map((src) => {
            const active = selectedSources.includes(src);
            return (
              <Button
                key={src}
                variant="outline"
                size="sm"
                onClick={() => toggleSource(src)}
                className={`h-5.5 px-2.5 text-[9px] font-semibold rounded-full border cursor-pointer transition-all duration-150 ${
                  active
                    ? 'bg-[#4F46E5] text-[#FAFAFA] border-transparent hover:bg-[#4F46E5]/90'
                    : 'bg-transparent text-muted-foreground border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA]'
                }`}
              >
                {src}
              </Button>
            );
          })}
        </div>
      )}
    </Card>
  );
};

interface ArticleListProps {
  clusterId: number | null;
  articles: Article[];
  filteredArticles: Article[];
  loading: boolean;
  error: string | null;
  page: number;
  onPageChange: (page: number) => void;
  onClearFilters?: () => void;
}

export const ArticleList: React.FC<ArticleListProps> = ({
  clusterId,
  articles,
  filteredArticles,
  loading,
  error,
  page,
  onPageChange,
  onClearFilters,
}) => {
  if (!clusterId) {
    return null; // Don't show article list if no cluster selected
  }

  if (loading && articles.length === 0) {
    return (
      <Card className="border-[#27272A] bg-[#18181B] rounded-xl shadow-lg">
        <CardHeader className="p-5 pb-3 flex flex-row items-center gap-2">
          <BookOpen size={20} className="text-[#4F46E5]" />
          <CardTitle className="text-sm font-bold tracking-tight text-[#FAFAFA]">Article List</CardTitle>
        </CardHeader>
        <div className="border-t border-[#27272A]" />
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[#27272A] p-10 flex flex-col items-center justify-center bg-[#18181B] rounded-xl gap-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center text-[#EF4444]">
          <AlertCircle size={22} />
        </div>
        <div className="space-y-1 text-center">
          <h3 className="text-base font-bold text-[#FAFAFA]">Failed to load articles</h3>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            {error}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col border-[#27272A] bg-[#18181B] rounded-xl shadow-lg animate-fade-in">
      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-[#4F46E5]" />
          <CardTitle className="text-base font-bold tracking-tight text-[#FAFAFA]">Article List</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground font-semibold">
          Showing {filteredArticles.length} articles on this page
        </span>
      </CardHeader>
      
      <div className="border-t border-[#27272A]" />

      {/* Articles List - Grid layout inside the Card */}
      <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center text-zinc-400">
              <Filter size={18} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm text-[#FAFAFA]">No articles match your filters</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                All articles under this topic are currently filtered out by the active publisher selection.
              </p>
            </div>
            {onClearFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="h-8 px-4 text-xs font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <X size={13} />
                Clear Publisher Filters
              </Button>
            )}
          </div>
        ) : (
          filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </CardContent>

      {/* Pagination Footer */}
      <div className="border-t border-[#27272A] px-5 py-3.5 flex items-center justify-between bg-[#18181B]/80 rounded-b-xl">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className="h-8 px-3 text-xs font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] cursor-pointer rounded-lg disabled:opacity-50"
        >
          <ChevronLeft size={16} className="mr-0.5" />
          Prev Page
        </Button>
        <span className="text-sm font-semibold text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={articles.length < PAGE_LIMIT || loading}
          className="h-8 px-3 text-xs font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] cursor-pointer rounded-lg disabled:opacity-50"
        >
          Next Page
          <ChevronRight size={16} className="ml-0.5" />
        </Button>
      </div>
    </Card>
  );
};

function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="group rounded-xl border border-[#27272A]/80 bg-[#18181B] p-5 hover:border-[#4F46E5]/40 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#4F46E5]/5 transition-all duration-200 flex flex-col justify-between hover:bg-[#27272A]/20">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-[#27272A] text-zinc-300 hover:bg-[#27272A] border border-[#27272A]/50 text-[10px] font-semibold px-2 py-0.5 tracking-wider uppercase rounded-md">
              {article.source}
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Clock size={13} className="text-[#4F46E5]/60 shrink-0" />
              {new Intl.DateTimeFormat('en', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(article.publishedAt))}
            </span>
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-[#27272A]/40 flex items-center justify-center text-muted-foreground hover:text-[#FAFAFA] hover:bg-[#4F46E5]/20 border border-[#27272A]/30 hover:border-[#4F46E5]/40 transition-all shrink-0"
            aria-label="Open article link"
          >
            <ExternalLink size={15} />
          </a>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-base font-bold text-[#FAFAFA] hover:text-[#4F46E5] transition-colors duration-150 leading-snug mb-3.5 line-clamp-2"
        >
          {article.title}
        </a>
        {article.summary && (
          <p className="text-[13px] text-zinc-400 leading-relaxed line-clamp-2">
            {article.summary}
          </p>
        )}
      </div>
    </div>
  );
}

export default ClusterDetail;
