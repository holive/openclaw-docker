import { useEffect, useState } from 'react';
import type { ActivityInfo, DerivedStatus } from '../types';
import { fetchActivityInfo } from '../api';
import { Badge } from '../ui';
import './ActivitySummary.css';

interface ActivitySummaryProps {
  agentId: string;
  pollInterval?: number; // ms, default 5000
}

// status display config
const statusConfig: Record<DerivedStatus, { label: string; className: string }> = {
  thinking: { label: 'thinking', className: 'activity-status--thinking' },
  tooling: { label: 'using tool', className: 'activity-status--tooling' },
  executing: { label: 'executing', className: 'activity-status--executing' },
  waiting: { label: 'waiting', className: 'activity-status--waiting' },
  idle: { label: 'idle', className: 'activity-status--idle' },
  error: { label: 'error', className: 'activity-status--error' },
  stuck: { label: 'stuck', className: 'activity-status--stuck' },
};

// format relative time
function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// format event type for display
function formatEventType(type: string): string {
  const typeMap: Record<string, string> = {
    'tool.start': 'started',
    'tool.end': 'finished',
    'message.in': 'received',
    'message.out': 'sent',
    'agent.end': 'ended',
  };
  return typeMap[type] || type;
}

export function ActivitySummary({ agentId, pollInterval = 5000 }: ActivitySummaryProps) {
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadActivity() {
      try {
        const data = await fetchActivityInfo(agentId);
        if (mounted) {
          setActivity(data);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setActivity(null);
          setLoading(false);
        }
      }
    }

    loadActivity();

    // poll for updates
    const interval = setInterval(loadActivity, pollInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [agentId, pollInterval]);

  if (loading) {
    return (
      <div className="activity-summary activity-summary--loading">
        <span className="activity-summary-loading-text">loading activity...</span>
      </div>
    );
  }

  if (!activity) {
    return null;
  }

  const config = statusConfig[activity.derivedStatus];

  return (
    <div className="activity-summary">
      <div className="activity-status-row">
        <div className={`activity-status ${config.className}`}>
          <span className="activity-status-indicator" />
          <span className="activity-status-label">{config.label}</span>
        </div>
        {activity.currentTool && (
          <Badge variant="primary">{activity.currentTool}</Badge>
        )}
        <span className="activity-time">{formatRelativeTime(activity.timeSinceActivity)}</span>
      </div>

      {activity.lastActions.length > 0 && (
        <div className="activity-actions">
          <span className="activity-actions-label">recent:</span>
          <div className="activity-actions-list">
            {activity.lastActions.map((action, idx) => (
              <span key={idx} className="activity-action">
                {action.toolName ? (
                  <>{formatEventType(action.type)} {action.toolName}</>
                ) : (
                  formatEventType(action.type)
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
