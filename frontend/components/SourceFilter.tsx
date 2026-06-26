'use client';

import React from 'react';

// TODO:
// Receive list of available sources (e.g. ['BBC', 'NPR', 'NYTimes']) as props.
// Manage multi-select checkboxes or pill button toggles.
// Propagate selected source state changes upward to trigger timeline and list redraws.

interface SourceFilterProps {
  sources: string[];
  selectedSources: string[];
  onChange: (sources: string[]) => void;
}

export const SourceFilter: React.FC<SourceFilterProps> = ({
  sources,
  selectedSources,
  onChange,
}) => {
  const toggleSource = (source: string) => {
    if (selectedSources.includes(source)) {
      onChange(selectedSources.filter((s) => s !== source));
    } else {
      onChange([...selectedSources, source]);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-450 uppercase tracking-wider mb-3">
        Filter Sources
      </h3>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const isSelected = selectedSources.includes(source);
          return (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isSelected
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
              }`}
            >
              {source}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SourceFilter;
