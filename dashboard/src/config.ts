import { homedir } from 'os';
import { join } from 'path';

export const config = {
  port: parseInt(process.env.DASHBOARD_PORT ?? '18790', 10),
  host: '127.0.0.1',

  telemetryPath: process.env.TELEMETRY_PATH ??
    join(homedir(), '.openclaw', 'logs', 'telemetry.jsonl'),

  databasePath: process.env.DATABASE_PATH ??
    join(homedir(), '.openclaw', 'dashboard', 'events.db'),

  logLevel: process.env.LOG_LEVEL ?? 'info',

  // fixed values for mvp
  retentionHours: 24,
  pollIntervalMs: 5000,
  stuckThresholdMs: 5 * 60 * 1000, // 5 minutes
  eventLimit: 100,
  maxEventLimit: 500,
};
