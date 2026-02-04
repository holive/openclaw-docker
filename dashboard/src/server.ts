import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { existsSync } from 'fs';
import { config } from './config.js';
import { initDb, getDb } from './db/index.js';
import { EventStore } from './db/queries.js';
import { TelemetryWatcher } from './telemetry/watcher.js';

// build and configure the fastify server
export async function buildServer(): Promise<FastifyInstance> {
  // initialize database
  initDb();
  const db = getDb();

  // create event store
  const eventStore = new EventStore(db);

  // prune old data on startup
  const pruned = eventStore.pruneOldData();
  if (pruned > 0) {
    console.log(`pruned ${pruned} old records from database`);
  }

  // create fastify instance
  const server = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // create logger wrapper for telemetry watcher
  const watcherLogger = {
    info: (msg: string) => server.log.info(msg),
    warn: (msg: string) => server.log.warn(msg),
    error: (msg: string) => server.log.error(msg),
  };

  // start telemetry watcher
  const watcher = new TelemetryWatcher(eventStore, config.telemetryPath, watcherLogger);
  watcher.start();

  // schedule hourly pruning
  const pruneInterval = setInterval(() => {
    const count = eventStore.pruneOldData();
    if (count > 0) {
      server.log.info(`pruned ${count} old records`);
    }
  }, 60 * 60 * 1000); // every hour

  // cleanup on server close
  server.addHook('onClose', async () => {
    watcher.stop();
    clearInterval(pruneInterval);
  });

  // health check endpoint
  server.get('/api/health', async () => {
    const watcherStatus = watcher.getStatus();
    const stats = eventStore.getStats();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      telemetry: {
        watching: watcherStatus.watching,
        waitingForFile: watcherStatus.waitingForFile,
      },
      database: {
        agents: stats.agentCount,
        events: stats.eventCount,
        running: stats.runningAgents,
        stuck: stats.stuckAgents,
      },
    };
  });

  // list all agents
  server.get('/api/agents', async () => {
    const agents = eventStore.getAllAgents();

    return {
      agents,
      meta: {
        count: agents.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  });

  // get single agent
  server.get<{ Params: { id: string } }>('/api/agents/:id', async (request, reply) => {
    const agent = eventStore.getAgentWithEventCount(request.params.id);

    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found', code: 'AGENT_NOT_FOUND' };
    }

    return { agent };
  });

  // get events for agent
  server.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/api/agents/:id/events', async (request, reply) => {
    // check if agent exists
    const agent = eventStore.getAgent(request.params.id);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found', code: 'AGENT_NOT_FOUND' };
    }

    // parse limit
    const limitParam = request.query.limit;
    let limit = config.eventLimit;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, config.maxEventLimit);
      }
    }

    // use getEventsWithDerivedData to include derived duration/success for tool.start events
    const events = eventStore.getEventsWithDerivedData(request.params.id, limit);
    const totalCount = eventStore.getEventCountForAgent(request.params.id);

    return {
      events,
      meta: {
        count: events.length,
        totalCount,
        limit,
      },
    };
  });

  // get stats for agent (llm usage, tool stats, errors)
  server.get<{ Params: { id: string } }>('/api/agents/:id/stats', async (request, reply) => {
    const agent = eventStore.getAgent(request.params.id);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found', code: 'AGENT_NOT_FOUND' };
    }

    const stats = eventStore.getAgentStats(request.params.id);
    return { stats };
  });

  // get activity info for agent (derived status, current tool, recent actions)
  server.get<{ Params: { id: string } }>('/api/agents/:id/activity', async (request, reply) => {
    const activity = eventStore.getActivityInfo(request.params.id);
    if (!activity) {
      reply.code(404);
      return { error: 'Agent not found', code: 'AGENT_NOT_FOUND' };
    }

    return { activity };
  });

  // serve static dashboard files if built
  const dashboardDist = join(process.cwd(), 'dist', 'dashboard');
  if (existsSync(dashboardDist)) {
    await server.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
    });

    // spa fallback - serve index.html for non-api routes
    server.setNotFoundHandler(async (request, reply) => {
      if (!request.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      reply.code(404);
      return { error: 'Not found' };
    });
  }

  return server;
}
