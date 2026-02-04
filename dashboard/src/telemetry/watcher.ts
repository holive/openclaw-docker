import { watch, type FSWatcher } from 'chokidar';
import { readFileSync, statSync, existsSync } from 'fs';
import type { EventStore } from '../db/queries.js';
import { parseTelemetryLine } from './parser.js';
import type { TelemetryEvent } from './types.js';

// simple logger interface compatible with both fastify and console
interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// default console logger
const consoleLogger: Logger = {
  info: (msg: string) => console.log(`[info] ${msg}`),
  warn: (msg: string) => console.warn(`[warn] ${msg}`),
  error: (msg: string) => console.error(`[error] ${msg}`),
};

// telemetry watcher class for tailing the jsonl file
export class TelemetryWatcher {
  private eventStore: EventStore;
  private filePath: string;
  private logger: Logger;
  private lastPosition: number = 0;
  private watcher: FSWatcher | null = null;
  private isWatching: boolean = false;
  private waitingForFile: boolean = false;
  private fileCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    eventStore: EventStore,
    filePath: string,
    logger?: Logger
  ) {
    this.eventStore = eventStore;
    this.filePath = filePath;
    this.logger = logger || consoleLogger;
  }

  // start watching the telemetry file
  start(): void {
    if (this.isWatching) return;

    // check if file exists
    if (!existsSync(this.filePath)) {
      this.logger.warn(`telemetry file not found: ${this.filePath}, waiting for creation...`);
      this.waitForFile();
      return;
    }

    this.startWatching();
  }

  // wait for the file to be created
  private waitForFile(): void {
    if (this.waitingForFile) return;
    this.waitingForFile = true;

    this.fileCheckInterval = setInterval(() => {
      if (existsSync(this.filePath)) {
        this.logger.info(`telemetry file found: ${this.filePath}`);
        if (this.fileCheckInterval) {
          clearInterval(this.fileCheckInterval);
          this.fileCheckInterval = null;
        }
        this.waitingForFile = false;
        this.startWatching();
      }
    }, 5000);
  }

  // start the actual file watcher
  private startWatching(): void {
    // process existing content first (historical data loading)
    this.processNewLines();

    // start watching for changes
    this.watcher = watch(this.filePath, {
      persistent: true,
      usePolling: true,  // more reliable for logs
      interval: 1000,
    });

    this.watcher.on('change', () => {
      this.processNewLines();
    });

    this.watcher.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`watcher error: ${message}`);
    });

    this.isWatching = true;
    this.logger.info(`watching telemetry file: ${this.filePath}`);
  }

  // stop watching the telemetry file
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.fileCheckInterval) {
      clearInterval(this.fileCheckInterval);
      this.fileCheckInterval = null;
    }

    this.isWatching = false;
    this.waitingForFile = false;
  }

  // process new lines from the telemetry file
  private processNewLines(): void {
    try {
      const stats = statSync(this.filePath);
      const fileSize = stats.size;

      // handle file rotation (file smaller than last position)
      if (fileSize < this.lastPosition) {
        this.logger.info('telemetry file rotated, resetting position');
        this.lastPosition = 0;
      }

      // nothing new to read
      if (fileSize === this.lastPosition) {
        return;
      }

      // read new content from last position
      const content = readFileSync(this.filePath, 'utf-8');
      const newContent = content.slice(this.lastPosition);
      this.lastPosition = content.length;

      // process each line
      const lines = newContent.split('\n');
      let processedCount = 0;

      for (const line of lines) {
        const event = parseTelemetryLine(line);
        if (event) {
          this.handleEvent(event);
          processedCount++;
        }
      }

      if (processedCount > 0) {
        this.logger.info(`processed ${processedCount} telemetry events`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`error processing telemetry file: ${message}`);
    }
  }

  // derive a better agent name from sessionKey
  // sessionKey format: agent:{agentId}:{platform}:{type}:{recipient}
  // e.g. "agent:main:discord:channel:123" or "agent:main:telegram:group:456"
  private deriveAgentName(agentId: string, sessionKey?: string): string {
    if (!sessionKey) return `agent ${agentId.slice(0, 8)}`;

    const parts = sessionKey.split(':');
    const platform = parts[2] || 'unknown';

    // webchat/main is generic, just use agentId
    if (platform === 'main' || platform === agentId) {
      return `agent ${agentId}`;
    }

    // platform-specific naming: "main (discord)"
    return `${agentId} (${platform})`;
  }

  // extract agentId from sessionKey if not directly available
  // sessionKey format: agent:{agentId}:{platform}:{type}:{recipient}
  private deriveAgentId(event: TelemetryEvent): string | null {
    if (event.agentId) {
      return event.agentId;
    }

    // try to extract from sessionKey
    if (event.sessionKey) {
      const parts = event.sessionKey.split(':');
      if (parts.length >= 2 && parts[0] === 'agent') {
        return parts[1];
      }
    }

    // fallback: use 'unknown' for events we still want to track
    return 'unknown';
  }

  // ensure agent exists in database (creates if missing)
  // this prevents foreign key constraint errors when events arrive before agent.start
  private ensureAgentExists(agentId: string, sessionKey: string | undefined, timestamp: string): void {
    const existing = this.eventStore.getAgent(agentId);
    if (!existing) {
      this.eventStore.upsertAgent(agentId, {
        name: this.deriveAgentName(agentId, sessionKey),
        startedAt: timestamp,
      });
    }
  }

  // handle a single telemetry event
  private handleEvent(event: TelemetryEvent): void {
    // derive agentId from event or sessionKey
    const agentId = this.deriveAgentId(event);
    if (!agentId) {
      return;
    }

    // use derived agentId for all operations
    const eventWithAgentId = { ...event, agentId };

    const timestamp = new Date(event.ts).toISOString();

    switch (event.type) {
      case 'agent.start':
        // create or update agent with running status
        this.eventStore.upsertAgent(agentId, {
          name: this.deriveAgentName(agentId, event.sessionKey),
          startedAt: timestamp,
        });
        // do not store agent.start as an event per architecture spec
        break;

      case 'agent.end': {
        // ensure agent exists before updating status
        this.ensureAgentExists(agentId, event.sessionKey, timestamp);
        // update agent status based on success
        const status = event.success ? 'completed' : 'error';
        this.eventStore.updateAgentStatus(agentId, status, event.error);
        // store the event with derived agentId
        this.eventStore.insertEvent(eventWithAgentId);
        break;
      }

      case 'tool.start':
      case 'tool.end':
        // ensure agent exists before inserting event (prevents FK constraint error)
        this.ensureAgentExists(agentId, event.sessionKey, timestamp);
        // update agent activity and store event
        this.eventStore.updateAgentActivity(agentId);
        this.eventStore.insertEvent(eventWithAgentId);

        // if tool.end has error, increment error count
        if (event.type === 'tool.end' && !event.success && event.error) {
          this.eventStore.incrementErrorCount(agentId, event.error);
        }
        break;

      case 'message.in':
      case 'message.out':
        // ensure agent exists before inserting event (prevents FK constraint error)
        this.ensureAgentExists(agentId, event.sessionKey, timestamp);
        // update agent activity and store event
        this.eventStore.updateAgentActivity(agentId);
        this.eventStore.insertEvent(eventWithAgentId);

        // if message.out has error, increment error count
        if (event.type === 'message.out' && !event.success && event.error) {
          this.eventStore.incrementErrorCount(agentId, event.error);
        }
        break;

      case 'llm.usage':
        // ensure agent exists before inserting llm event (prevents FK constraint error)
        this.ensureAgentExists(agentId, event.sessionKey, timestamp);
        // store llm usage event for token tracking
        this.eventStore.updateAgentActivity(agentId);
        this.eventStore.storeLlmEvent(
          agentId,
          timestamp,
          event.provider ?? null,
          event.model ?? null,
          event.inputTokens ?? null,
          event.outputTokens ?? null,
          event.cacheTokens ?? null,
          event.durationMs ?? null,
          event.costUsd ?? null
        );
        break;
    }
  }

  // get watcher status
  getStatus(): { watching: boolean; waitingForFile: boolean; lastPosition: number } {
    return {
      watching: this.isWatching,
      waitingForFile: this.waitingForFile,
      lastPosition: this.lastPosition,
    };
  }
}
