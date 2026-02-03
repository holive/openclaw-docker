import type { TelemetryEvent } from './types.js';

// parse a single jsonl line into a telemetry event
export function parseTelemetryLine(line: string): TelemetryEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed) as TelemetryEvent;

    // validate required base fields
    if (typeof event.ts !== 'number' || typeof event.type !== 'string') {
      return null;
    }

    return event;
  } catch {
    // invalid json, skip line
    return null;
  }
}
