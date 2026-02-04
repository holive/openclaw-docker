import type Database from 'better-sqlite3';
import type { TelemetryEvent } from '../telemetry/types.js';
import { config } from '../config.js';

// agent status types
export type AgentStatus = 'running' | 'completed' | 'error';

// derived status for more granular agent state
export type DerivedStatus = 'thinking' | 'tooling' | 'executing' | 'waiting' | 'idle' | 'error' | 'stuck';

// activity info for activity summary
export interface ActivityInfo {
  derivedStatus: DerivedStatus;
  currentTool: string | null;
  lastActions: { type: string; toolName: string | null; timestamp: string }[];
  timeSinceActivity: number; // milliseconds
}

// agent record from database
export interface AgentRow {
  id: string;
  name: string;
  status: AgentStatus;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  error_count: number;
  last_error: string | null;
  created_at: string;
  is_stuck?: number;
}

// event record from database
export interface EventRow {
  id: number;
  agent_id: string;
  timestamp: string;
  type: string;
  tool_name: string | null;
  duration_ms: number | null;
  success: number | null;
  error_message: string | null;
  raw_json: string | null;
  created_at: string;
}

// llm event record from database
export interface LlmEventRow {
  id: number;
  agent_id: string;
  timestamp: string;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_tokens: number | null;
  duration_ms: number | null;
  cost_usd: number | null;
  created_at: string;
}

// api response types
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus | 'stuck';
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  lastActivityAt: string;
  errorCount: number;
  lastError: string | null;
  isStuck: boolean;
}

export interface AgentWithEventCount extends Agent {
  eventCount: number;
}

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

// database stats
export interface DbStats {
  agentCount: number;
  eventCount: number;
  runningAgents: number;
  stuckAgents: number;
}

// llm usage stats for an agent
export interface LlmStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  totalCostUsd: number;
  callCount: number;
  models: string[];
  available: boolean;  // false when no llm.usage events exist (openclaw doesn't emit them yet)
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

// data for upserting an agent
export interface AgentUpsert {
  name: string;
  startedAt: string;
}

// eventstore class for all database operations
export class EventStore {
  private db: Database.Database;
  private stmts: Map<string, Database.Statement> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    // get all agents with is_stuck calculation
    this.stmts.set('getAllAgents', this.db.prepare(`
      SELECT
        *,
        CASE
          WHEN status = 'running'
          AND datetime(last_activity_at) < datetime('now', '-5 minutes')
          THEN 1
          ELSE 0
        END as is_stuck
      FROM agents
      ORDER BY started_at DESC
    `));

    // get single agent with is_stuck
    this.stmts.set('getAgent', this.db.prepare(`
      SELECT
        *,
        CASE
          WHEN status = 'running'
          AND datetime(last_activity_at) < datetime('now', '-5 minutes')
          THEN 1
          ELSE 0
        END as is_stuck
      FROM agents
      WHERE id = ?
    `));

    // get event count for agent
    this.stmts.set('getEventCount', this.db.prepare(`
      SELECT COUNT(*) as count FROM events WHERE agent_id = ?
    `));

    // get events for agent
    this.stmts.set('getEventsForAgent', this.db.prepare(`
      SELECT * FROM events
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `));

    // get events for agent in ascending order (for derivation processing)
    this.stmts.set('getEventsForAgentAsc', this.db.prepare(`
      SELECT * FROM events
      WHERE agent_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `));

    // insert event
    this.stmts.set('insertEvent', this.db.prepare(`
      INSERT INTO events (agent_id, timestamp, type, tool_name, duration_ms, success, error_message, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `));

    // upsert agent (insert or update on conflict)
    this.stmts.set('upsertAgent', this.db.prepare(`
      INSERT INTO agents (id, name, status, started_at, last_activity_at)
      VALUES (?, ?, 'running', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        status = 'running',
        started_at = excluded.started_at,
        last_activity_at = excluded.last_activity_at
    `));

    // update agent status
    this.stmts.set('updateAgentStatus', this.db.prepare(`
      UPDATE agents
      SET status = ?, ended_at = datetime('now'), last_activity_at = datetime('now')
      WHERE id = ?
    `));

    // update agent status with error
    this.stmts.set('updateAgentStatusError', this.db.prepare(`
      UPDATE agents
      SET status = ?, ended_at = datetime('now'), last_activity_at = datetime('now'),
          error_count = error_count + 1, last_error = ?
      WHERE id = ?
    `));

    // update agent activity
    this.stmts.set('updateAgentActivity', this.db.prepare(`
      UPDATE agents
      SET last_activity_at = datetime('now')
      WHERE id = ?
    `));

    // increment error count
    this.stmts.set('incrementErrorCount', this.db.prepare(`
      UPDATE agents
      SET error_count = error_count + 1, last_error = ?
      WHERE id = ?
    `));

    // prune old events
    this.stmts.set('pruneEvents', this.db.prepare(`
      DELETE FROM events
      WHERE datetime(timestamp) < datetime('now', ? || ' hours')
    `));

    // prune old agents (only completed/error ones older than retention)
    this.stmts.set('pruneAgents', this.db.prepare(`
      DELETE FROM agents
      WHERE status IN ('completed', 'error')
      AND datetime(ended_at) < datetime('now', ? || ' hours')
    `));

    // count agents
    this.stmts.set('countAgents', this.db.prepare(`
      SELECT COUNT(*) as count FROM agents
    `));

    // count events
    this.stmts.set('countEvents', this.db.prepare(`
      SELECT COUNT(*) as count FROM events
    `));

    // count running agents
    this.stmts.set('countRunningAgents', this.db.prepare(`
      SELECT COUNT(*) as count FROM agents WHERE status = 'running'
    `));

    // count stuck agents
    this.stmts.set('countStuckAgents', this.db.prepare(`
      SELECT COUNT(*) as count FROM agents
      WHERE status = 'running'
      AND datetime(last_activity_at) < datetime('now', '-5 minutes')
    `));

    // insert llm event
    this.stmts.set('insertLlmEvent', this.db.prepare(`
      INSERT INTO llm_events (agent_id, timestamp, provider, model, input_tokens, output_tokens, cache_tokens, duration_ms, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `));

    // get llm stats for agent
    this.stmts.set('getLlmStats', this.db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(cache_tokens), 0) as total_cache_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        COUNT(*) as call_count
      FROM llm_events
      WHERE agent_id = ?
    `));

    // get distinct models for agent
    this.stmts.set('getLlmModels', this.db.prepare(`
      SELECT DISTINCT model FROM llm_events
      WHERE agent_id = ? AND model IS NOT NULL
    `));

    // get tool stats for agent (tool.end events for success/error tracking)
    this.stmts.set('getToolStats', this.db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count
      FROM events
      WHERE agent_id = ? AND type = 'tool.end'
    `));

    // count total tool invocations (tool.start events) - works even without tool.end
    this.stmts.set('getToolStartCount', this.db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE agent_id = ? AND type = 'tool.start'
    `));

    // get most used tools for agent (from tool.start, since tool.end may not exist)
    this.stmts.set('getMostUsedTools', this.db.prepare(`
      SELECT tool_name as name, COUNT(*) as count
      FROM events
      WHERE agent_id = ? AND type = 'tool.start' AND tool_name IS NOT NULL
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 5
    `));

    // get recent errors for agent
    this.stmts.set('getRecentErrors', this.db.prepare(`
      SELECT error_message as message, tool_name as tool, timestamp
      FROM events
      WHERE agent_id = ? AND success = 0 AND error_message IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `));

    // count errors for agent
    this.stmts.set('countErrors', this.db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE agent_id = ? AND success = 0
    `));

    // prune old llm events
    this.stmts.set('pruneLlmEvents', this.db.prepare(`
      DELETE FROM llm_events
      WHERE datetime(timestamp) < datetime('now', ? || ' hours')
    `));

    // get recent events for activity info (last 20 events)
    this.stmts.set('getRecentEventsForActivity', this.db.prepare(`
      SELECT type, tool_name, timestamp
      FROM events
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `));

    // get most recent llm event timestamp
    this.stmts.set('getLastLlmEvent', this.db.prepare(`
      SELECT timestamp FROM llm_events
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `));

    // check for open tool (tool.start without matching tool.end)
    // this query finds tool.start events where the tool_name doesn't have a subsequent tool.end
    this.stmts.set('getOpenTool', this.db.prepare(`
      SELECT e1.tool_name, e1.timestamp
      FROM events e1
      WHERE e1.agent_id = ? AND e1.type = 'tool.start'
      AND NOT EXISTS (
        SELECT 1 FROM events e2
        WHERE e2.agent_id = e1.agent_id
        AND e2.type = 'tool.end'
        AND e2.tool_name = e1.tool_name
        AND e2.timestamp > e1.timestamp
      )
      ORDER BY e1.timestamp DESC
      LIMIT 1
    `));
  }

  // normalize sqlite datetime to ISO format with UTC indicator
  // sqlite datetime('now') returns "2026-02-03 08:22:45" (UTC but no Z suffix)
  // javascript Date() interprets this as local time without the Z
  private normalizeDateTime(sqliteDateTime: string | null): string | null {
    if (!sqliteDateTime) return null;
    // already has timezone info (ISO format from telemetry)
    if (sqliteDateTime.includes('T') || sqliteDateTime.includes('Z')) {
      return sqliteDateTime;
    }
    // sqlite format "YYYY-MM-DD HH:MM:SS" -> ISO "YYYY-MM-DDTHH:MM:SSZ"
    return sqliteDateTime.replace(' ', 'T') + 'Z';
  }

  // convert database row to api agent format
  private rowToAgent(row: AgentRow): Agent {
    const startedAt = this.normalizeDateTime(row.started_at) || row.started_at;
    const endedAt = this.normalizeDateTime(row.ended_at);
    const lastActivityAt = this.normalizeDateTime(row.last_activity_at) || row.last_activity_at;

    const now = new Date().getTime();
    const startedAtMs = new Date(startedAt).getTime();
    const endedAtMs = endedAt ? new Date(endedAt).getTime() : null;
    const durationMs = endedAtMs ? endedAtMs - startedAtMs : now - startedAtMs;
    const isStuck = row.is_stuck === 1;

    return {
      id: row.id,
      name: row.name,
      status: isStuck ? 'stuck' : row.status,
      startedAt,
      endedAt,
      durationMs,
      lastActivityAt,
      errorCount: row.error_count,
      lastError: row.last_error,
      isStuck,
    };
  }

  // convert database row to api event format
  private rowToEvent(row: EventRow): Event {
    // extract params from raw_json if available (for tool.start events)
    let params: Record<string, unknown> | null = null;
    if (row.raw_json) {
      try {
        const parsed = JSON.parse(row.raw_json);
        if (parsed.params) {
          params = parsed.params;
        }
      } catch {
        // ignore parse errors
      }
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      timestamp: row.timestamp,
      type: row.type,
      toolName: row.tool_name,
      durationMs: row.duration_ms,
      success: row.success === null ? null : row.success === 1,
      error: row.error_message,
      params,
    };
  }

  // get all agents
  getAllAgents(): Agent[] {
    const stmt = this.stmts.get('getAllAgents')!;
    const rows = stmt.all() as AgentRow[];
    return rows.map(row => this.rowToAgent(row));
  }

  // get single agent by id
  getAgent(id: string): Agent | null {
    const stmt = this.stmts.get('getAgent')!;
    const row = stmt.get(id) as AgentRow | undefined;
    return row ? this.rowToAgent(row) : null;
  }

  // get agent with event count
  getAgentWithEventCount(id: string): AgentWithEventCount | null {
    const agent = this.getAgent(id);
    if (!agent) return null;

    const stmt = this.stmts.get('getEventCount')!;
    const result = stmt.get(id) as { count: number };
    return { ...agent, eventCount: result.count };
  }

  // get events for an agent
  getEventsForAgent(agentId: string, limit?: number): Event[] {
    const effectiveLimit = Math.min(limit ?? config.eventLimit, config.maxEventLimit);
    const stmt = this.stmts.get('getEventsForAgent')!;
    const rows = stmt.all(agentId, effectiveLimit) as EventRow[];
    return rows.map(row => this.rowToEvent(row));
  }

  // get events with derived data (duration and success inference for tool.start events)
  // since openclaw doesn't emit tool.end events, we derive:
  // - duration: from the gap between tool.start and the next event
  // - success: from the agent.end event status (if agent succeeded, tools likely succeeded)
  getEventsWithDerivedData(agentId: string, limit?: number): Event[] {
    const effectiveLimit = Math.min(limit ?? config.eventLimit, config.maxEventLimit);

    // get events in ascending order for processing
    const stmtAsc = this.stmts.get('getEventsForAgentAsc')!;
    const rowsAsc = stmtAsc.all(agentId, effectiveLimit) as EventRow[];
    const eventsAsc = rowsAsc.map(row => this.rowToEvent(row));

    // find agent.end event to determine overall success
    const agentEndEvent = eventsAsc.find(e => e.type === 'agent.end');
    const agentSucceeded = agentEndEvent?.success === true;

    // process events to derive missing data
    const enrichedEvents: Event[] = [];

    for (let i = 0; i < eventsAsc.length; i++) {
      const event = eventsAsc[i];
      const nextEvent = eventsAsc[i + 1];

      // check if this is a tool.start without corresponding tool.end data
      if (event.type === 'tool.start' && event.durationMs === null) {
        const derived: Event['derived'] = {};

        // derive duration from next event timestamp
        if (nextEvent) {
          const currentTs = new Date(event.timestamp).getTime();
          const nextTs = new Date(nextEvent.timestamp).getTime();
          const derivedDuration = nextTs - currentTs;

          // only use derived duration if it's positive and reasonable (< 5 minutes)
          if (derivedDuration > 0 && derivedDuration < 300000) {
            event.durationMs = derivedDuration;
            derived.durationFromNextEvent = true;
          }
        }

        // infer success from agent.end if we don't have tool.end
        if (event.success === null && agentSucceeded !== undefined) {
          event.success = agentSucceeded;
          derived.successFromAgentEnd = true;
        }

        if (derived.durationFromNextEvent || derived.successFromAgentEnd) {
          event.derived = derived;
        }
      }

      enrichedEvents.push(event);
    }

    // return in descending order (most recent first) as expected by the UI
    return enrichedEvents.reverse();
  }

  // get total event count for an agent
  getEventCountForAgent(agentId: string): number {
    const stmt = this.stmts.get('getEventCount')!;
    const result = stmt.get(agentId) as { count: number };
    return result.count;
  }

  // insert a telemetry event into the database
  insertEvent(event: TelemetryEvent): void {
    if (!event.agentId) return;

    const timestamp = new Date(event.ts).toISOString();
    let toolName: string | null = null;
    let durationMs: number | null = null;
    let success: number | null = null;
    let errorMessage: string | null = null;

    if (event.type === 'tool.start' || event.type === 'tool.end') {
      toolName = event.toolName;
    }

    if (event.type === 'tool.end') {
      durationMs = event.durationMs ?? null;
      success = event.success ? 1 : 0;
      errorMessage = event.error ?? null;
    }

    if (event.type === 'message.out') {
      success = event.success ? 1 : 0;
      errorMessage = event.error ?? null;
    }

    if (event.type === 'agent.end') {
      durationMs = event.durationMs ?? null;
      success = event.success ? 1 : 0;
      errorMessage = event.error ?? null;
    }

    const stmt = this.stmts.get('insertEvent')!;
    stmt.run(
      event.agentId,
      timestamp,
      event.type,
      toolName,
      durationMs,
      success,
      errorMessage,
      JSON.stringify(event)
    );
  }

  // upsert an agent (create or update)
  upsertAgent(agentId: string, data: AgentUpsert): void {
    const stmt = this.stmts.get('upsertAgent')!;
    stmt.run(agentId, data.name, data.startedAt, data.startedAt);
  }

  // update agent status (completed or error)
  updateAgentStatus(agentId: string, status: AgentStatus, error?: string): void {
    if (error) {
      const stmt = this.stmts.get('updateAgentStatusError')!;
      stmt.run(status, error, agentId);
    } else {
      const stmt = this.stmts.get('updateAgentStatus')!;
      stmt.run(status, agentId);
    }
  }

  // update agent last activity timestamp
  updateAgentActivity(agentId: string): void {
    const stmt = this.stmts.get('updateAgentActivity')!;
    stmt.run(agentId);
  }

  // increment error count for an agent
  incrementErrorCount(agentId: string, errorMessage: string): void {
    const stmt = this.stmts.get('incrementErrorCount')!;
    stmt.run(errorMessage, agentId);
  }

  // prune old data (events, llm events, and completed agents)
  pruneOldData(olderThanHours: number = config.retentionHours): number {
    const hoursStr = `-${olderThanHours}`;

    const pruneEvents = this.stmts.get('pruneEvents')!;
    const eventResult = pruneEvents.run(hoursStr);

    const pruneLlm = this.stmts.get('pruneLlmEvents')!;
    const llmResult = pruneLlm.run(hoursStr);

    const pruneAgents = this.stmts.get('pruneAgents')!;
    const agentResult = pruneAgents.run(hoursStr);

    return (eventResult.changes ?? 0) + (llmResult.changes ?? 0) + (agentResult.changes ?? 0);
  }

  // get database statistics
  getStats(): DbStats {
    const countAgents = this.stmts.get('countAgents')!.get() as { count: number };
    const countEvents = this.stmts.get('countEvents')!.get() as { count: number };
    const countRunning = this.stmts.get('countRunningAgents')!.get() as { count: number };
    const countStuck = this.stmts.get('countStuckAgents')!.get() as { count: number };

    return {
      agentCount: countAgents.count,
      eventCount: countEvents.count,
      runningAgents: countRunning.count,
      stuckAgents: countStuck.count,
    };
  }

  // store an llm usage event
  storeLlmEvent(
    agentId: string,
    timestamp: string,
    provider: string | null,
    model: string | null,
    inputTokens: number | null,
    outputTokens: number | null,
    cacheTokens: number | null,
    durationMs: number | null,
    costUsd: number | null
  ): void {
    const stmt = this.stmts.get('insertLlmEvent')!;
    stmt.run(agentId, timestamp, provider, model, inputTokens, outputTokens, cacheTokens, durationMs, costUsd);
  }

  // get llm usage stats for an agent
  // note: llm.usage events require openclaw's diagnostic event hook which isn't implemented yet
  // when callCount is 0, we set available=false to indicate data is unavailable (not just zero)
  getLlmStats(agentId: string): LlmStats {
    const statsStmt = this.stmts.get('getLlmStats')!;
    const stats = statsStmt.get(agentId) as {
      total_input_tokens: number;
      total_output_tokens: number;
      total_cache_tokens: number;
      total_cost_usd: number;
      call_count: number;
    };

    const modelsStmt = this.stmts.get('getLlmModels')!;
    const modelRows = modelsStmt.all(agentId) as { model: string }[];
    const models = modelRows.map(row => row.model);

    // data is only available if we have at least one llm.usage event
    const available = stats.call_count > 0;

    return {
      totalInputTokens: stats.total_input_tokens,
      totalOutputTokens: stats.total_output_tokens,
      totalCacheTokens: stats.total_cache_tokens,
      totalCostUsd: stats.total_cost_usd,
      callCount: stats.call_count,
      models,
      available,
    };
  }

  // get tool usage stats for an agent
  // note: tool.end events require openclaw's after_tool_call hook which isn't implemented yet
  // we count tool.start for total usage, and tool.end for success/error if available
  getToolStats(agentId: string): ToolStats {
    // count tool.start events (actual tool invocations)
    const startCountStmt = this.stmts.get('getToolStartCount')!;
    const startCount = (startCountStmt.get(agentId) as { count: number }).count || 0;

    // count tool.end events (may be 0 if openclaw doesn't emit them)
    const endStatsStmt = this.stmts.get('getToolStats')!;
    const endStats = endStatsStmt.get(agentId) as {
      total_calls: number;
      success_count: number;
      error_count: number;
    };

    const mostUsedStmt = this.stmts.get('getMostUsedTools')!;
    const mostUsed = mostUsedStmt.all(agentId) as { name: string; count: number }[];

    const completedCalls = endStats.total_calls || 0;
    const successCount = endStats.success_count || 0;
    const errorCount = endStats.error_count || 0;

    // success rate is only available if we have tool.end events
    const successRateAvailable = completedCalls > 0;
    const successRate = successRateAvailable ? successCount / completedCalls : null;

    return {
      totalCalls: startCount,
      completedCalls,
      successCount,
      errorCount,
      successRate,
      mostUsed,
      successRateAvailable,
    };
  }

  // get error summary for an agent
  getErrorSummary(agentId: string, limit: number = 5): ErrorSummary {
    const countStmt = this.stmts.get('countErrors')!;
    const countResult = countStmt.get(agentId) as { count: number };

    const recentStmt = this.stmts.get('getRecentErrors')!;
    const recent = recentStmt.all(agentId, limit) as { message: string; tool: string | null; timestamp: string }[];

    return {
      count: countResult.count,
      recent,
    };
  }

  // get combined agent stats
  getAgentStats(agentId: string): AgentStats {
    return {
      llm: this.getLlmStats(agentId),
      tools: this.getToolStats(agentId),
      errors: this.getErrorSummary(agentId),
    };
  }

  // prune old llm events (called during regular pruning)
  pruneLlmEvents(olderThanHours: number = config.retentionHours): number {
    const hoursStr = `-${olderThanHours}`;
    const stmt = this.stmts.get('pruneLlmEvents')!;
    const result = stmt.run(hoursStr);
    return result.changes ?? 0;
  }

  // get activity info for an agent (derived status, current tool, last actions)
  getActivityInfo(agentId: string): ActivityInfo | null {
    const agent = this.getAgent(agentId);
    if (!agent) return null;

    const now = Date.now();
    const lastActivityMs = new Date(agent.lastActivityAt).getTime();
    const timeSinceActivity = now - lastActivityMs;

    // get recent events for last actions
    const recentEventsStmt = this.stmts.get('getRecentEventsForActivity')!;
    const recentEvents = recentEventsStmt.all(agentId) as { type: string; tool_name: string | null; timestamp: string }[];

    const lastActions = recentEvents.slice(0, 3).map(e => ({
      type: e.type,
      toolName: e.tool_name,
      timestamp: e.timestamp,
    }));

    // determine derived status
    let derivedStatus: DerivedStatus;
    let currentTool: string | null = null;

    // if agent has ended
    if (agent.status === 'completed') {
      derivedStatus = 'idle';
    } else if (agent.status === 'error') {
      derivedStatus = 'error';
    } else if (agent.isStuck) {
      derivedStatus = 'stuck';
    } else {
      // agent is running, check for open tools
      const openToolStmt = this.stmts.get('getOpenTool')!;
      const openTool = openToolStmt.get(agentId) as { tool_name: string; timestamp: string } | undefined;

      if (openTool) {
        currentTool = openTool.tool_name;
        // bash tool means executing
        if (openTool.tool_name === 'Bash' || openTool.tool_name === 'bash') {
          derivedStatus = 'executing';
        } else {
          derivedStatus = 'tooling';
        }
      } else {
        // no open tool, check for recent llm activity
        const llmStmt = this.stmts.get('getLastLlmEvent')!;
        const lastLlm = llmStmt.get(agentId) as { timestamp: string } | undefined;

        if (lastLlm) {
          const llmTime = new Date(lastLlm.timestamp).getTime();
          const timeSinceLlm = now - llmTime;
          // if llm event within last 30 seconds and more recent than last regular event
          if (timeSinceLlm < 30000) {
            derivedStatus = 'thinking';
          } else {
            derivedStatus = 'waiting';
          }
        } else {
          derivedStatus = 'waiting';
        }
      }
    }

    return {
      derivedStatus,
      currentTool,
      lastActions,
      timeSinceActivity,
    };
  }
}
