import type { SessionBoundary } from '../types';
import './SessionSeparator.css';

interface SessionSeparatorProps {
  boundary: SessionBoundary;
}

// format gap duration in human readable form
function formatGap(minutes: number): string {
  if (minutes < 60) return `${minutes}m gap`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m gap` : `${hours}h gap`;
}

// format timestamp to locale time
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionSeparator({ boundary }: SessionSeparatorProps) {
  return (
    <div className="session-separator">
      <div className="session-separator-line" />
      <div className="session-separator-content">
        <span className="session-separator-gap">{formatGap(boundary.gapMinutes)}</span>
        <span className="session-separator-time">resumed {formatTime(boundary.previousTimestamp)}</span>
      </div>
    </div>
  );
}
