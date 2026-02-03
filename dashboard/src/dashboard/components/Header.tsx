import { Button, Badge } from '../ui';
import './Header.css';

interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
  lastUpdated: Date | null;
  isStale: boolean;
  error: string | null;
  onClearError: () => void;
}

// format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function Header({
  onRefresh,
  loading,
  lastUpdated,
  isStale,
  error,
  onClearError,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-main">
        <div className="header-title">
          <h1 className="header-name">Live Agent Dashboard</h1>
          <span className="header-version">v0.1.0</span>
        </div>

        <div className="header-status">
          {lastUpdated && (
            <span className={`header-updated ${isStale ? 'header-updated--stale' : ''}`}>
              updated {formatTimeAgo(lastUpdated)}
            </span>
          )}
          {isStale && (
            <Badge variant="warning">stale</Badge>
          )}
          <Button
            size="sm"
            onClick={onRefresh}
            loading={loading}
            title="refresh agent data"
          >
            refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="header-error">
          <span className="header-error-message">{error}</span>
          <Button size="sm" variant="ghost" onClick={onClearError}>
            dismiss
          </Button>
        </div>
      )}
    </header>
  );
}
