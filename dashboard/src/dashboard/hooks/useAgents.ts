import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent } from '../types';
import { fetchAgents } from '../api';

// stale threshold - data considered stale after 30 seconds
const STALE_THRESHOLD_MS = 30000;
// poll interval - fetch new data every 5 seconds
const POLL_INTERVAL_MS = 5000;

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useAgents(): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const initialLoadRef = useRef(true);

  const loadAgents = useCallback(async () => {
    // only show loading indicator on initial load
    if (initialLoadRef.current) {
      setLoading(true);
    }

    try {
      const data = await fetchAgents();
      setAgents(data);
      setLastUpdated(new Date());
      setIsStale(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load agents');
    } finally {
      setLoading(false);
      initialLoadRef.current = false;
    }
  }, []);

  // initial load and polling
  useEffect(() => {
    loadAgents();

    const interval = setInterval(loadAgents, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAgents]);

  // stale check - update isStale flag based on lastUpdated time
  useEffect(() => {
    if (!lastUpdated) return;

    const checkStale = () => {
      const now = new Date();
      const timeSinceUpdate = now.getTime() - lastUpdated.getTime();
      setIsStale(timeSinceUpdate > STALE_THRESHOLD_MS);
    };

    // check immediately
    checkStale();

    // then check every 5 seconds
    const interval = setInterval(checkStale, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    agents,
    loading,
    error,
    lastUpdated,
    isStale,
    refresh: loadAgents,
    clearError,
  };
}
