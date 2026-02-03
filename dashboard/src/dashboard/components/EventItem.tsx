import { useState } from 'react';
import type { Event } from '../types';
import { Badge, Button } from '../ui';
import './EventItem.css';

interface EventItemProps {
  event: Event;
}

// event type labels and badge variants
const eventTypeConfig: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  'agent.start': { label: 'agent start', variant: 'primary' },
  'agent.end': { label: 'agent end', variant: 'primary' },
  'tool.start': { label: 'tool start', variant: 'default' },
  'tool.end': { label: 'tool end', variant: 'success' },
  'message.in': { label: 'message in', variant: 'default' },
  'message.out': { label: 'message out', variant: 'default' },
  'llm.usage': { label: 'llm usage', variant: 'warning' },
};

// format timestamp to locale time with seconds
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// format duration in milliseconds
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// format params for display - show key values concisely
function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '{}';

  // for simple single-value params, just show the value
  if (entries.length === 1) {
    const [key, value] = entries[0];
    if (typeof value === 'string') {
      return value.length > 60 ? `${value.slice(0, 60)}...` : value;
    }
    return `${key}: ${JSON.stringify(value)}`;
  }

  // for multiple params, show compact JSON
  const str = JSON.stringify(params);
  return str.length > 80 ? `${str.slice(0, 80)}...` : str;
}

export function EventItem({ event }: EventItemProps) {
  const [copied, setCopied] = useState(false);

  const typeConfig = eventTypeConfig[event.type] || { label: event.type, variant: 'default' as const };

  // handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard api not available
    }
  };

  return (
    <div className={`event-item ${event.success === false ? 'event-item--error' : ''}`}>
      <div className="event-item-header">
        <span className="event-item-time">{formatTimestamp(event.timestamp)}</span>
        <Badge variant={event.success === false ? 'danger' : typeConfig.variant}>
          {typeConfig.label}
        </Badge>
      </div>

      <div className="event-item-body">
        {event.toolName && (
          <div className="event-item-detail">
            <span className="event-item-label">tool:</span>
            <span className="event-item-value">{event.toolName}</span>
          </div>
        )}

        {event.params && Object.keys(event.params).length > 0 && (
          <div className="event-item-detail event-item-detail--params">
            <span className="event-item-label">params:</span>
            <span className="event-item-value event-item-value--params">{formatParams(event.params)}</span>
          </div>
        )}

        {event.durationMs !== null && (
          <div className="event-item-detail">
            <span className="event-item-label">duration:</span>
            <span className="event-item-value">{formatDuration(event.durationMs)}</span>
          </div>
        )}

        {event.success !== null && (
          <div className="event-item-detail">
            <span className="event-item-label">status:</span>
            <span className={`event-item-value ${event.success ? 'event-item-value--success' : 'event-item-value--error'}`}>
              {event.success ? 'success' : 'failed'}
            </span>
          </div>
        )}
      </div>

      {event.error && (
        <div className="event-item-error">
          <span className="event-item-error-label">error:</span>
          <span className="event-item-error-message">{event.error}</span>
        </div>
      )}

      <div className="event-item-actions">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          title="copy event json"
        >
          {copied ? 'copied!' : 'copy'}
        </Button>
      </div>
    </div>
  );
}
