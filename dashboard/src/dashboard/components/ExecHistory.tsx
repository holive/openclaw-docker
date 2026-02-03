import { useState, useEffect } from 'react';
import type { Event } from '../types';
import { fetchEvents } from '../api';
import { Badge } from '../ui';
import './ExecHistory.css';

interface ExecHistoryProps {
  agentId: string;
  limit?: number;
}

interface ExecCommand {
  id: number;
  command: string;
  exitCode: number | null;
  durationMs: number | null;
  success: boolean | null;
  error: string | null;
  timestamp: string;
  output: string | null;
  isRunning: boolean;
}

// extract command from bash tool params
function extractCommand(params: Record<string, unknown> | null): string {
  if (!params) return '<unknown command>';
  const cmd = params.command as string;
  return cmd || '<unknown command>';
}

// truncate command for display
function truncateCommand(cmd: string, maxLength: number = 60): string {
  // remove leading whitespace from each line and join
  const normalized = cmd.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength - 3) + '...';
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

// pair bash tool.start and tool.end events
function pairBashEvents(events: Event[]): ExecCommand[] {
  const bashStarts: Event[] = [];
  const commands: ExecCommand[] = [];

  // process events in chronological order
  const sortedEvents = [...events].reverse();

  for (const event of sortedEvents) {
    if (event.type === 'tool.start' && event.toolName === 'Bash') {
      bashStarts.push(event);
    } else if (event.type === 'tool.end' && event.toolName === 'Bash') {
      // find matching start
      const startIdx = bashStarts.findIndex(s => true); // take first available

      if (startIdx >= 0) {
        const startEvent = bashStarts.splice(startIdx, 1)[0];
        const exitCodeMatch = event.error?.match(/exit code (\d+)/i);
        const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : (event.success ? 0 : 1);

        commands.push({
          id: startEvent.id,
          command: extractCommand(startEvent.params),
          exitCode: event.success !== null ? exitCode : null,
          durationMs: event.durationMs,
          success: event.success,
          error: event.error,
          timestamp: startEvent.timestamp,
          output: null, // output is not stored in events (too large)
          isRunning: false,
        });
      }
    }
  }

  // add remaining starts as running commands
  for (const startEvent of bashStarts) {
    commands.push({
      id: startEvent.id,
      command: extractCommand(startEvent.params),
      exitCode: null,
      durationMs: null,
      success: null,
      error: null,
      timestamp: startEvent.timestamp,
      output: null,
      isRunning: true,
    });
  }

  // sort by timestamp descending
  return commands.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function ExecHistory({ agentId, limit = 100 }: ExecHistoryProps) {
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
        setError(err instanceof Error ? err.message : 'failed to load commands');
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [agentId, limit]);

  if (loading) {
    return <div className="exec-history exec-history--loading">loading command history...</div>;
  }

  if (error) {
    return <div className="exec-history exec-history--error">{error}</div>;
  }

  const commands = pairBashEvents(events);

  if (commands.length === 0) {
    return <div className="exec-history exec-history--empty">no bash commands</div>;
  }

  return (
    <div className="exec-history">
      <div className="exec-history-list">
        {commands.map((cmd) => {
          const isExpanded = expandedId === cmd.id;

          return (
            <div
              key={cmd.id}
              className={`exec-command ${isExpanded ? 'exec-command--expanded' : ''} ${cmd.isRunning ? 'exec-command--running' : ''}`}
            >
              <button
                className="exec-command-summary"
                onClick={() => setExpandedId(isExpanded ? null : cmd.id)}
              >
                <span className="exec-command-prompt">$</span>
                <span className="exec-command-text">{truncateCommand(cmd.command)}</span>
                <span className="exec-command-meta">
                  {cmd.isRunning ? (
                    <Badge variant="warning">running</Badge>
                  ) : (
                    <>
                      <span className={`exec-command-exit ${cmd.exitCode === 0 ? 'exec-command-exit--success' : 'exec-command-exit--error'}`}>
                        [{cmd.exitCode}]
                      </span>
                      <span className="exec-command-duration">{formatDuration(cmd.durationMs)}</span>
                    </>
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="exec-command-details">
                  <div className="exec-command-detail-row">
                    <span className="exec-command-detail-label">time:</span>
                    <span className="exec-command-detail-value">{formatTime(cmd.timestamp)}</span>
                  </div>
                  <div className="exec-command-detail-row exec-command-detail-row--full">
                    <span className="exec-command-detail-label">command:</span>
                    <pre className="exec-command-full">{cmd.command}</pre>
                  </div>
                  {cmd.error && (
                    <div className="exec-command-detail-row exec-command-detail-row--error">
                      <span className="exec-command-detail-label">error:</span>
                      <span className="exec-command-detail-error">{cmd.error}</span>
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
