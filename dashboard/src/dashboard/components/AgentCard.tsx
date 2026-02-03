import { useEffect, useRef, useState } from 'react';
import type { Agent } from '../types';
import { StatusLight, Panel, Badge } from '../ui';
import './AgentCard.css';

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

// format duration from milliseconds to human readable string
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// format timestamp to locale time string
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// calculate live duration from startedAt to now
function calculateLiveDuration(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  return Math.max(0, now - start);
}

export function AgentCard({ agent, isSelected, onClick }: AgentCardProps) {
  // use stuck status if agent is stuck, otherwise use the actual status
  const displayStatus = agent.isStuck ? 'stuck' : agent.status;

  // track previous state for detecting changes
  const prevAgentRef = useRef<Agent | null>(null);
  const prevErrorCountRef = useRef<number>(agent.errorCount);

  // animation state
  const [statusChanged, setStatusChanged] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);

  // live duration state for running agents
  const [liveDuration, setLiveDuration] = useState<number>(
    agent.status === 'running' ? calculateLiveDuration(agent.startedAt) : agent.durationMs
  );

  // detect status changes and trigger animation
  useEffect(() => {
    const prevAgent = prevAgentRef.current;

    if (prevAgent && prevAgent.status !== agent.status) {
      setStatusChanged(true);
    }

    // detect error count increase
    if (agent.errorCount > prevErrorCountRef.current) {
      setErrorFlash(true);
    }

    // update refs
    prevAgentRef.current = agent;
    prevErrorCountRef.current = agent.errorCount;
  }, [agent]);

  // clear status changed animation after it completes
  useEffect(() => {
    if (!statusChanged) return;

    const timer = setTimeout(() => {
      setStatusChanged(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [statusChanged]);

  // clear error flash animation after it completes
  useEffect(() => {
    if (!errorFlash) return;

    const timer = setTimeout(() => {
      setErrorFlash(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [errorFlash]);

  // live duration counter for running agents
  useEffect(() => {
    if (agent.status !== 'running') {
      // not running, use static duration
      setLiveDuration(agent.durationMs);
      return;
    }

    // set initial live duration
    setLiveDuration(calculateLiveDuration(agent.startedAt));

    // update every second
    const interval = setInterval(() => {
      setLiveDuration(calculateLiveDuration(agent.startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [agent.status, agent.startedAt, agent.durationMs]);

  // build class names
  const cardClasses = [
    'agent-card',
    isSelected ? 'agent-card--selected' : '',
    statusChanged ? 'agent-card--status-changed' : '',
    agent.status === 'running' ? 'agent-card--running' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Panel
      className={cardClasses}
      variant={isSelected ? 'raised' : 'default'}
    >
      <button
        className="agent-card-button"
        onClick={onClick}
        aria-pressed={isSelected}
      >
        <div className="agent-card-header">
          <StatusLight status={displayStatus} size="md" />
          <span className="agent-card-name">{agent.name || agent.id}</span>
          {agent.status === 'running' && (
            <span className="agent-card-activity" aria-label="active" />
          )}
        </div>

        <div className="agent-card-meta">
          <div className="agent-card-time">
            <span className="agent-card-label">started:</span>
            <span className="agent-card-value">{formatTime(agent.startedAt)}</span>
          </div>
          <div className="agent-card-duration">
            <span className="agent-card-label">duration:</span>
            <span className={`agent-card-value ${agent.status === 'running' ? 'agent-card-value--live' : ''}`}>
              {formatDuration(liveDuration)}
            </span>
          </div>
        </div>

        <div className="agent-card-footer">
          <StatusLight status={displayStatus} size="sm" showLabel />
          {agent.errorCount > 0 && (
            <span className={errorFlash ? 'agent-card--error-flash' : ''}>
              <Badge variant="danger">{agent.errorCount} errors</Badge>
            </span>
          )}
        </div>

        {agent.lastError && (
          <div className="agent-card-error">
            <span className="agent-card-error-label">last error:</span>
            <span className="agent-card-error-message">{agent.lastError}</span>
          </div>
        )}
      </button>
    </Panel>
  );
}
