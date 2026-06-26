'use client';

import React from 'react';
import { TimelineData } from '../lib/api';

// TODO:
// Receive chart-ready clusters timeline data as props.
// Map timeline events along an X-axis representing dates.
// Render clusters as variable-width blocks or scatter plots.
// Support interactive clicks to display cluster details.

interface TimelineProps {
  data: TimelineData[];
  onSelectCluster: (id: number) => void;
  selectedClusterId: number | null;
}

export const Timeline: React.FC<TimelineProps> = ({
  data,
  onSelectCluster,
  selectedClusterId,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h2 className="text-xl font-bold text-slate-100 mb-4">News Timeline</h2>
      <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded-lg text-slate-400">
        <p>
          [TODO: Plot {data.length} clusters on the time axis. Active selection:{' '}
          {selectedClusterId || 'none'}]
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {data.map((cluster) => (
          <button
            key={cluster.id}
            onClick={() => onSelectCluster(cluster.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedClusterId === cluster.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {cluster.label} ({cluster.articleCount} articles)
          </button>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
