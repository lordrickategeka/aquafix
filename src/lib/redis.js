import Redis from 'ioredis';

function createRedis() {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  // Without a listener, ioredis's default behavior is to dump the full
  // AggregateError stack to console on every failed reconnect attempt (every
  // ~2s during an outage). Callers already fail open (see rate-limit.js,
  // queue.js), so this just keeps the log to one line instead of a flood.
  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });
  return client;
}

// Next.js dev hot-reload re-executes this module on every edit; without caching
// on globalThis each reload would open a fresh connection on top of the last
// one, same reason src/lib/db.js caches the Sequelize instance this way.
const redis = globalThis.__redis ?? createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis = redis;
}

export default redis;
