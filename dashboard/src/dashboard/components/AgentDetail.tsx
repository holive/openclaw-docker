import { useEffect, useState } from 'react';
import type { Agent } from '../types';
import { useEvents } from '../hooks/useEvents';
import { fetchAgent } from '../api';
import { StatusLight, Panel, Badge, Button } from '../ui';
import { EventList } from './EventList';
import './AgentDetail.css';

interface AgentDetailProps {
  agentId: string;
  onClose: () => void;
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

// format timestamp to locale date/time string
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function AgentDetail({ agentId, onClose }: AgentDetailProps) {
  const [agent, setAgent] = useState<(Agent & { eventCount: number }) | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentError, setAgentError] = useState<string | null>(null);
  const { events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useEvents(agentId);

  // load agent details
  useEffect(() => {
    async function loadAgent() {
      setAgentLoading(true);
      try {
        const data = await fetchAgent(agentId);
        setAgent(data);
        setAgentError(null);
      } catch (err) {
        setAgentError(err instanceof Error ? err.message : 'failed to load agent');
      } finally {
        setAgentLoading(false);
      }
    }
    loadAgent();
  }, [agentId]);

  // loading state
  if (agentLoading) {
    return (
      <Panel className="agent-detail">
        <div className="agent-detail-loading">loading agent details...</div>
      </Panel>
    );
  }

  // error state
  if (agentError || !agent) {
    return (
      <Panel className="agent-detail">
        <div className="agent-detail-error">
          <span className="agent-detail-error-message">{agentError || 'agent not found'}</span>
          <Button variant="ghost" onClick={onClose}>close</Button>
        </div>
      </Panel>
    );
  }

  const displayStatus = agent.isStuck ? 'stuck' : agent.status;

  return (
    <Panel className="agent-detail">
      <div className="agent-detail-header">
        <div className="agent-detail-title">
          <StatusLight status={displayStatus} size="lg" />
          <h2 className="agent-detail-name">{agent.name || agent.id}</h2>
        </div>
        <Button variant="ghost" onClick={onClose} title="close detail panel">
          [x]
        </Button>
      </div>

      <div className="agent-detail-info">
        <div className="agent-detail-row">
          <span className="agent-detail-label">id:</span>
          <span className="agent-detail-value agent-detail-value--mono">{agent.id}</span>
        </div>
        <div className="agent-detail-row">
          <span className="agent-detail-label">status:</span>
          <StatusLight status={displayStatus} size="sm" showLabel />
        </div>
        <div className="agent-detail-row">
          <span className="agent-detail-label">started:</span>
          <span className="agent-detail-value">{formatDateTime(agent.startedAt)}</span>
        </div>
        {agent.endedAt && (
          <div className="agent-detail-row">
            <span className="agent-detail-label">ended:</span>
            <span className="agent-detail-value">{formatDateTime(agent.endedAt)}</span>
          </div>
        )}
        <div className="agent-detail-row">
          <span className="agent-detail-label">duration:</span>
          <span className="agent-detail-value">{formatDuration(agent.durationMs)}</span>
        </div>
        <div className="agent-detail-row">
          <span className="agent-detail-label">last activity:</span>
          <span className="agent-detail-value">{formatDateTime(agent.lastActivityAt)}</span>
        </div>
        <div className="agent-detail-row">
          <span className="agent-detail-label">errors:</span>
          <span className="agent-detail-value">
            {agent.errorCount > 0 ? (
              <Badge variant="danger">{agent.errorCount}</Badge>
            ) : (
              <Badge variant="success">0</Badge>
            )}
          </span>
        </div>
        <div className="agent-detail-row">
          <span className="agent-detail-label">events:</span>
          <span className="agent-detail-value">
            <Badge variant="default">{agent.eventCount}</Badge>
          </span>
        </div>
      </div>

      {agent.lastError && (
        <div className="agent-detail-last-error">
          <span className="agent-detail-error-label">last error:</span>
          <span className="agent-detail-error-text">{agent.lastError}</span>
        </div>
      )}

      <div className="agent-detail-events">
        <div className="agent-detail-events-header">
          <h3 className="agent-detail-events-title">events</h3>
          <Button size="sm" variant="ghost" onClick={refreshEvents} disabled={eventsLoading}>
            {eventsLoading ? 'loading...' : 'refresh'}
          </Button>
        </div>
        {eventsError && (
          <div className="agent-detail-events-error">{eventsError}</div>
        )}
        <EventList events={events} loading={eventsLoading} />
      </div>
    </Panel>
  );
}
