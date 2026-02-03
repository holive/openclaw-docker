import { useEffect, useState } from 'react';
import type { Agent, AgentStats } from '../types';
import { useEvents } from '../hooks/useEvents';
import { fetchAgent, fetchAgentStats } from '../api';
import { StatusLight, Panel, Badge, Button } from '../ui';
import { EventList } from './EventList';
import { ActivitySummary } from './ActivitySummary';
import { ToolHistory } from './ToolHistory';
import { ErrorPanel } from './ErrorPanel';
import { ExecHistory } from './ExecHistory';
import './AgentDetail.css';

type DetailTab = 'events' | 'tools' | 'exec';

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

// format token count with k/m suffix
function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
}

// format cost in USD
function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

export function AgentDetail({ agentId, onClose }: AgentDetailProps) {
  const [agent, setAgent] = useState<(Agent & { eventCount: number }) | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('events');
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

  // load agent stats
  useEffect(() => {
    async function loadStats() {
      setStatsLoading(true);
      try {
        const data = await fetchAgentStats(agentId);
        setStats(data);
      } catch {
        // stats are optional, don't show error
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
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

      {/* activity summary for running agents */}
      {agent.status === 'running' && (
        <ActivitySummary agentId={agentId} />
      )}

      {/* stats section */}
      {!statsLoading && stats && (stats.llm.callCount > 0 || stats.tools.totalCalls > 0) && (
        <div className="agent-detail-stats">
          {/* llm usage */}
          {stats.llm.callCount > 0 && (
            <div className="agent-detail-stats-section">
              <h4 className="agent-detail-stats-title">llm usage</h4>
              <div className="agent-detail-stats-grid">
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value">{formatTokens(stats.llm.totalInputTokens)}</span>
                  <span className="agent-detail-stat-label">input tokens</span>
                </div>
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value">{formatTokens(stats.llm.totalOutputTokens)}</span>
                  <span className="agent-detail-stat-label">output tokens</span>
                </div>
                {stats.llm.totalCacheTokens > 0 && (
                  <div className="agent-detail-stat">
                    <span className="agent-detail-stat-value">{formatTokens(stats.llm.totalCacheTokens)}</span>
                    <span className="agent-detail-stat-label">cached</span>
                  </div>
                )}
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value">{formatCost(stats.llm.totalCostUsd)}</span>
                  <span className="agent-detail-stat-label">cost</span>
                </div>
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value">{stats.llm.callCount}</span>
                  <span className="agent-detail-stat-label">api calls</span>
                </div>
              </div>
              {stats.llm.models.length > 0 && (
                <div className="agent-detail-stats-models">
                  {stats.llm.models.map((model) => (
                    <Badge key={model} variant="default">{model}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* tool usage */}
          {stats.tools.totalCalls > 0 && (
            <div className="agent-detail-stats-section">
              <h4 className="agent-detail-stats-title">tool usage</h4>
              <div className="agent-detail-stats-grid">
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value">{stats.tools.totalCalls}</span>
                  <span className="agent-detail-stat-label">total calls</span>
                </div>
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value agent-detail-stat-value--success">{stats.tools.successCount}</span>
                  <span className="agent-detail-stat-label">success</span>
                </div>
                <div className="agent-detail-stat">
                  <span className={`agent-detail-stat-value ${stats.tools.errorCount > 0 ? 'agent-detail-stat-value--error' : ''}`}>
                    {stats.tools.errorCount}
                  </span>
                  <span className="agent-detail-stat-label">errors</span>
                </div>
                <div className="agent-detail-stat">
                  <span className="agent-detail-stat-value">{(stats.tools.successRate * 100).toFixed(0)}%</span>
                  <span className="agent-detail-stat-label">success rate</span>
                </div>
              </div>
              {stats.tools.mostUsed.length > 0 && (
                <div className="agent-detail-stats-tools">
                  <span className="agent-detail-stats-tools-label">most used:</span>
                  {stats.tools.mostUsed.slice(0, 3).map((tool) => (
                    <Badge key={tool.name} variant="default">
                      {tool.name} ({tool.count})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* error panel (replaces simple last-error when stats are loaded) */}
      {!statsLoading && stats && stats.errors.count > 0 ? (
        <ErrorPanel errors={stats.errors} />
      ) : agent.lastError ? (
        <div className="agent-detail-last-error">
          <span className="agent-detail-error-label">last error:</span>
          <span className="agent-detail-error-text">{agent.lastError}</span>
        </div>
      ) : null}

      <div className="agent-detail-events">
        <div className="agent-detail-events-header">
          <div className="agent-detail-tabs">
            <button
              className={`agent-detail-tab ${activeTab === 'events' ? 'agent-detail-tab--active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              events
            </button>
            <button
              className={`agent-detail-tab ${activeTab === 'tools' ? 'agent-detail-tab--active' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              tools
            </button>
            <button
              className={`agent-detail-tab ${activeTab === 'exec' ? 'agent-detail-tab--active' : ''}`}
              onClick={() => setActiveTab('exec')}
            >
              exec
            </button>
          </div>
          {activeTab === 'events' && (
            <Button size="sm" variant="ghost" onClick={refreshEvents} disabled={eventsLoading}>
              {eventsLoading ? 'loading...' : 'refresh'}
            </Button>
          )}
        </div>
        {activeTab === 'events' && (
          <>
            {eventsError && (
              <div className="agent-detail-events-error">{eventsError}</div>
            )}
            <EventList events={events} loading={eventsLoading} />
          </>
        )}
        {activeTab === 'tools' && (
          <ToolHistory agentId={agentId} />
        )}
        {activeTab === 'exec' && (
          <ExecHistory agentId={agentId} />
        )}
      </div>
    </Panel>
  );
}
