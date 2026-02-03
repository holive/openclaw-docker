// agent status - running, completed, error, or stuck (derived from no activity for 5+ min)
export type AgentStatus = 'running' | 'completed' | 'error' | 'stuck';

// agent data from the api
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  lastActivityAt: string;
  errorCount: number;
  lastError: string | null;
  isStuck: boolean;
}

// event data from the api
export interface Event {
  id: number;
  agentId: string;
  timestamp: string;
  type: string;
  toolName: string | null;
  durationMs: number | null;
  success: boolean | null;
  error: string | null;
  params: Record<string, unknown> | null;
}

// api response for agents list
export interface AgentsResponse {
  agents: Agent[];
  meta: {
    count: number;
    lastUpdated: string;
  };
}

// api response for single agent
export interface AgentResponse {
  agent: Agent & { eventCount: number };
}

// api response for events list
export interface EventsResponse {
  events: Event[];
  meta: {
    count: number;
    totalCount: number;
    limit: number;
  };
}

// api response for health check
export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

// session boundary marker for visual separation between sessions
export interface SessionBoundary {
  type: 'session-boundary';
  gapMinutes: number;
  previousTimestamp: string;
  nextTimestamp: string;
}

// union type for event list items (events or session boundaries)
export type EventListItem = Event | SessionBoundary;

// type guard for session boundary
export function isSessionBoundary(item: EventListItem): item is SessionBoundary {
  return (item as SessionBoundary).type === 'session-boundary';
}
