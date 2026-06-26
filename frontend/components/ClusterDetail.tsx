'use client';

import React, { useEffect, useState } from 'react';
import { getClusterById, ClusterDetail as ClusterDetailType } from '../lib/api';

// TODO:
// Receive selected cluster ID as props.
// Fetch detailed list of backing articles sorted by pubDate.
// Display list of sources, headlines, dates, and outgoing links.
// Handle loading, errors, and empty selection states.

interface ClusterDetailProps {
  clusterId: number | null;
  selectedSources: string[];
}

export const ClusterDetail: React.FC<ClusterDetailProps> = ({
  clusterId,
  selectedSources,
}) => {
  const [detail, setDetail] = useState<ClusterDetailType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) {
      setDetail(null);
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getClusterById(clusterId);
        setDetail(data);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load cluster details.');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [clusterId]);

  if (!clusterId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-full flex items-center justify-center text-slate-400">
        <p>Select a cluster from the timeline to see articles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-full flex items-center justify-center text-slate-400">
        <p>Loading cluster details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-full flex items-center justify-center text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  if (!detail) return null;

  // Client-side filtering by source
  const filteredArticles = detail.articles.filter(
    (article) =>
      selectedSources.length === 0 || selectedSources.includes(article.source)
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Cluster Details
        </span>
        <h2 className="text-2xl font-bold text-slate-100 mt-1">{detail.label}</h2>
        <p className="text-sm text-slate-400 mt-1">
          {detail.articles.length} total articles
        </p>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {filteredArticles.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No articles match the selected source filters.
          </p>
        ) : (
          filteredArticles.map((article) => (
            <div
              key={article.id}
              className="bg-slate-850 hover:bg-slate-800 border border-slate-800 p-4 rounded-lg transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-200 hover:text-indigo-400 transition-colors text-sm"
                >
                  {article.title}
                </a>
                <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {article.source}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Published: {new Date(article.publishedAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClusterDetail;
