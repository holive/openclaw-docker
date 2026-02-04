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
  derived?: {
    durationFromNextEvent?: boolean;  // duration was derived from next event timestamp
    successFromAgentEnd?: boolean;    // success was inferred from agent.end status
  };
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

// llm usage stats
export interface LlmStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  totalCostUsd: number;
  callCount: number;
  models: string[];
  available: boolean;  // false when llm.usage events are not available from openclaw
}

// tool usage stats
export interface ToolStats {
  totalCalls: number;        // total tool.start events (actual tool invocations)
  completedCalls: number;    // tool.end events (may be 0 if openclaw doesn't emit them)
  successCount: number;
  errorCount: number;
  successRate: number | null;  // null when no tool.end events available
  mostUsed: { name: string; count: number }[];
  successRateAvailable: boolean;  // false when no tool.end events exist
}

// error summary
export interface ErrorSummary {
  count: number;
  recent: { message: string; tool: string | null; timestamp: string }[];
}

// combined agent stats
export interface AgentStats {
  llm: LlmStats;
  tools: ToolStats;
  errors: ErrorSummary;
}

// api response for agent stats
export interface AgentStatsResponse {
  stats: AgentStats;
}

// derived status for more granular agent state
export type DerivedStatus = 'thinking' | 'tooling' | 'executing' | 'waiting' | 'idle' | 'error' | 'stuck';

// activity info for activity summary
export interface ActivityInfo {
  derivedStatus: DerivedStatus;
  currentTool: string | null;
  lastActions: { type: string; toolName: string | null; timestamp: string }[];
  timeSinceActivity: number;
}

// api response for activity info
export interface ActivityInfoResponse {
  activity: ActivityInfo;
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
