import type Database from 'better-sqlite3';

// create database schema - agents and events tables with indexes
export function createSchema(db: Database.Database): void {
  // agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'error')),
      started_at TEXT NOT NULL,
      ended_at TEXT,
      last_activity_at TEXT NOT NULL,
      error_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      tool_name TEXT,
      duration_ms INTEGER,
      success INTEGER,
      error_message TEXT,
      raw_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `);

  // indexes for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_started_at ON agents(started_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_agent_id ON events(agent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);
}
