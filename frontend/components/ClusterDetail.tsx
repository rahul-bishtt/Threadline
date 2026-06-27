'use client';

import React from 'react';
import { ExternalLink, Clock, Sparkles, ChevronLeft, ChevronRight, Filter, BookOpen, Calendar } from 'lucide-react';
import { ClusterDetail as ClusterDetailType, Article } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
}

function ArticleCardSkeleton() {
  return (
    <div className="space-y-3 p-4 rounded-lg border border-[#27272A] bg-[#18181B]">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4.5 w-14 rounded bg-zinc-800" />
        <Skeleton className="h-3 w-24 rounded bg-zinc-800" />
      </div>
      <Skeleton className="h-4.5 w-full rounded bg-zinc-800" />
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
}) => {
  const toggleSource = (src: string) => {
    if (selectedSources.includes(src)) {
      onChangeSources(selectedSources.filter((s) => s !== src));
    } else {
      onChangeSources([...selectedSources, src]);
    }
  };

  // No Selection Empty State
  if (!clusterId) {
    return (
      <Card className="h-[220px] flex flex-col justify-center items-center border-dashed border border-[#27272A] p-6 bg-[#18181B]/30 rounded-xl">
        <div className="flex flex-col items-center max-w-[320px] text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center text-[#4F46E5]">
            <Sparkles size={18} />
          </div>
          <h3 className="text-xs font-semibold tracking-tight text-[#FAFAFA]">Select a News Topic</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Click on a timeline track or select a ranked topic from the trending panel to load articles and analyze sources.
          </p>
        </div>
      </Card>
    );
  }

  // Loading skeleton state
  if (loading && !detail) {
    return (
      <Card className="h-[220px] flex flex-col border-[#27272A] justify-center p-6 bg-[#18181B] rounded-xl">
        <div className="space-y-3">
          <Skeleton className="h-4.5 w-20 rounded bg-zinc-800" />
          <Skeleton className="h-6 w-3/4 rounded bg-zinc-800" />
          <Skeleton className="h-4 w-1/2 rounded bg-zinc-800" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[220px] flex flex-col justify-center items-center border-[#27272A] bg-[#18181B] rounded-xl">
        <p className="text-xs text-destructive">{error}</p>
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
    <Card className="flex flex-col h-[220px] border-[#27272A] bg-[#18181B] rounded-xl shadow-lg justify-between">
      <CardHeader className="p-5 pb-2 flex-1 justify-center space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge className="bg-[#4F46E5]/10 text-[#4F46E5] hover:bg-[#4F46E5]/15 border border-[#4F46E5]/20 text-[9px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full">
            Topic Focus
          </Badge>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
            <span className="text-[10px] text-muted-foreground font-semibold">
              {detail.articleCount} articles total
            </span>
          </div>
        </div>
        
        <div>
          <CardTitle className="text-sm font-bold leading-snug text-[#FAFAFA] truncate" title={detail.label}>
            {detail.label}
          </CardTitle>
          
          {/* Clean Metadata Section */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-1.5 font-medium">
            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-[#4F46E5]/70 shrink-0" />
              <span>
                {new Date(detail.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(detail.endTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={11} className="text-[#4F46E5]/70 shrink-0" />
              <span>{durationStr}</span>
            </div>
          </div>
        </div>

        {/* Source Inline Filters inside Card Header */}
        {availableSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[#27272A]">
            <span className="text-[10px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter size={10} className="text-[#4F46E5]" /> Filters:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChangeSources([])}
              className={`h-5 px-2.5 text-[9px] font-semibold rounded-full border cursor-pointer transition-all duration-150 ${
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
                  className={`h-5 px-2.5 text-[9px] font-semibold rounded-full border cursor-pointer transition-all duration-150 ${
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
      </CardHeader>
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
}

export const ArticleList: React.FC<ArticleListProps> = ({
  clusterId,
  articles,
  filteredArticles,
  loading,
  error,
  page,
  onPageChange,
}) => {
  if (!clusterId) {
    return null; // Don't show article list if no cluster selected
  }

  if (loading && articles.length === 0) {
    return (
      <Card className="border-[#27272A] bg-[#18181B] rounded-xl shadow-lg">
        <CardHeader className="p-5 pb-3 flex flex-row items-center gap-2">
          <BookOpen size={16} className="text-[#4F46E5]" />
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
      <Card className="border-[#27272A] p-8 flex items-center justify-center bg-[#18181B] rounded-xl">
        <p className="text-xs text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col border-[#27272A] bg-[#18181B] rounded-xl shadow-lg">
      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#4F46E5]" />
          <CardTitle className="text-sm font-bold tracking-tight text-[#FAFAFA]">Article List</CardTitle>
        </div>
        <span className="text-[10px] text-muted-foreground font-semibold">
          Showing {filteredArticles.length} articles on this page
        </span>
      </CardHeader>
      
      <div className="border-t border-[#27272A]" />

      {/* Articles List - Grid layout inside the Card */}
      <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
            No articles match the selected source filters.
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
          className="h-8 px-3 text-[10px] font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] cursor-pointer rounded-lg disabled:opacity-50"
        >
          <ChevronLeft size={14} className="mr-0.5" />
          Prev Page
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={articles.length < PAGE_LIMIT || loading}
          className="h-8 px-3 text-[10px] font-semibold border-[#27272A] hover:bg-[#27272A] hover:text-[#FAFAFA] cursor-pointer rounded-lg disabled:opacity-50"
        >
          Next Page
          <ChevronRight size={14} className="ml-0.5" />
        </Button>
      </div>
    </Card>
  );
};

function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="group rounded-lg border border-[#27272A] bg-[#18181B] p-4 hover:border-[#4F46E5]/40 transition-all duration-200 flex flex-col justify-between hover:bg-[#27272A]/10">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-[#27272A] text-zinc-300 hover:bg-[#27272A] border border-[#27272A]/50 text-[9px] font-semibold px-2 py-0.5 tracking-wider uppercase rounded-md">
              {article.source}
            </Badge>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
              <Clock size={11} className="text-[#4F46E5]/60 shrink-0" />
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
            className="shrink-0 text-muted-foreground hover:text-[#4F46E5] transition-colors duration-150 p-0.5"
            aria-label="Open article link"
          >
            <ExternalLink size={13} />
          </a>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs font-bold text-[#FAFAFA] hover:text-[#4F46E5] transition-colors duration-150 leading-snug mb-1.5 line-clamp-2"
        >
          {article.title}
        </a>
        {article.summary && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {article.summary}
          </p>
        )}
      </div>
    </div>
  );
}

export default ClusterDetail;
