'use client';

import React, { useState, useEffect } from 'react';
import Timeline from '../components/Timeline';
import ClusterDetail from '../components/ClusterDetail';
import SourceFilter from '../components/SourceFilter';
import RefreshButton from '../components/RefreshButton';
import { getTimeline, TimelineData } from '../lib/api';

// TODO:
// Orchestrate dashboard state containing timeline points, selected cluster, and active filters.
// Fetch chart aggregates from backend on mount and when scraper runs complete.
// Display status panels during loading or connection errors.

export default function Home() {
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTimeline();
      setTimelineData(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch timeline data. Please make sure the backend API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Unique sources list for filter
  // Scaffolding uses simple predefined list or extracts from fetched timeline labels
  const availableSources = ['BBC', 'NPR', 'NYTimes'];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              News Pulse
            </h1>
            <p className="text-sm text-slate-405 mt-1">
              Topic-Clustered News Timeline & Ingestion Pipeline
            </p>
          </div>
          <RefreshButton onComplete={loadDashboardData} />
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 p-4 rounded-xl text-red-300 text-sm">
            <p>{error}</p>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Visualizations (Left/Center) */}
          <div className="lg:col-span-2 space-y-8">
            {loading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                <p className="animate-pulse">Loading dashboard timeline...</p>
              </div>
            ) : (
              <Timeline
                data={timelineData}
                onSelectCluster={setSelectedClusterId}
                selectedClusterId={selectedClusterId}
              />
            )}

            <SourceFilter
              sources={availableSources}
              selectedSources={selectedSources}
              onChange={setSelectedSources}
            />
          </div>

          {/* Details Panel (Right) */}
          <div className="lg:col-span-1 h-full">
            <ClusterDetail
              clusterId={selectedClusterId}
              selectedSources={selectedSources}
            />
          </div>
          
        </div>
      </div>
    </main>
  );
}
