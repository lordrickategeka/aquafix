import { Queue } from 'bullmq';
import redis from './redis';

export const QUEUE_NAME = 'default';

// Same globalThis-caching pattern as src/lib/db.js and src/lib/redis.js, to
// survive dev hot-reload without piling up connections.
const queue = globalThis.__queue ?? new Queue(QUEUE_NAME, { connection: redis });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__queue = queue;
}

const ENQUEUE_TIMEOUT_MS = 2000;

// Enqueuing is best-effort: a Redis outage must never hang the request that
// triggered it (e.g. signup), so this times out and logs rather than blocking.
export async function enqueue(jobName, data, opts) {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Queue enqueue timed out')), ENQUEUE_TIMEOUT_MS)
    );
    return await Promise.race([queue.add(jobName, data, opts), timeout]);
  } catch (err) {
    console.error(`Failed to enqueue job "${jobName}":`, err.message);
    return null;
  }
}
