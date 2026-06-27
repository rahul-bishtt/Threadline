'use client';

import React, { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerIngest, getIngestStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type JobStatus = 'idle' | 'pending' | 'running' | 'done' | 'failed' | 'conflict';

interface RefreshButtonProps {
  onComplete: () => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ onComplete }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = jobStatus === 'pending' || jobStatus === 'running';

  const scheduleAutoClear = (delay = 5000) => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setJobStatus('idle');
      setStatusMessage('');
    }, delay);
  };

  const handleRefresh = async () => {
    if (isLoading) return;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

    setJobStatus('pending');
    setStatusMessage('Starting sync…');

    try {
      const { jobId } = await triggerIngest();
      setJobStatus('running');
      setStatusMessage('Syncing articles…');

      const interval = setInterval(async () => {
        try {
          const statusRes = await getIngestStatus(jobId);
          if (statusRes.status === 'done') {
            clearInterval(interval);
            setJobStatus('done');
            setStatusMessage('Up to date');
            onComplete();
            scheduleAutoClear(5000);
          } else if (statusRes.status === 'failed') {
            clearInterval(interval);
            setJobStatus('failed');
            setStatusMessage(statusRes.error || 'Sync failed');
          }
        } catch {
          clearInterval(interval);
          setJobStatus('failed');
          setStatusMessage('Status check failed');
        }
      }, 2500);
    } catch (err: unknown) {
      // 409 Conflict — already running
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : null;

      if (status === 409) {
        setJobStatus('conflict');
        setStatusMessage('Already syncing');
        scheduleAutoClear(3000);
      } else {
        setJobStatus('failed');
        setStatusMessage('Failed to start sync');
      }
    }
  };

  const badgeContent = () => {
    if (jobStatus === 'idle') return null;
    const styles: Record<JobStatus, string> = {
      idle: '',
      pending: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
      running: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
      done: 'border-green-500/40 text-green-400 bg-green-500/10',
      failed: 'border-red-500/40 text-red-400 bg-red-500/10',
      conflict: 'border-zinc-500/40 text-zinc-400 bg-zinc-500/10',
    };
    return (
      <Badge
        variant="outline"
        className={`text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md transition-all duration-200 ${styles[jobStatus]}`}
      >
        {statusMessage}
      </Badge>
    );
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isLoading}
        className="h-8 gap-1.5 text-xs font-semibold border-[#27272A] bg-[#18181B] hover:bg-[#27272A]/40 text-[#FAFAFA]/90 hover:text-[#FAFAFA] rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw
          size={13}
          className={isLoading ? 'animate-spin' : ''}
        />
        {isLoading ? 'Syncing…' : 'Refresh'}
      </Button>
      {badgeContent()}
    </div>
  );
};

export default RefreshButton;
