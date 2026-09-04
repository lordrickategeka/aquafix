// The one place every listener gets wired to an event. To react to an
// existing event, add a handler file next to this one and register it
// below — src/lib/events.js and the call sites that emit() never need to
// change.
import { on, EVENTS } from '@/lib/events';
import sendWelcomeEmail from './send-welcome-email';
import logUserLogin from './log-user-login';

// Guards against double-registration the same way the emitter itself is
// guarded in src/lib/events.js: dev hot-reload can re-execute this module
// while the cached emitter survives on globalThis, so without this, each
// reload would attach a second copy of every listener.
if (!globalThis.__eventListenersRegistered) {
  on(EVENTS.USER_REGISTERED, sendWelcomeEmail);
  on(EVENTS.USER_LOGGED_IN, logUserLogin);

  globalThis.__eventListenersRegistered = true;
}
