'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  const [activeTooltip, setActiveTooltip] = useState<TimelineData | null>(null);
  const [activePosition, setActivePosition] = useState<{ x: number; y: number; transform: string } | null>(null);
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

  // 3. Piecewise Non-linear Time Mapping to compress large timeline gaps (e.g. outlier singletons)
  const { getVirtualTime, domainMinVirtual, domainSpanVirtual, ticks } = useMemo(() => {
    // Get all unique timestamps and sort them ascending
    const uniqueTimes = Array.from(
      new Set(
        data.flatMap(d => [
          new Date(d.startTime).getTime(),
          new Date(d.endTime).getTime()
        ])
      )
    ).sort((a, b) => a - b);

    if (uniqueTimes.length === 0) {
      const staticTime = 1770000000000;
      return {
        getVirtualTime: (t: number) => t,
        domainMinVirtual: staticTime - 24 * 60 * 60 * 1000,
        domainSpanVirtual: 24 * 60 * 60 * 1000,
        ticks: [staticTime]
      };
    }

    // Build virtual mapping for each unique timestamp
    const MAX_GAP = 5 * 24 * 60 * 60 * 1000; // 5 days
    const COMPRESSED_GAP = 1 * 24 * 60 * 60 * 1000; // 1 day

    const virtualTimes: number[] = [0];
    for (let i = 1; i < uniqueTimes.length; i++) {
      const gap = uniqueTimes[i] - uniqueTimes[i - 1];
      if (gap > MAX_GAP) {
        virtualTimes.push(virtualTimes[i - 1] + COMPRESSED_GAP);
      } else {
        virtualTimes.push(virtualTimes[i - 1] + gap);
      }
    }

    // Define the piecewise interpolation function getVirtualTime
    const getVirtualTime = (realTime: number) => {
      if (uniqueTimes.length === 0) return realTime;

      // Before first
      if (realTime <= uniqueTimes[0]) {
        return virtualTimes[0] - (uniqueTimes[0] - realTime);
      }
      // After last
      if (realTime >= uniqueTimes[uniqueTimes.length - 1]) {
        const lastIdx = uniqueTimes.length - 1;
        return virtualTimes[lastIdx] + (realTime - uniqueTimes[lastIdx]);
      }

      // Find the interval
      for (let i = 0; i < uniqueTimes.length - 1; i++) {
        if (realTime >= uniqueTimes[i] && realTime <= uniqueTimes[i + 1]) {
          const ratio = (realTime - uniqueTimes[i]) / (uniqueTimes[i + 1] - uniqueTimes[i]);
          return virtualTimes[i] + ratio * (virtualTimes[i + 1] - virtualTimes[i]);
        }
      }
      return realTime;
    };

    const domainMinVirtual = virtualTimes[0];
    const domainSpanVirtual = Math.max(virtualTimes[virtualTimes.length - 1] - domainMinVirtual, 60 * 60 * 1000);

    // Generate ticks evenly in virtual space and reverse map to real timestamps
    const numTicks = 6;
    const tickItems: number[] = [];
    for (let i = 0; i < numTicks; i++) {
      const vTime = domainMinVirtual + (domainSpanVirtual / (numTicks - 1)) * i;
      
      // Reverse map vTime to realTime
      let realTime = uniqueTimes[0];
      if (vTime <= virtualTimes[0]) {
        realTime = uniqueTimes[0] - (virtualTimes[0] - vTime);
      } else if (vTime >= virtualTimes[virtualTimes.length - 1]) {
        const lastIdx = virtualTimes.length - 1;
        realTime = uniqueTimes[lastIdx] + (vTime - virtualTimes[lastIdx]);
      } else {
        for (let j = 0; j < virtualTimes.length - 1; j++) {
          if (vTime >= virtualTimes[j] && vTime <= virtualTimes[j + 1]) {
            const ratio = (vTime - virtualTimes[j]) / (virtualTimes[j + 1] - virtualTimes[j]);
            realTime = uniqueTimes[j] + ratio * (uniqueTimes[j + 1] - uniqueTimes[j]);
            break;
          }
        }
      }
      tickItems.push(realTime);
    }

    return { getVirtualTime, domainMinVirtual, domainSpanVirtual, ticks: tickItems };
  }, [data]);

  // 4. Greedy Lane Packing to assign vertical tracks without collision (using virtual time for visual layout safety)
  const { topicLanes, totalLanes } = useMemo(() => {
    const lanes: number[][] = []; // holds virtual endTimes for each lane
    const mapping: Record<number, number> = {};

    // Pack all data to keep lanes stable
    const sortedAll = [...data].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    sortedAll.forEach((topic) => {
      const start = getVirtualTime(new Date(topic.startTime).getTime());
      const end = getVirtualTime(new Date(topic.endTime).getTime());

      const buffer = domainSpanVirtual * 0.06; // 6% virtual buffer
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
  }, [data, getVirtualTime, domainSpanVirtual]);

  // Dynamic layout calculations
  const maxLanesLimit = 8;
  const activeLanesCount = Math.min(totalLanes, maxLanesLimit);
  const svgHeight = activeLanesCount * 52 + 110;
  const paddingLeft = 70;
  const paddingRight = 70;
  const paddingTop = 50;
  const paddingBottom = 45;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const chartWidth = 1000; // Fixed coordinate system for viewBox scaling

  // Helper to map time to X coordinate
  const getX = useCallback((isoString: string) => {
    const time = new Date(isoString).getTime();
    const virtualTime = getVirtualTime(time);
    const ratio = (virtualTime - domainMinVirtual) / domainSpanVirtual;
    return paddingLeft + ratio * (chartWidth - paddingLeft - paddingRight);
  }, [getVirtualTime, domainMinVirtual, domainSpanVirtual, paddingLeft, paddingRight, chartWidth]);

  // Helper to map lane index to Y coordinate
  const getY = useCallback((topicId: number) => {
    const laneIndex = topicLanes[topicId] ?? 0;
    const wrappedIndex = laneIndex % activeLanesCount;
    return paddingTop + wrappedIndex * (chartHeight / Math.max(activeLanesCount - 1, 1));
  }, [topicLanes, activeLanesCount, paddingTop, chartHeight]);

  const maxCountInBatch = useMemo(() => {
    return Math.max(...data.map((t) => t.articleCount), 1);
  }, [data]);

  const nonCollidingLabelIds = useMemo(() => {
    // 1. Prioritize candidates in order: selected, hovered, top 5 largest by article count
    const candidates: TimelineData[] = [];
    
    // Add selected
    const selected = displayedData.find((t) => t.id === selectedClusterId);
    if (selected) candidates.push(selected);
    
    // Add hovered
    if (hoveredTopic && hoveredTopic.id !== selectedClusterId) {
      candidates.push(hoveredTopic);
    }
    
    // Add top 5 largest (only if count is 3 or more)
    const sortedByCount = [...displayedData].sort((a, b) => b.articleCount - a.articleCount);
    const top5 = sortedByCount.slice(0, 5);
    top5.forEach((topic) => {
      if (topic.articleCount >= 3) {
        if (topic.id !== selectedClusterId && (!hoveredTopic || topic.id !== hoveredTopic.id)) {
          candidates.push(topic);
        }
      }
    });

    // 2. Perform greedy overlap collision check in priority order
    const ids = new Set<number>();
    const rendered: { x: number; y: number }[] = [];
    
    candidates.forEach((topic) => {
      const xStart = getX(topic.startTime);
      const xEnd = getX(topic.endTime);
      const xMid = xStart + (xEnd - xStart) / 2;
      const yVal = getY(topic.id);
      
      const isPriority = topic.id === selectedClusterId || topic.id === hoveredTopic?.id;
      
      if (isPriority) {
        ids.add(topic.id);
        rendered.push({ x: xMid, y: yVal });
      } else {
        // Prevent overlapping labels within 90px horizontally and 22px vertically
        const overlaps = rendered.some(l => Math.abs(l.x - xMid) < 90 && Math.abs(l.y - yVal) < 22);
        if (!overlaps) {
          ids.add(topic.id);
          rendered.push({ x: xMid, y: yVal });
        }
      }
    });
    
    return ids;
  }, [displayedData, selectedClusterId, hoveredTopic, getX, getY]);

  const sortedNodesForDrawing = useMemo(() => {
    return [...displayedData].sort((a, b) => {
      const aActive = a.id === selectedClusterId || a.id === hoveredTopic?.id;
      const bActive = b.id === selectedClusterId || b.id === hoveredTopic?.id;
      if (aActive && !bActive) return 1; // b renders first, a renders last (above b)
      if (!aActive && bActive) return -1; // a renders first, b renders last (above a)
      return 0;
    });
  }, [displayedData, selectedClusterId, hoveredTopic]);

  // Helper to determine if two topics are related semantically
  const areTopicsRelated = (a: TimelineData, b: TimelineData) => {
    const wordsA = a.label.toLowerCase().split(/[\s,.:;'"()\[\]{}!@#$%^&*\-_=+|\\]+/).filter(w => w.length > 3);
    const wordsB = b.label.toLowerCase().split(/[\s,.:;'"()\[\]{}!@#$%^&*\-_=+|\\]+/).filter(w => w.length > 3);
    return wordsA.some(w => wordsB.includes(w));
  };

  // Generate connecting lines between consecutive nodes in each lane
  const connectingLines = useMemo(() => {
    const linesList: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      related: boolean;
      opacity: number;
    }> = [];

    // Group displayed data by lane
    const laneGroups: Record<number, TimelineData[]> = {};
    displayedData.forEach((topic) => {
      const laneIdx = (topicLanes[topic.id] ?? 0) % activeLanesCount;
      if (!laneGroups[laneIdx]) {
        laneGroups[laneIdx] = [];
      }
      laneGroups[laneIdx].push(topic);
    });

    // For each lane group, sort chronologically and create connections
    Object.values(laneGroups).forEach((topics) => {
      const sortedTopics = [...topics].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      for (let i = 0; i < sortedTopics.length - 1; i++) {
        const current = sortedTopics[i];
        const next = sortedTopics[i + 1];
        
        const x1 = getX(current.endTime);
        const x2 = getX(next.startTime);
        const y = getY(current.id);

        const related = areTopicsRelated(current, next);

        // Opacity reflects overall state: dimmer if searching/filtering is active
        const matchesCurrent = current.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesNext = next.label.toLowerCase().includes(searchQuery.toLowerCase());
        const searchDimmed = searchQuery && (!matchesCurrent || !matchesNext);

        linesList.push({
          key: `connect-${current.id}-${next.id}`,
          x1,
          y1: y,
          x2,
          y2: y,
          related,
          opacity: searchDimmed ? 0.08 : related ? 0.45 : 0.18,
        });
      }
    });

    return linesList;
  }, [displayedData, topicLanes, activeLanesCount, searchQuery, getX, getY]);

  // Position tooltip based on layout context and boundaries
  const getTooltipPosition = (
    containerRect: DOMRect,
    targetRect: DOMRect,
    clientX?: number
  ) => {
    const nodeX = targetRect.left - containerRect.left + targetRect.width / 2;
    const nodeY = targetRect.top - containerRect.top + targetRect.height / 2;

    const isNearRight = nodeX > containerRect.width - 220;
    const isNearLeft = nodeX < 220;
    const isNearTop = nodeY < 200; // Adjusted threshold to prevent vertical tooltip clipping

    let x = nodeX;
    let y = nodeY;
    let transform = 'translate(-50%, -100%)';

    if (isNearTop) {
      // Near top -> open below
      y = nodeY + (targetRect.height / 2) + 12;
      transform = 'translate(-50%, 0)';
    } else if (isNearRight) {
      // Right side -> open left
      x = nodeX - (targetRect.width / 2) - 12;
      transform = 'translate(-100%, -50%)';
    } else if (isNearLeft) {
      // Left side -> open right
      x = nodeX + (targetRect.width / 2) + 12;
      transform = 'translate(0, -50%)';
    } else {
      // Otherwise -> open above
      y = nodeY - (targetRect.height / 2) - 12;
      transform = 'translate(-50%, -100%)';
    }

    // Follow the mouse on the X-axis if not on the edges, avoiding boundary clipping
    if (clientX !== undefined && !isNearRight && !isNearLeft) {
      const mouseX = clientX - containerRect.left;
      x = Math.max(168, Math.min(containerRect.width - 168, mouseX));
    }

    return { x, y, transform };
  };

  // Handle hover interactions
  const handleMouseEnter = (topic: TimelineData, event: React.MouseEvent<SVGGElement>) => {
    setHoveredTopic(topic);
    setActiveTooltip(topic);
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const targetRect = event.currentTarget.getBoundingClientRect();
      const pos = getTooltipPosition(containerRect, targetRect);
      setActivePosition(pos);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<SVGGElement>) => {
    if (containerRef.current && hoveredTopic) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const targetRect = event.currentTarget.getBoundingClientRect();
      const pos = getTooltipPosition(containerRect, targetRect, event.clientX);
      setActivePosition(pos);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTopic(null);
  };

  const formatTickDate = (timeMs: number) => {
    const date = new Date(timeMs);
    const dayStr = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
    
    // Check if there are other ticks with the same dayStr
    const hasDuplicateDay = ticks.some(t => {
      if (t === timeMs) return false;
      const otherDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(t));
      return otherDay === dayStr;
    });
    
    if (hasDuplicateDay) {
      const timeStr = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
      return `${dayStr}, ${timeStr}`;
    }
    return dayStr;
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hoverPulse {
          0% {
            transform: scale(1.08);
            filter: brightness(1.15) drop-shadow(0 0 5px rgba(99, 102, 241, 0.4));
          }
          50% {
            transform: scale(1.11);
            filter: brightness(1.22) drop-shadow(0 0 8px rgba(99, 102, 241, 0.6));
          }
          100% {
            transform: scale(1.08);
            filter: brightness(1.15) drop-shadow(0 0 5px rgba(99, 102, 241, 0.4));
          }
        }
        .hover-pulse-active {
          animation: hoverPulse 2s infinite ease-in-out;
        }
      ` }} />
      {/* Absolute Tooltip Overlay */}
      {activeTooltip && activePosition && (
        <div
          className="absolute z-30 bg-[#09090B]/98 backdrop-blur-md border border-[#27272A] text-[#FAFAFA] p-5 rounded-xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] max-w-xs space-y-2.5 pointer-events-none"
          style={{
            left: `${activePosition.x}px`,
            top: `${activePosition.y}px`,
            transform: activePosition.transform,
            opacity: hoveredTopic ? 1 : 0,
            transition: 'opacity 135ms ease-in-out, transform 135ms ease-in-out, left 135ms ease-out, top 135ms ease-out',
          }}
        >
          <div className="font-semibold text-base text-[#FAFAFA] leading-snug border-b border-[#27272A] pb-2">
            {activeTooltip.label}
          </div>
          <div className="space-y-1.5 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
              <span><strong>{activeTooltip.articleCount}</strong> articles published</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span>Relative Coverage: <strong>{Math.round(activeTooltip.intensity * 100)}%</strong></span>
            </div>
            {activeTooltip.sources && activeTooltip.sources.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0 mt-1" />
                <span className="line-clamp-2">Sources: {activeTooltip.sources.join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-[#27272A]/50 pt-1.5 text-[10px] font-mono text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              <span>
                {new Date(activeTooltip.startTime).toLocaleDateString()} - {new Date(activeTooltip.endTime).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card Header with Controls */}
      <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-[#4F46E5] animate-pulse" />
            <CardTitle className="text-base font-bold tracking-tight text-[#FAFAFA]">News Evolution Timeline</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-[#27272A] text-muted-foreground ml-1">
              Interactive
            </Badge>
          </div>
          <CardDescription className="text-[13px] mt-1">
            Visualize how major news stories emerge, evolve and grow over time.
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

      <CardContent className="pb-8 pt-0 px-8 overflow-x-auto">
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
                <g key={`grid-${i}`} className="opacity-70">
                  <line
                    x1={xVal}
                    y1={paddingTop - 10}
                    x2={xVal}
                    y2={svgHeight - paddingBottom + 10}
                    stroke="#52525B"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={xVal}
                    y={svgHeight - paddingBottom + 25}
                    textAnchor="middle"
                    fill="#A1A1AA"
                    className="text-[10px] font-mono font-medium"
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
              stroke="#52525B"
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
                  stroke="#52525B"
                  strokeWidth={1}
                  strokeDasharray="2 6"
                  opacity={0.65}
                />
              );
            })}

            {/* Chronological Connecting Lines */}
            {connectingLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.related ? '#6366F1' : '#3F3F46'}
                strokeWidth={line.related ? 1.5 : 1}
                strokeDasharray={line.related ? undefined : '3 3'}
                opacity={line.opacity}
                className="transition-all duration-150 ease-out"
              />
            ))}

            {/* Selected / Hovered Track Highlight Strips */}
            {hoveredTopic && (
              <rect
                x={paddingLeft - 20}
                y={getY(hoveredTopic.id) - 24}
                width={chartWidth - paddingLeft - paddingRight + 40}
                height={48}
                rx={6}
                fill="#4F46E5"
                fillOpacity={0.02}
                stroke="#4F46E5"
                strokeOpacity={0.06}
                strokeWidth={1}
                className="pointer-events-none transition-all duration-150 ease-out"
              />
            )}
            {selectedClusterId !== null && (
              <rect
                x={paddingLeft - 20}
                y={getY(selectedClusterId) - 24}
                width={chartWidth - paddingLeft - paddingRight + 40}
                height={48}
                rx={6}
                fill="#4F46E5"
                fillOpacity={0.04}
                stroke="#818CF8"
                strokeOpacity={0.12}
                strokeWidth={1}
                className="pointer-events-none transition-all duration-150 ease-out"
              />
            )}

            {/* Topic Tracks Constellation */}
            {sortedNodesForDrawing.map((topic) => {
              const xStart = getX(topic.startTime);
              const xEnd = getX(topic.endTime);
              const yVal = getY(topic.id);
              const xMid = xStart + (xEnd - xStart) / 2;

              const isSelected = selectedClusterId === topic.id;
              const isHovered = hoveredTopic?.id === topic.id;

              // Calculate radius based on volume: min 7.2px, max 28.8px (reduced by 20%)
              let rVal = 7.2 + Math.sqrt(topic.articleCount / maxCountInBatch) * 21.6;
              if (topic.articleCount === 1) {
                rVal = rVal * 0.65; // reduce radius by 35%
              } else if (topic.articleCount === 2) {
                rVal = rVal * 0.82; // slightly smaller standard node
              }

              // Opacity matches intensity (faded if search active and not matching)
              const matchesSearch = topic.label.toLowerCase().includes(searchQuery.toLowerCase());
              let baseOpacity = 0.4 + topic.intensity * 0.6;
              if (topic.articleCount === 1) {
                baseOpacity = baseOpacity * 0.65; // reduce opacity slightly
              }
              const isAnyActive = selectedClusterId !== null || hoveredTopic !== null;
              const isActiveNode = isSelected || isHovered;
              const opacity = searchQuery
                ? (matchesSearch ? 1.0 : 0.12)
                : (isActiveNode ? 1.0 : (isAnyActive ? 0.16 : baseOpacity));

              const isLabelVisible = nonCollidingLabelIds.has(topic.id);

              return (
                <g
                  key={topic.id}
                  className="cursor-pointer transition-all duration-150 ease-out"
                  onClick={() => onSelectCluster(topic.id)}
                  onMouseEnter={(e) => handleMouseEnter(topic, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  style={{ opacity }}
                >
                  {/* Invisible thick hover target line to expand interaction area */}
                  <line
                    x1={xStart}
                    y1={yVal}
                    x2={xEnd}
                    y2={yVal}
                    stroke="transparent"
                    strokeWidth={24}
                    strokeLinecap="round"
                    className="cursor-pointer"
                  />
                  {/* Invisible large hover target circle to expand interaction area */}
                  <circle
                    cx={xMid}
                    cy={yVal}
                    r={rVal + 14}
                    fill="transparent"
                    className="cursor-pointer"
                  />
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
                    style={{
                      transform: isHovered ? 'scaleY(1.3)' : 'scaleY(1)',
                      transformOrigin: `${xMid}px ${yVal}px`,
                      transition: 'transform 135ms ease-out, stroke 135ms ease-out',
                    }}
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

                  {/* Stable selected outer ring (subtle indigo glow, thicker ring) */}
                  {isSelected && (
                    <circle
                      cx={xMid}
                      cy={yVal}
                      r={rVal + 6}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth={2.2}
                      opacity={0.9}
                      style={{
                        filter: 'drop-shadow(0 0 5px rgba(99, 102, 241, 0.45))',
                        transition: 'all 135ms ease-out',
                      }}
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
                    className={isHovered ? 'hover-pulse-active cursor-pointer' : 'cursor-pointer'}
                    style={{
                      transformOrigin: `${xMid}px ${yVal}px`,
                      transform: isHovered ? undefined : 'scale(1)',
                      filter: isSelected ? 'url(#nodeGlow)' : undefined,
                      transition: 'transform 135ms ease-out, filter 135ms ease-out, stroke 135ms ease-out',
                    }}
                  />

                  {/* Text Label Backdrop Capsule (with smooth opacity fade) */}
                  {(() => {
                    const labelText = topic.label.length > 20 ? `${topic.label.slice(0, 18)}...` : topic.label;
                    const rectWidth = labelText.length * 6.5 + 12;
                    return (
                      <g
                        style={{
                          opacity: isLabelVisible ? 1 : 0,
                          transition: 'opacity 135ms ease-in-out',
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Backdrop pill rect to block underlying grid/connecting lines */}
                        <rect
                          x={xMid - rectWidth / 2}
                          y={yVal - rVal - 24}
                          width={rectWidth}
                          height={16}
                          rx={8}
                          fill="#18181B"
                          fillOpacity={0.88}
                          stroke="#27272A"
                          strokeOpacity={0.5}
                          strokeWidth={0.5}
                        />
                        {/* Dynamic label text */}
                        <text
                          x={xMid}
                          y={yVal - rVal - 11}
                          textAnchor="middle"
                          fill={isSelected ? '#FAFAFA' : isHovered ? '#A5B4FC' : '#E4E4E7'}
                          className={`text-xs ${isSelected || isHovered ? 'font-bold' : 'font-medium'} tracking-wide`}
                          style={{
                            transform: isHovered ? 'translateY(-1px)' : 'translateY(0px)',
                            transformOrigin: `${xMid}px ${yVal}px`,
                            transition: 'transform 135ms ease-out, fill 135ms ease-out',
                          }}
                        >
                          {labelText}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
      
      {/* Bottom Interactive Guide Bar */}
      <div className="border-t border-[#27272A] px-5 py-3.5 flex items-center justify-between text-[11px] text-muted-foreground bg-card/25 rounded-b-lg">
        <div className="flex items-center gap-1.5">
          <Info size={14} className="text-[#4F46E5]" />
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
