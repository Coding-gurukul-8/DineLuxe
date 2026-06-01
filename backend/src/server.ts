// <reference path="./types/express.d.ts" />
import { createServer } from 'http';
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

// ─── Socket.io connection handler ───────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

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

httpServer.listen(PORT, () => {
  console.log(`🚀 Restaurant OS API running on port ${PORT} [${config.NODE_ENV}]`);
  console.log(`   Socket.io listening on ws://localhost:${PORT}`);
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
