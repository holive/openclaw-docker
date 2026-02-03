import { useState, useEffect, useCallback } from 'react';
import { useAgents } from './hooks/useAgents';
import { Header } from './components/Header';
import { AgentList } from './components/AgentList';
import { AgentDetail } from './components/AgentDetail';
import './App.css';

// helper to parse agent id from url hash
function getAgentIdFromHash(): string | null {
  const hash = window.location.hash;
  if (hash.startsWith('#agent-')) {
    return hash.slice(7); // remove '#agent-' prefix
  }
  return null;
}

// helper to update url hash
function setHashForAgent(agentId: string | null) {
  if (agentId) {
    window.location.hash = `agent-${agentId}`;
  } else {
    // remove hash without triggering scroll
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

export function App() {
  const { agents, loading, error, lastUpdated, isStale, refresh, clearError } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => getAgentIdFromHash());
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleSelectAgent = (agentId: string) => {
    // toggle selection if clicking same agent
    setSelectedAgentId((prev) => (prev === agentId ? null : agentId));
  };

  const handleCloseDetail = () => {
    setSelectedAgentId(null);
  };

  // update url hash when selected agent changes
  useEffect(() => {
    setHashForAgent(selectedAgentId);
  }, [selectedAgentId]);

  // handle browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      setSelectedAgentId(getAgentIdFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // get sorted agent ids for navigation
  const agentIds = agents.map((a) => a.id);

  // navigate to next/previous agent
  const selectNextAgent = useCallback(() => {
    if (agentIds.length === 0) return;
    if (!selectedAgentId) {
      setSelectedAgentId(agentIds[0]);
      return;
    }
    const currentIndex = agentIds.indexOf(selectedAgentId);
    if (currentIndex < agentIds.length - 1) {
      setSelectedAgentId(agentIds[currentIndex + 1]);
    }
  }, [agentIds, selectedAgentId]);

  const selectPrevAgent = useCallback(() => {
    if (agentIds.length === 0) return;
    if (!selectedAgentId) {
      setSelectedAgentId(agentIds[agentIds.length - 1]);
      return;
    }
    const currentIndex = agentIds.indexOf(selectedAgentId);
    if (currentIndex > 0) {
      setSelectedAgentId(agentIds[currentIndex - 1]);
    }
  }, [agentIds, selectedAgentId]);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ignore shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case 'r':
          refresh();
          break;
        case 'Escape':
          if (showShortcuts) {
            setShowShortcuts(false);
          } else {
            setSelectedAgentId(null);
          }
          break;
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          selectNextAgent();
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          selectPrevAgent();
          break;
        case 'Enter':
          if (!selectedAgentId && agentIds.length > 0) {
            setSelectedAgentId(agentIds[0]);
          }
          break;
        case '?':
          setShowShortcuts((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refresh, selectNextAgent, selectPrevAgent, selectedAgentId, agentIds, showShortcuts]);

  return (
    <div className="app">
      <Header
        onRefresh={refresh}
        loading={loading}
        lastUpdated={lastUpdated}
        isStale={isStale}
        error={error}
        onClearError={clearError}
      />

      <div className="keyboard-hint">
        press <kbd>?</kbd> for shortcuts
      </div>

      {showShortcuts && (
        <div className="shortcuts-modal" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-content" onClick={(e) => e.stopPropagation()}>
            <h3>keyboard shortcuts</h3>
            <ul>
              <li><kbd>r</kbd> refresh agents</li>
              <li><kbd>j</kbd> / <kbd>ArrowDown</kbd> next agent</li>
              <li><kbd>k</kbd> / <kbd>ArrowUp</kbd> previous agent</li>
              <li><kbd>Enter</kbd> select first agent</li>
              <li><kbd>Escape</kbd> close panel / modal</li>
              <li><kbd>?</kbd> toggle shortcuts</li>
            </ul>
            <button onClick={() => setShowShortcuts(false)}>close</button>
          </div>
        </div>
      )}

      <main className="app-content">
        <section className="app-agents">
          <AgentList
            agents={agents}
            loading={loading}
            onSelect={handleSelectAgent}
            selectedId={selectedAgentId}
          />
        </section>

        {selectedAgentId && (
          <aside className="app-detail">
            <AgentDetail
              agentId={selectedAgentId}
              onClose={handleCloseDetail}
            />
          </aside>
        )}
      </main>
    </div>
  );
}
