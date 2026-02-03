import { useState, useMemo } from 'react';
import type { Agent, AgentStatus } from '../types';
import { AgentCard } from './AgentCard';
import { Panel, Button } from '../ui';
import './AgentList.css';

interface AgentListProps {
  agents: Agent[];
  loading: boolean;
  onSelect: (agentId: string) => void;
  selectedId: string | null;
}

// sort options
type SortOption = 'newest' | 'oldest' | 'status' | 'errors';

// filter options
type FilterOption = 'all' | 'running' | 'completed' | 'errors';

// status priority for sorting by status
const STATUS_PRIORITY: Record<AgentStatus, number> = {
  running: 0,
  stuck: 1,
  error: 2,
  completed: 3,
};

// loading skeleton placeholder
function LoadingSkeleton() {
  return (
    <div className="agent-list-grid">
      {[1, 2, 3].map((i) => (
        <Panel key={i} className="agent-card-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-light" />
            <div className="skeleton-name" />
          </div>
          <div className="skeleton-meta">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
          <div className="skeleton-footer">
            <div className="skeleton-badge" />
          </div>
        </Panel>
      ))}
    </div>
  );
}

// empty state when no agents
function EmptyState() {
  return (
    <div className="agent-list-empty">
      <div className="agent-list-empty-icon">[  ]</div>
      <h3 className="agent-list-empty-title">no agents found</h3>
      <p className="agent-list-empty-message">
        waiting for agent activity. agents will appear here when they start running.
      </p>
    </div>
  );
}

export function AgentList({ agents, loading, onSelect, selectedId }: AgentListProps) {
  // local state for search, sort, and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');

  // compute filter counts
  const filterCounts = useMemo(() => {
    const counts = {
      all: agents.length,
      running: 0,
      completed: 0,
      errors: 0,
    };

    agents.forEach((agent) => {
      if (agent.status === 'running') counts.running++;
      if (agent.status === 'completed') counts.completed++;
      if (agent.errorCount > 0 || agent.status === 'error') counts.errors++;
    });

    return counts;
  }, [agents]);

  // apply filtering and sorting
  const filteredAndSortedAgents = useMemo(() => {
    let result = [...agents];

    // apply search filter (case-insensitive on name or id)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.id.toLowerCase().includes(query)
      );
    }

    // apply status filter
    if (filterOption === 'running') {
      result = result.filter((agent) => agent.status === 'running');
    } else if (filterOption === 'completed') {
      result = result.filter((agent) => agent.status === 'completed');
    } else if (filterOption === 'errors') {
      result = result.filter(
        (agent) => agent.errorCount > 0 || agent.status === 'error'
      );
    }

    // apply sorting
    result.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        case 'oldest':
          return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        case 'status':
          return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        case 'errors':
          return b.errorCount - a.errorCount;
        default:
          return 0;
      }
    });

    return result;
  }, [agents, searchQuery, filterOption, sortOption]);

  // show loading skeleton on initial load
  if (loading && agents.length === 0) {
    return <LoadingSkeleton />;
  }

  // show empty state if no agents
  if (agents.length === 0) {
    return <EmptyState />;
  }

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'newest' },
    { value: 'oldest', label: 'oldest' },
    { value: 'status', label: 'status' },
    { value: 'errors', label: 'errors' },
  ];

  const filterOptions: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'all' },
    { value: 'running', label: 'running' },
    { value: 'completed', label: 'completed' },
    { value: 'errors', label: 'errors' },
  ];

  return (
    <div className="agent-list-container">
      {/* toolbar row */}
      <div className="agent-list-toolbar">
        <div className="agent-list-toolbar-left">
          <input
            type="text"
            className="agent-list-search"
            placeholder="search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="agent-list-toolbar-right">
          <span className="agent-list-sort-label">sort:</span>
          <div className="agent-list-sort-buttons">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={sortOption === option.value ? 'primary' : 'ghost'}
                onClick={() => setSortOption(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* filter tabs */}
      <div className="agent-list-filters">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            className={`agent-list-filter-tab ${filterOption === option.value ? 'agent-list-filter-tab--active' : ''}`}
            onClick={() => setFilterOption(option.value)}
          >
            {option.label} ({filterCounts[option.value]})
          </button>
        ))}
      </div>

      {/* result count */}
      <div className="agent-list-result-count">
        showing {filteredAndSortedAgents.length} of {agents.length} agents
      </div>

      {/* agent grid or filtered empty state */}
      {filteredAndSortedAgents.length === 0 ? (
        <div className="agent-list-no-results">
          <div className="agent-list-no-results-text">no agents match the current filters</div>
        </div>
      ) : (
        <div className="agent-list-grid">
          {filteredAndSortedAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={agent.id === selectedId}
              onClick={() => onSelect(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
