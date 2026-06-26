'use client';

import React, { useState } from 'react';
import { triggerIngest, getIngestStatus } from '../lib/api';

// TODO:
// Implement click handler calling triggerIngest().
// Enter loading/spinning state and initiate interval polling of job status.
// Check status every 2 seconds until status resolves to 'done' or 'failed'.
// Trigger onComplete callback to prompt parent view refetches.

interface RefreshButtonProps {
  onComplete: () => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ onComplete }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleRefresh = async () => {
    setLoading(true);
    setStatusMessage('Triggering ingestion run...');
    try {
      const triggerRes = await triggerIngest();
      const { jobId } = triggerRes;

      setStatusMessage(`Job spawned (${jobId}). Running...`);

      // Start polling status
      const interval = setInterval(async () => {
        try {
          const statusRes = await getIngestStatus(jobId);
          if (statusRes.status === 'done') {
            clearInterval(interval);
            setStatusMessage('Done!');
            setLoading(false);
            onComplete();
          } else if (statusRes.status === 'failed') {
            clearInterval(interval);
            setStatusMessage(`Failed: ${statusRes.error || 'Unknown error'}`);
            setLoading(false);
          } else {
            setStatusMessage(`Job ${jobId} is ${statusRes.status}...`);
          }
        } catch (err) {
          console.error(err);
          clearInterval(interval);
          setStatusMessage('Error querying job status.');
          setLoading(false);
        }
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage('Failed to trigger ingestion.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-md transition-all ${
          loading
            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
        }`}
      >
        {loading ? 'Refreshing...' : 'Refresh Feed Data'}
      </button>
      {statusMessage && (
        <span className="text-xs text-slate-400 font-medium">
          {statusMessage}
        </span>
      )}
    </div>
  );
};

export default RefreshButton;
