import { useState } from 'react';
import type { Event, EventListItem, SessionBoundary } from '../types';
import { isSessionBoundary } from '../types';
import { EventItem } from './EventItem';
import { SessionSeparator } from './SessionSeparator';
import { Panel, Button } from '../ui';
import './EventList.css';

// filter types for the event list
type FilterType = 'all' | 'errors' | 'tools' | 'messages' | 'llm';

// filter configuration
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'errors', label: 'errors' },
  { key: 'tools', label: 'tools' },
  { key: 'messages', label: 'messages' },
  { key: 'llm', label: 'llm' },
];

// filter events based on selected filter type
function filterEvents(events: Event[], filter: FilterType): Event[] {
  switch (filter) {
    case 'all':
      return events;
    case 'errors':
      return events.filter((e) => e.success === false);
    case 'tools':
      return events.filter((e) => e.type === 'tool.start' || e.type === 'tool.end');
    case 'messages':
      return events.filter((e) => e.type === 'message.in' || e.type === 'message.out');
    case 'llm':
      return events.filter((e) => e.type === 'llm.usage');
    default:
      return events;
  }
}

// session gap threshold in milliseconds (5 minutes)
const SESSION_GAP_THRESHOLD_MS = 5 * 60 * 1000;

// detect session boundaries based on timestamp gaps
// events are ordered DESC (newest first)
function detectSessionBoundaries(events: Event[]): EventListItem[] {
  if (events.length === 0) return [];

  const result: EventListItem[] = [];

  for (let i = 0; i < events.length; i++) {
    result.push(events[i]);

    // check for gap between current and next event
    if (i < events.length - 1) {
      const current = new Date(events[i].timestamp).getTime();
      const next = new Date(events[i + 1].timestamp).getTime();
      const gapMs = current - next; // current is newer (larger timestamp)

      if (gapMs >= SESSION_GAP_THRESHOLD_MS) {
        const boundary: SessionBoundary = {
          type: 'session-boundary',
          gapMinutes: Math.round(gapMs / 60000),
          previousTimestamp: events[i].timestamp,
          nextTimestamp: events[i + 1].timestamp,
        };
        result.push(boundary);
      }
    }
  }

  return result;
}

interface EventListProps {
  events: Event[];
  loading: boolean;
}

// loading skeleton for events
function LoadingSkeleton() {
  return (
    <div className="event-list-loading">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="event-skeleton">
          <div className="event-skeleton-header">
            <div className="event-skeleton-time" />
            <div className="event-skeleton-badge" />
          </div>
          <div className="event-skeleton-body">
            <div className="event-skeleton-line" />
            <div className="event-skeleton-line event-skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

// empty state when no events
function EmptyState() {
  return (
    <div className="event-list-empty">
      <div className="event-list-empty-icon">[ ]</div>
      <p className="event-list-empty-message">no events recorded for this agent</p>
    </div>
  );
}

export function EventList({ events, loading }: EventListProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  if (loading) {
    return (
      <Panel variant="inset" noPadding>
        <LoadingSkeleton />
      </Panel>
    );
  }

  if (events.length === 0) {
    return (
      <Panel variant="inset">
        <EmptyState />
      </Panel>
    );
  }

  const filteredEvents = filterEvents(events, filter);
  const itemsWithBoundaries = detectSessionBoundaries(filteredEvents);

  return (
    <Panel variant="inset" noPadding>
      <div className="event-list-filter-bar">
        <div className="event-list-filters">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'primary' : 'ghost'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <span className="event-list-count">
          showing {filteredEvents.length} of {events.length} events
        </span>
      </div>
      <div className="event-list">
        {itemsWithBoundaries.map((item, index) =>
          isSessionBoundary(item) ? (
            <SessionSeparator key={`boundary-${index}`} boundary={item} />
          ) : (
            <EventItem key={item.id} event={item} />
          )
        )}
      </div>
    </Panel>
  );
}
