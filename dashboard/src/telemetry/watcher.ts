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

  // handle a single telemetry event
  private handleEvent(event: TelemetryEvent): void {
    // skip events without agent id
    if (!event.agentId) {
      return;
    }

    const timestamp = new Date(event.ts).toISOString();

    switch (event.type) {
      case 'agent.start':
        // create or update agent with running status
        this.eventStore.upsertAgent(event.agentId, {
          name: this.deriveAgentName(event.agentId, event.sessionKey),
          startedAt: timestamp,
        });
        // do not store agent.start as an event per architecture spec
        break;

      case 'agent.end': {
        // update agent status based on success
        const status = event.success ? 'completed' : 'error';
        this.eventStore.updateAgentStatus(event.agentId, status, event.error);
        // store the event
        this.eventStore.insertEvent(event);
        break;
      }

      case 'tool.start':
      case 'tool.end':
        // update agent activity and store event
        this.eventStore.updateAgentActivity(event.agentId);
        this.eventStore.insertEvent(event);

        // if tool.end has error, increment error count
        if (event.type === 'tool.end' && !event.success && event.error) {
          this.eventStore.incrementErrorCount(event.agentId, event.error);
        }
        break;

      case 'message.in':
      case 'message.out':
        // update agent activity and store event
        this.eventStore.updateAgentActivity(event.agentId);
        this.eventStore.insertEvent(event);

        // if message.out has error, increment error count
        if (event.type === 'message.out' && !event.success && event.error) {
          this.eventStore.incrementErrorCount(event.agentId, event.error);
        }
        break;

      case 'llm.usage':
        // store llm usage event for token tracking
        this.eventStore.updateAgentActivity(event.agentId);
        this.eventStore.storeLlmEvent(
          event.agentId,
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
