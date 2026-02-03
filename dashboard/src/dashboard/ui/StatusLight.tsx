import type { AgentStatus } from '../types';
import './StatusLight.css';

export type StatusLightSize = 'sm' | 'md' | 'lg';

interface StatusLightProps {
  status: AgentStatus;
  size?: StatusLightSize;
  label?: string;
  showLabel?: boolean;
}

const statusLabels: Record<AgentStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
  stuck: 'Stuck',
};

export function StatusLight({
  status,
  size = 'md',
  label,
  showLabel = false,
}: StatusLightProps) {
  const displayLabel = label || statusLabels[status];

  return (
    <div className={`status-light-container status-light-${size}`}>
      <span
        className={`status-light status-light--${status}`}
        role="status"
        aria-label={displayLabel}
      />
      {showLabel && (
        <span className="status-light-label">{displayLabel}</span>
      )}
    </div>
  );
}
