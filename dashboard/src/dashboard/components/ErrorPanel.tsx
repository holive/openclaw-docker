import type { ErrorSummary } from '../types';
import './ErrorPanel.css';

interface ErrorPanelProps {
  errors: ErrorSummary;
  onEventClick?: (timestamp: string) => void;
}

// format relative time
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// format time
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// truncate error message
function truncateError(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + '...';
}

export function ErrorPanel({ errors, onEventClick }: ErrorPanelProps) {
  if (errors.count === 0) {
    return null;
  }

  return (
    <div className="error-panel">
      <div className="error-panel-header">
        <span className="error-panel-icon">[!]</span>
        <span className="error-panel-title">
          {errors.count} error{errors.count !== 1 ? 's' : ''} detected
        </span>
      </div>

      {errors.recent.length > 0 && (
        <div className="error-panel-list">
          {errors.recent.map((error, idx) => (
            <div
              key={idx}
              className="error-panel-item"
              onClick={() => onEventClick?.(error.timestamp)}
              role={onEventClick ? 'button' : undefined}
              tabIndex={onEventClick ? 0 : undefined}
            >
              <div className="error-panel-item-header">
                {error.tool && (
                  <span className="error-panel-tool">[{error.tool}]</span>
                )}
                <span className="error-panel-time" title={formatTime(error.timestamp)}>
                  {formatRelativeTime(error.timestamp)}
                </span>
              </div>
              <div className="error-panel-message">
                {truncateError(error.message)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
