import { EventEmitter } from 'node:events';

// Central catalog of event names — the string is what listeners subscribe
// to, so it lives here once instead of being retyped (and mistyped) at each
// emit()/on() call site.
export const EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  BILLING_RUN_COMPLETED: 'billing.run_completed',
  PAYMENT_RECORDED: 'payment.recorded',
};

// Same globalThis-caching pattern as src/lib/db.js, redis.js and queue.js:
// Next.js dev hot-reload re-executes this module on every edit, and without
// caching the emitter here, that would silently drop every listener
// registered before the reload.
const emitter = globalThis.__events ?? new EventEmitter();
// Unbounded on purpose — this is a fan-out bus, not a single-consumer
// stream, so "many listeners on one event" is the normal case, not a leak.
emitter.setMaxListeners(0);

if (process.env.NODE_ENV !== 'production') {
  globalThis.__events = emitter;
}

export function on(event, listener) {
  emitter.on(event, listener);
}

const LISTENER_TIMEOUT_MS = 5000;

function runListener(listener, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Event listener timed out')), LISTENER_TIMEOUT_MS);
    Promise.resolve()
      .then(() => listener(payload))
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Emitting is best-effort, same philosophy as enqueue() in queue.js: the
// code path that triggered the event (e.g. signup) must never fail or hang
// because a listener did. Listeners run concurrently and are isolated from
// each other — one failing/timing out doesn't stop or fail the others.
export async function emit(event, payload) {
  const listeners = emitter.listeners(event);
  if (listeners.length === 0) return;

  const results = await Promise.allSettled(listeners.map((listener) => runListener(listener, payload)));
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`Event listener for "${event}" failed:`, result.reason?.message ?? result.reason);
    }
  }
}
