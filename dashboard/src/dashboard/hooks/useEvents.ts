import { useState, useEffect, useCallback } from 'react';
import type { Event } from '../types';
import { fetchEvents } from '../api';

interface UseEventsReturn {
  events: Event[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEvents(agentId: string | null): UseEventsReturn {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!agentId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchEvents(agentId);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load events');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // load events when agentId changes
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { events, loading, error, refresh: loadEvents };
}
