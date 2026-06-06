import './types/express-augmentation';

import { createAdapter } from '@socket.io/redis-adapter'; // REDIS-ADAPTER ADDITION
import { createServer } from 'http';
import Redis from 'ioredis'; // REDIS-ADAPTER ADDITION
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { config } from './config/env';
import { redis } from './config/redis';
import app from './app';
import { startReportExportWorker } from './jobs/report-export';

const PORT = Number(config.PORT) || 4000;

// ─── HTTP + Socket.io setup ──────────────────────────────────────────────────

const httpServer = createServer(app);

const allowedOrigins = (config.FRONTEND_URLS ?? config.FRONTEND_URL)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  // Use both polling and WebSocket transports so the handshake works even
  // behind proxies that don't support raw WS upgrades on first connect.
  transports: ['polling', 'websocket'],
});

// REDIS-ADAPTER ADDITION
// Redis adapter for horizontal scaling.
// Skip if Redis is not configured (dev mode with single instance).
let socketRedisPubClient: Redis | null = null;
let socketRedisSubClient: Redis | null = null;
const socketRedisAdapterReady = (async (): Promise<void> => {
  if (process.env.REDIS_URL) {
    try {
      const pubClient = new Redis(config.REDIS_URL, {
        connectTimeout: 5000,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      const subClient = pubClient.duplicate();
      socketRedisPubClient = pubClient;
      socketRedisSubClient = subClient;

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[socket.io] Redis adapter connected - multi-instance scaling enabled');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[socket.io] Redis adapter failed, running without it:', message);
      // Continue without adapter - single instance works fine.
      socketRedisPubClient?.disconnect();
      socketRedisSubClient?.disconnect();
      socketRedisPubClient = null;
      socketRedisSubClient = null;
    }
  } else {
    console.log('[socket.io] No REDIS_URL - running single-instance mode');
  }
})();

// ─── Socket.io connection handler ───────────────────────────────────────────

io.on('connection', async (socket: Socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // REDIS-ADAPTER ADDITION
  // Enforce 1 active socket per user (disconnect old on new connect).
  const socketUser = (socket as Socket & { user?: { id?: string } }).user;
  if (socketUser?.id) {
    try {
      const existingSocketId = await redis.get(`socket:${socketUser.id}`);
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          existingSocket.emit('session_replaced', { message: 'Your session was replaced by a new login' });
          existingSocket.disconnect(true);
        }
      }
      await redis.set(`socket:${socketUser.id}`, socket.id, 'EX', 86400);

      // REDIS-ADAPTER ADDITION
      // Clean up on disconnect.
      socket.on('disconnect', async () => {
        const stored = await redis.get(`socket:${socketUser.id}`);
        if (stored === socket.id) {
          await redis.del(`socket:${socketUser.id}`);
        }
      });
    } catch (err) {
      console.error('[socket.io] Socket connection limit guard failed:', err);
    }
  }

  // Allow clients to subscribe to a named room (e.g. "branch:uuid:host")
  socket.on('join_room', (room: string) => {
    socket.join(room);
    console.log(`   ↳ ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room: string) => {
    socket.leave(room);
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
  });
});

// ─── Start listening ─────────────────────────────────────────────────────────

function logServerStarted(): void {
  console.log(`🚀 Restaurant OS API running on port ${PORT} [${config.NODE_ENV}]`);
  console.log(`   Socket.io listening on ws://localhost:${PORT}`);
}

// REDIS-ADAPTER ADDITION
async function startServer(): Promise<void> {
  await socketRedisAdapterReady;

  // Attempt to listen with a small retry loop on EADDRINUSE. This helps
  // when nodemon restarts quickly and the previous process has not fully
  // released the port yet (transient TCP TIME_WAIT). We retry a few times
  // with backoff before giving up.
  let attemptsLeft = 5;

  function attemptListen() {
    try {
      httpServer.listen(PORT, logServerStarted);
    } catch (err: any) {
      // Rare: listen can throw synchronously on some platforms
      if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        console.warn(`[server] Port ${PORT} in use — retrying in 1s (${attemptsLeft} attempts left)`);
        attemptsLeft -= 1;
        setTimeout(attemptListen, 1000);
        return;
      }
      console.error('Failed to start server:', err);
      throw err;
    }

    // Also handle asynchronous 'error' events emitted by the server
    httpServer.on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        console.warn(`[server] Port ${PORT} in use (async) — retrying in 1s (${attemptsLeft} attempts left)`);
        attemptsLeft -= 1;
        try {
          httpServer.close(() => setTimeout(attemptListen, 1000));
        } catch (_e) {
          setTimeout(attemptListen, 1000);
        }
        return;
      }
      console.error('Server error:', err);
      process.exit(1);
    });
  }

  attemptListen();
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

startReportExportWorker();

// ─── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully…`);

  // Close Socket.io first so clients get a clean disconnect
  io.close();

  httpServer.close(async (err) => {
    if (err) {
      console.error('❌ Error closing HTTP server:', err.message);
      process.exit(1);
    }

    try {
      // REDIS-ADAPTER ADDITION
      await Promise.all([
        socketRedisPubClient?.quit().catch(() => undefined),
        socketRedisSubClient?.quit().catch(() => undefined),
      ]);
      await redis.quit();
      console.log('✅ Redis connection closed.');
    } catch (redisErr) {
      console.error('❌ Error closing Redis:', redisErr);
    }

    console.log('👋 Server shut down cleanly.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('🔥 Unhandled rejection:', reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  const isRedisRetryError = message.includes('MaxRetriesPerRequestError');

  if (isRedisRetryError) {
    console.warn('⚠️  Redis is unavailable. API stays up; Redis-backed features may fail until reconnect.');
    return;
  }

  shutdown('UNHANDLED_REJECTION');
});
