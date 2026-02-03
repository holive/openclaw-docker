import type Database from 'better-sqlite3';
import type { TelemetryEvent } from '../telemetry/types.js';
import { config } from '../config.js';

// agent status types
export type AgentStatus = 'running' | 'completed' | 'error';

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
}

// database stats
export interface DbStats {
  agentCount: number;
  eventCount: number;
  runningAgents: number;
  stuckAgents: number;
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

  // prune old data (events and completed agents)
  pruneOldData(olderThanHours: number = config.retentionHours): number {
    const hoursStr = `-${olderThanHours}`;

    const pruneEvents = this.stmts.get('pruneEvents')!;
    const eventResult = pruneEvents.run(hoursStr);

    const pruneAgents = this.stmts.get('pruneAgents')!;
    const agentResult = pruneAgents.run(hoursStr);

    return (eventResult.changes ?? 0) + (agentResult.changes ?? 0);
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
}
