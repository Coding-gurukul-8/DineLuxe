"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
// <reference path="./types/express.d.ts" />
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const env_1 = require("./config/env");
const redis_1 = require("./config/redis");
const app_1 = __importDefault(require("./app"));
const PORT = Number(env_1.config.PORT) || 4000;
// ─── HTTP + Socket.io setup ──────────────────────────────────────────────────
const httpServer = (0, http_1.createServer)(app_1.default);
const allowedOrigins = (env_1.config.FRONTEND_URLS ?? env_1.config.FRONTEND_URL)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
exports.io = new socket_io_1.Server(httpServer, {
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
exports.io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    // Allow clients to subscribe to a named room (e.g. "branch:uuid:host")
    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`   ↳ ${socket.id} joined room: ${room}`);
    });
    socket.on('leave_room', (room) => {
        socket.leave(room);
    });
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });
});
// ─── Start listening ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`🚀 Restaurant OS API running on port ${PORT} [${env_1.config.NODE_ENV}]`);
    console.log(`   Socket.io listening on ws://localhost:${PORT}`);
});
// ─── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown(signal) {
    console.log(`\n⚠️  ${signal} received. Shutting down gracefully…`);
    // Close Socket.io first so clients get a clean disconnect
    exports.io.close();
    httpServer.close(async (err) => {
        if (err) {
            console.error('❌ Error closing HTTP server:', err.message);
            process.exit(1);
        }
        try {
            await redis_1.redis.quit();
            console.log('✅ Redis connection closed.');
        }
        catch (redisErr) {
            console.error('❌ Error closing Redis:', redisErr);
        }
        console.log('👋 Server shut down cleanly.');
        process.exit(0);
    });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    console.error('🔥 Unhandled rejection:', reason);
    const message = reason instanceof Error ? reason.message : String(reason);
    const isRedisRetryError = message.includes('MaxRetriesPerRequestError');
    if (isRedisRetryError) {
        console.warn('⚠️  Redis is unavailable. API stays up; Redis-backed features may fail until reconnect.');
        return;
    }
    shutdown('UNHANDLED_REJECTION');
});
//# sourceMappingURL=server.js.map