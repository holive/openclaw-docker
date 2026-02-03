import { useRef, useEffect, useState } from 'react';
import { Button } from '../ui';
import './LogStream.css';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
}

interface LogStreamProps {
  logs: LogEntry[];
  title?: string;
  maxHeight?: number;
  autoScroll?: boolean;
  onClear?: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LogStream({
  logs,
  title = 'logs',
  maxHeight = 500,
  autoScroll = true,
  onClear,
}: LogStreamProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && isAtBottom && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isAtBottom]);

  const handleScroll = () => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
  };

  return (
    <div className="log-stream" style={{ maxHeight }}>
      <div className="log-stream-header">
        <span className="log-stream-title">{title}</span>
        <div className="log-stream-actions">
          {onClear && (
            <Button size="sm" variant="ghost" onClick={onClear}>
              clear
            </Button>
          )}
        </div>
      </div>

      <div
        ref={bodyRef}
        className="log-stream-body"
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="log-stream-empty">
            <div className="log-stream-empty-icon">[~]</div>
            <span>no logs yet</span>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`log-row ${log.level === 'error' ? 'log-row--error' : ''}`}
            >
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className={`log-level log-level--${log.level}`}>
                {log.level}
              </span>
              <span className="log-source">{log.source}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
