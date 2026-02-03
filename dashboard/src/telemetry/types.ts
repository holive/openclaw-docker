// telemetry event types from openclaw-telemetry

export type TelemetryEventBase = {
  ts: number;
  seq: number;
  sessionKey?: string;
  agentId?: string;
};

export type TelemetryToolStartEvent = TelemetryEventBase & {
  type: 'tool.start';
  toolName: string;
  params: Record<string, unknown>;
};

export type TelemetryToolEndEvent = TelemetryEventBase & {
  type: 'tool.end';
  toolName: string;
  durationMs?: number;
  success: boolean;
  error?: string;
};

export type TelemetryMessageInEvent = TelemetryEventBase & {
  type: 'message.in';
  channel: string;
  from: string;
  contentLength: number;
};

export type TelemetryMessageOutEvent = TelemetryEventBase & {
  type: 'message.out';
  channel: string;
  to: string;
  success: boolean;
  error?: string;
};

export type TelemetryLlmUsageEvent = TelemetryEventBase & {
  type: 'llm.usage';
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
  durationMs?: number;
  costUsd?: number;
};

export type TelemetryAgentStartEvent = TelemetryEventBase & {
  type: 'agent.start';
  promptLength: number;
};

export type TelemetryAgentEndEvent = TelemetryEventBase & {
  type: 'agent.end';
  success: boolean;
  durationMs?: number;
  error?: string;
};

export type TelemetryEvent =
  | TelemetryToolStartEvent
  | TelemetryToolEndEvent
  | TelemetryMessageInEvent
  | TelemetryMessageOutEvent
  | TelemetryLlmUsageEvent
  | TelemetryAgentStartEvent
  | TelemetryAgentEndEvent;
