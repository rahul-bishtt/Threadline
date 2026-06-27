'use client';

import React, { useState, useMemo, useRef } from 'react';
import { CalendarDays, AlertCircle, Info } from 'lucide-react';
import { TimelineData } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TimelineProps {
  data: TimelineData[];
  onSelectCluster: (id: number) => void;
  selectedClusterId: number | null;
  searchQuery: string;
  loading?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  data,
  onSelectCluster,
  selectedClusterId,
  searchQuery,
  loading = false,
}) => {
  const [hoveredTopic, setHoveredTopic] = useState<TimelineData | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<{ x: number; y: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Filter by search query
  const filteredData = useMemo(() => {
    return data.filter((topic) =>
      topic.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  // 2. Sort by startTime ascending to show logical chronological evolution from left to right
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();
      return timeA - timeB;
    });
  }, [filteredData]);

  // 3. Slice for display limit if not showing all
  const displayLimit = 25;
  const displayedData = useMemo(() => {
    if (showAll) return sortedData;
    // If not showAll, take the top topics by articleCount or just the latest ones?
    // Let's take the top 25 topics by articleCount to focus on high-impact events
    const topTopics = [...sortedData].sort((a, b) => b.articleCount - a.articleCount).slice(0, displayLimit);
    // Sort them chronologically again so the rendering is left-to-right consistent
    return topTopics.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [sortedData, showAll]);

  // Calculate overall date boundaries for the entire dataset (for stable scaling)
  const { domainMin, domainSpan } = useMemo(() => {
    if (data.length === 0) {
      const staticTime = 1770000000000; // static base timestamp for purity
      return { domainMin: staticTime - 24 * 60 * 60 * 1000, domainSpan: 24 * 60 * 60 * 1000 };
    }
    const timestamps = data.flatMap((d) => [
      new Date(d.startTime).getTime(),
      new Date(d.endTime).getTime(),
    ]);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const span = Math.max(max - min, 60 * 60 * 1000); // min 1 hour span
    return { domainMin: min, domainSpan: span };
  }, [data]);

  // 4. Greedy Lane Packing to assign vertical tracks without collision
  const { topicLanes, totalLanes } = useMemo(() => {
    const lanes: number[][] = []; // holds endTimes for each lane
    const mapping: Record<number, number> = {};
    
    // Pack all data to keep lanes stable when searching/filtering
    const sortedAll = [...data].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    sortedAll.forEach((topic) => {
      const start = new Date(topic.startTime).getTime();
      const end = new Date(topic.endTime).getTime();
      
      const buffer = domainSpan * 0.05; // 5% buffer to prevent labels overlapping
      let assignedLane = -1;
      
      for (let i = 0; i < lanes.length; i++) {
        const lastEnd = lanes[i][lanes[i].length - 1];
        if (start > lastEnd + buffer) {
          assignedLane = i;
          break;
        }
      }
      
      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push([end]);
      } else {
        lanes[assignedLane].push(end);
      }
      mapping[topic.id] = assignedLane;
    });

    return { topicLanes: mapping, totalLanes: Math.max(lanes.length, 1) };
  }, [data, domainSpan]);

  // Dynamic layout calculations
  const maxLanesLimit = 8;
  const activeLanesCount = Math.min(totalLanes, maxLanesLimit);
  const svgHeight = activeLanesCount * 45 + 85;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 40;
  const paddingBottom = 45;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const chartWidth = 1000; // Fixed coordinate system for viewBox scaling

  // Helper to map time to X coordinate
  const getX = (isoString: string) => {
    const time = new Date(isoString).getTime();
    const ratio = (time - domainMin) / domainSpan;
    return paddingLeft + ratio * (chartWidth - paddingLeft - paddingRight);
  };

  // Helper to map lane index to Y coordinate
  const getY = (topicId: number) => {
    const laneIndex = topicLanes[topicId] ?? 0;
    const wrappedIndex = laneIndex % activeLanesCount;
    return paddingTop + wrappedIndex * (chartHeight / Math.max(activeLanesCount - 1, 1));
  };

  // Generate Chronological X-axis ticks
  const ticks = useMemo(() => {
    const numTicks = 6;
    const items = [];
    for (let i = 0; i < numTicks; i++) {
      const time = domainMin + (domainSpan / (numTicks - 1)) * i;
      items.push(time);
    }
    return items;
  }, [domainMin, domainSpan]);

  // Handle hover interactions
  const handleMouseEnter = (topic: TimelineData, event: React.MouseEvent<SVGGElement>) => {
    setHoveredTopic(topic);
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const targetRect = event.currentTarget.getBoundingClientRect();
      
      // Calculate coordinates relative to the timeline container
      const x = targetRect.left - containerRect.left + targetRect.width / 2;
      const y = targetRect.top - containerRect.top;
      setHoveredPosition({ x, y });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<SVGGElement>) => {
    if (containerRef.current && hoveredTopic) {
      const containerRect = containerRef.current.getBoundingClientRect();
      // Follow the mouse slightly on the X-axis for better alignment
      const x = event.clientX - containerRect.left;
      setHoveredPosition((prev) => prev ? { ...prev, x } : null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTopic(null);
    setHoveredPosition(null);
  };

  const formatTickDate = (timeMs: number) => {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(timeMs));
  };

  /* ── 1. Skeleton Loader ── */
  if (loading) {
    return (
      <Card className="bg-[#18181B] border-[#27272A] rounded-xl shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#4F46E5] animate-pulse" />
            <CardTitle className="text-sm font-semibold tracking-tight text-[#FAFAFA]">Timeline Constellation</CardTitle>
          </div>
          <CardDescription>Loading topic evolution grid...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex flex-col justify-center items-center gap-4">
          <div className="w-full max-w-lg space-y-4">
            <Skeleton className="h-4 w-1/4 rounded bg-zinc-800" />
            <div className="relative h-24 border border-dashed border-zinc-800 rounded flex items-center justify-around px-4">
              <Skeleton className="h-6 w-6 rounded-full bg-zinc-800" />
              <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
              <Skeleton className="h-5 w-5 rounded-full bg-zinc-800" />
              <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-10 bg-zinc-800" />
              <Skeleton className="h-3 w-10 bg-zinc-800" />
              <Skeleton className="h-3 w-10 bg-zinc-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ── 2. Empty State ── */
  if (data.length === 0) {
    return (
      <Card className="bg-[#18181B] border-[#27272A] rounded-xl shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#4F46E5]" />
            <CardTitle className="text-sm font-semibold tracking-tight text-[#FAFAFA]">Timeline Constellation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <AlertCircle size={36} className="text-zinc-600" />
          <p className="text-sm text-center">
            No active news timeline data. Click <span className="text-[#FAFAFA] font-medium">Refresh</span> to fetch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="timeline-container" ref={containerRef} className="bg-[#18181B] border-[#27272A] rounded-xl shadow-lg relative overflow-visible">
      {/* Absolute Tooltip Overlay */}
      {hoveredTopic && hoveredPosition && (
        <div
          className="absolute z-30 bg-[#18181B]/95 backdrop-blur-md border border-[#27272A] text-[#FAFAFA] p-3.5 rounded-lg shadow-2xl max-w-xs space-y-2.5 pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: `${hoveredPosition.x}px`,
            top: `${hoveredPosition.y - 12}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold text-xs text-[#FAFAFA] leading-snug border-b border-[#27272A] pb-1.5">
            {hoveredTopic.label}
          </div>
          <div className="space-y-1.5 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
              <span><strong>{hoveredTopic.articleCount}</strong> articles published</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span>Coverage Intensity: <strong>{Math.round(hoveredTopic.intensity * 100)}%</strong></span>
            </div>
            {hoveredTopic.sources && hoveredTopic.sources.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0 mt-1" />
                <span className="line-clamp-2">Sources: {hoveredTopic.sources.join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-[#27272A]/50 pt-1.5 text-[9px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span>
                {new Date(hoveredTopic.startTime).toLocaleDateString()} - {new Date(hoveredTopic.endTime).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card Header with Controls */}
      <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#4F46E5] animate-pulse" />
            <CardTitle className="text-sm font-semibold tracking-tight text-[#FAFAFA]">Topic Evolution Timeline</CardTitle>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-[#27272A] text-muted-foreground ml-1">
              Interactive
            </Badge>
          </div>
          <CardDescription className="text-xs mt-1">
            Map out news categories chronologically. Circle size dictates article density, and path length indicates duration.
          </CardDescription>
        </div>

        {/* Show All / Top Toggle */}
        {sortedData.length > displayLimit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="h-7 px-3 text-[10px] border-[#27272A] hover:bg-[#27272A] text-muted-foreground hover:text-[#FAFAFA] rounded-md transition-colors ml-auto cursor-pointer"
          >
            {showAll ? 'Show Top 25' : `Show All (${sortedData.length})`}
          </Button>
        )}
      </CardHeader>

      <CardContent className="pb-5 pt-0 overflow-x-auto">
        <div className="min-w-[800px] relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${svgHeight}`}
            width="100%"
            height={svgHeight}
            className="select-none overflow-visible"
          >
            {/* Definitions for gradients & glow filters */}
            <defs>
              <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>

              <linearGradient id="inactiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3F3F46" />
                <stop offset="100%" stopColor="#18181B" />
              </linearGradient>
            </defs>

            {/* Vertical Time Guideline Ticks */}
            {ticks.map((tick, i) => {
              const xVal = paddingLeft + (i / (ticks.length - 1)) * (chartWidth - paddingLeft - paddingRight);
              return (
                <g key={`grid-${i}`} className="opacity-45">
                  <line
                    x1={xVal}
                    y1={paddingTop - 10}
                    x2={xVal}
                    y2={svgHeight - paddingBottom + 10}
                    stroke="#27272A"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={xVal}
                    y={svgHeight - paddingBottom + 25}
                    textAnchor="middle"
                    fill="#A1A1AA"
                    className="text-[9px] font-mono font-medium"
                  >
                    {formatTickDate(tick)}
                  </text>
                </g>
              );
            })}

            {/* Chronological Main Axis Line */}
            <line
              x1={paddingLeft - 20}
              y1={svgHeight - paddingBottom + 10}
              x2={chartWidth - paddingRight + 20}
              y2={svgHeight - paddingBottom + 10}
              stroke="#27272A"
              strokeWidth={1.5}
            />

            {/* Horizontal Track Guide Lines */}
            {Array.from({ length: activeLanesCount }).map((_, laneIdx) => {
              const yVal = paddingTop + laneIdx * (chartHeight / Math.max(activeLanesCount - 1, 1));
              return (
                <line
                  key={`lane-guide-${laneIdx}`}
                  x1={paddingLeft - 20}
                  y1={yVal}
                  x2={chartWidth - paddingRight + 20}
                  y2={yVal}
                  stroke="#27272A"
                  strokeWidth={1}
                  strokeDasharray="2 6"
                  opacity={0.35}
                />
              );
            })}

            {/* Selected / Hovered Track Highlight Strips */}
            {hoveredTopic && (
              <rect
                x={paddingLeft - 20}
                y={getY(hoveredTopic.id) - 18}
                width={chartWidth - paddingLeft - paddingRight + 40}
                height={36}
                rx={6}
                fill="#4F46E5"
                fillOpacity={0.03}
                stroke="#4F46E5"
                strokeOpacity={0.12}
                strokeWidth={1}
                className="pointer-events-none transition-all duration-200"
              />
            )}
            {selectedClusterId !== null && (
              <rect
                x={paddingLeft - 20}
                y={getY(selectedClusterId) - 18}
                width={chartWidth - paddingLeft - paddingRight + 40}
                height={36}
                rx={6}
                fill="#4F46E5"
                fillOpacity={0.07}
                stroke="#4F46E5"
                strokeOpacity={0.3}
                strokeWidth={1.5}
                className="pointer-events-none transition-all duration-200"
              />
            )}

            {/* Topic Tracks Constellation */}
            {displayedData.map((topic) => {
              const xStart = getX(topic.startTime);
              const xEnd = getX(topic.endTime);
              const yVal = getY(topic.id);
              const xMid = xStart + (xEnd - xStart) / 2;

              const isSelected = selectedClusterId === topic.id;
              const isHovered = hoveredTopic?.id === topic.id;

              // Calculate radius based on volume: min 6px, max 20px
              const maxCountInBatch = Math.max(...data.map((t) => t.articleCount), 1);
              const rVal = 6 + Math.sqrt(topic.articleCount / maxCountInBatch) * 14;

              // Opacity matches intensity (faded if search active and not matching)
              const matchesSearch = topic.label.toLowerCase().includes(searchQuery.toLowerCase());
              const baseOpacity = 0.4 + topic.intensity * 0.6;
              const opacity = searchQuery ? (matchesSearch ? 1.0 : 0.15) : (isSelected || isHovered ? 1.0 : baseOpacity);

              return (
                <g
                  key={topic.id}
                  className="cursor-pointer transition-all duration-300"
                  onClick={() => onSelectCluster(topic.id)}
                  onMouseEnter={(e) => handleMouseEnter(topic, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  style={{ opacity }}
                >
                  {/* Glowing line segment for selected state */}
                  {isSelected && (
                    <line
                      x1={xStart}
                      y1={yVal}
                      x2={xEnd}
                      y2={yVal}
                      stroke="#4F46E5"
                      strokeWidth={10}
                      strokeLinecap="round"
                      opacity={0.2}
                      className="animate-pulse"
                    />
                  )}

                  {/* Active duration path line */}
                  <line
                    x1={xStart}
                    y1={yVal}
                    x2={xEnd}
                    y2={yVal}
                    stroke={isSelected || isHovered ? '#818CF8' : '#27272A'}
                    strokeWidth={isSelected || isHovered ? 3.5 : 2}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                  />

                  {/* Midpoint connector line down to chronological axis */}
                  {(isSelected || isHovered) && (
                    <line
                      x1={xMid}
                      y1={yVal}
                      x2={xMid}
                      y2={svgHeight - paddingBottom + 10}
                      stroke={isSelected ? '#4F46E5' : '#27272A'}
                      strokeWidth={1.2}
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Start cap dot */}
                  <circle
                    cx={xStart}
                    cy={yVal}
                    r={2.5}
                    fill={isSelected || isHovered ? '#818CF8' : '#3F3F46'}
                  />

                  {/* End cap dot */}
                  <circle
                    cx={xEnd}
                    cy={yVal}
                    r={2.5}
                    fill={isSelected || isHovered ? '#818CF8' : '#3F3F46'}
                  />

                  {/* Outer glowing halo ring for selected/hovered nodes */}
                  {(isSelected || isHovered) && (
                    <circle
                      cx={xMid}
                      cy={yVal}
                      r={rVal + 5}
                      fill="none"
                      stroke={isSelected ? '#4F46E5' : '#818CF8'}
                      strokeWidth={1.5}
                      opacity={isSelected ? 0.6 : 0.4}
                      className="animate-ping"
                      style={{ animationDuration: '3s' }}
                    />
                  )}

                  {/* Main Epicenter Node Circle */}
                  <circle
                    cx={xMid}
                    cy={yVal}
                    r={rVal}
                    fill={isSelected || isHovered ? 'url(#activeGrad)' : 'url(#inactiveGrad)'}
                    stroke={isSelected ? '#FAFAFA' : isHovered ? '#818CF8' : '#27272A'}
                    strokeWidth={isSelected ? 2 : 1.2}
                    filter={isSelected || isHovered ? 'url(#nodeGlow)' : undefined}
                    className="transition-all duration-200"
                  />

                  {/* Text Label Backdrop Capsule (for readability) */}
                  {(isSelected || isHovered || topic.articleCount > maxCountInBatch * 0.25) && (
                    <g className="transition-all duration-200">
                      {/* Dynamic label text */}
                      <text
                        x={xMid}
                        y={yVal - rVal - 6}
                        textAnchor="middle"
                        fill={isSelected ? '#FAFAFA' : isHovered ? '#818CF8' : '#A1A1AA'}
                        className={`text-[9px] ${isSelected ? 'font-bold' : 'font-medium'} tracking-wide`}
                      >
                        {topic.label.length > 22 ? `${topic.label.slice(0, 20)}...` : topic.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
      
      {/* Bottom Interactive Guide Bar */}
      <div className="border-t border-[#27272A] px-5 py-3 flex items-center justify-between text-[10px] text-muted-foreground bg-card/25 rounded-b-lg">
        <div className="flex items-center gap-1.5">
          <Info size={12} className="text-[#4F46E5]" />
          <span>Interactive Constellation: Node size = articles quantity; line length = duration. Click nodes to focus.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4F46E5]" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#27272A]" /> Inactive
          </span>
        </div>
      </div>
    </Card>
  );
};

export default Timeline;
