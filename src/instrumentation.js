// Registers every event listener once, before the server accepts requests —
// see src/lib/events.js and src/lib/events/listeners/. Skipped on the edge
// runtime, since the listeners here (mail queueing, etc.) are Node-only.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/events/listeners');
  }
}
