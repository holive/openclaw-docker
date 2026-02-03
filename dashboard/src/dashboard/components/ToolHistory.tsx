import { useState, useEffect } from 'react';
import type { Event } from '../types';
import { fetchEvents } from '../api';
import { Badge } from '../ui';
import './ToolHistory.css';

interface ToolHistoryProps {
  agentId: string;
  limit?: number;
}

interface ToolCall {
  id: number;
  toolName: string;
  startTimestamp: string;
  endTimestamp: string | null;
  durationMs: number | null;
  success: boolean | null;
  error: string | null;
  params: Record<string, unknown> | null;
}

// extract primary param for display (e.g., file path, command)
function extractPrimaryParam(toolName: string, params: Record<string, unknown> | null): string | null {
  if (!params) return null;

  // tool-specific param extraction
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return params.file_path as string || params.path as string || null;
    case 'Bash':
      const cmd = params.command as string;
      if (cmd) {
        // truncate long commands
        return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd;
      }
      return null;
    case 'Glob':
      return params.pattern as string || null;
    case 'Grep':
      return params.pattern as string || null;
    case 'WebFetch':
      return params.url as string || null;
    default:
      // try common param names
      return (
        params.path as string ||
        params.file as string ||
        params.query as string ||
        params.name as string ||
        null
      );
  }
}

// format duration
function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

// format time
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// pair tool.start and tool.end events into ToolCalls
function pairToolEvents(events: Event[]): ToolCall[] {
  const startEvents: Event[] = [];
  const toolCalls: ToolCall[] = [];

  // process events in chronological order (they come DESC, so reverse)
  const sortedEvents = [...events].reverse();

  for (const event of sortedEvents) {
    if (event.type === 'tool.start') {
      startEvents.push(event);
    } else if (event.type === 'tool.end' && event.toolName) {
      // find matching start event
      const startIdx = startEvents.findIndex(
        (s) => s.toolName === event.toolName
      );

      if (startIdx >= 0) {
        const startEvent = startEvents.splice(startIdx, 1)[0];
        toolCalls.push({
          id: startEvent.id,
          toolName: event.toolName,
          startTimestamp: startEvent.timestamp,
          endTimestamp: event.timestamp,
          durationMs: event.durationMs,
          success: event.success,
          error: event.error,
          params: startEvent.params,
        });
      } else {
        // tool.end without matching start (orphan)
        toolCalls.push({
          id: event.id,
          toolName: event.toolName,
          startTimestamp: event.timestamp,
          endTimestamp: event.timestamp,
          durationMs: event.durationMs,
          success: event.success,
          error: event.error,
          params: null,
        });
      }
    }
  }

  // add remaining start events as in-progress tools
  for (const startEvent of startEvents) {
    if (startEvent.toolName) {
      toolCalls.push({
        id: startEvent.id,
        toolName: startEvent.toolName,
        startTimestamp: startEvent.timestamp,
        endTimestamp: null,
        durationMs: null,
        success: null,
        error: null,
        params: startEvent.params,
      });
    }
  }

  // sort by start time descending (newest first)
  return toolCalls.sort(
    (a, b) => new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime()
  );
}

export function ToolHistory({ agentId, limit = 100 }: ToolHistoryProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const data = await fetchEvents(agentId, limit);
        setEvents(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'failed to load tools');
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [agentId, limit]);

  if (loading) {
    return <div className="tool-history tool-history--loading">loading tool history...</div>;
  }

  if (error) {
    return <div className="tool-history tool-history--error">{error}</div>;
  }

  const toolCalls = pairToolEvents(events);

  if (toolCalls.length === 0) {
    return <div className="tool-history tool-history--empty">no tool calls</div>;
  }

  return (
    <div className="tool-history">
      <div className="tool-history-list">
        {toolCalls.map((tool) => {
          const isExpanded = expandedId === tool.id;
          const primaryParam = extractPrimaryParam(tool.toolName, tool.params);
          const isInProgress = tool.endTimestamp === null;

          return (
            <div
              key={tool.id}
              className={`tool-call ${isExpanded ? 'tool-call--expanded' : ''} ${isInProgress ? 'tool-call--in-progress' : ''}`}
            >
              <button
                className="tool-call-summary"
                onClick={() => setExpandedId(isExpanded ? null : tool.id)}
              >
                <span className="tool-call-name">[{tool.toolName}]</span>
                {primaryParam && (
                  <span className="tool-call-param">{primaryParam}</span>
                )}
                <span className="tool-call-meta">
                  <span className="tool-call-duration">{formatDuration(tool.durationMs)}</span>
                  {isInProgress ? (
                    <Badge variant="warning">running</Badge>
                  ) : tool.success === true ? (
                    <Badge variant="success">ok</Badge>
                  ) : tool.success === false ? (
                    <Badge variant="danger">error</Badge>
                  ) : null}
                </span>
              </button>

              {isExpanded && (
                <div className="tool-call-details">
                  <div className="tool-call-detail-row">
                    <span className="tool-call-detail-label">time:</span>
                    <span className="tool-call-detail-value">{formatTime(tool.startTimestamp)}</span>
                  </div>
                  {tool.params && Object.keys(tool.params).length > 0 && (
                    <div className="tool-call-detail-row tool-call-detail-row--params">
                      <span className="tool-call-detail-label">params:</span>
                      <pre className="tool-call-detail-params">
                        {JSON.stringify(tool.params, null, 2)}
                      </pre>
                    </div>
                  )}
                  {tool.error && (
                    <div className="tool-call-detail-row tool-call-detail-row--error">
                      <span className="tool-call-detail-label">error:</span>
                      <span className="tool-call-detail-error">{tool.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
