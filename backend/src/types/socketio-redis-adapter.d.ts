declare module '@socket.io/redis-adapter' {
  import type { Redis } from 'ioredis';
  export function createAdapter(pubClient: Redis, subClient: Redis): any;
}
