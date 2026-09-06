A Next.js + MySQL boilerplate with JWT auth, role/permission-based access control, and
Laravel-equivalent batteries: CSRF protection, rate limiting, a migrations CLI, session
flash messages, pluggable file storage, and a Redis/BullMQ job queue with mail sending.

> This project's Next.js version has some non-standard conventions of its own — notably,
> Middleware is renamed **Proxy** (`src/proxy.js`). See `AGENTS.md` before making changes.

## Prerequisites

- Node.js
- A MySQL server
- A Redis instance — used for rate limiting and the background job queue:
  ```bash
  docker run -d --name dev-redis -p 6379:6379 redis
  ```

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Var | Required | Notes |
|---|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | yes | MySQL connection |
| `JWT_SECRET` | yes | Signs the login session token. Generate one — it's not a value you look up anywhere: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`. Changing it invalidates all existing sessions. |
| `REDIS_URL` | yes | Defaults to `redis://localhost:6379` |
| `MAIL_DRIVER` | no | `log` (default, prints to the worker's console) or `smtp` |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | only if `MAIL_DRIVER=smtp` | Works with any SMTP provider — see [Mail](#mail) |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL_BASE` | only if `STORAGE_DRIVER=s3` | Works with AWS S3, Cloudflare R2, or MinIO — see [File storage](#file-storage) |

Then set up the database and start everything:

```bash
npm run migrate                          # apply DB migrations
npm run seed                             # seed roles (admin, user) and permissions
npm run dev                              # start the app — http://localhost:3000
npm run queue:work                       # start the background job worker (separate terminal)
```

There is no seeded login — `npm run seed` only creates roles and permissions, never users.
To get a first admin account (required to reach `/dashboard/admin`) without going through
the signup form:

```bash
npm run seed:admin -- you@example.com yourpassword
```

It creates the user, hashes the password the same way signup does, and assigns the `admin`
role. Run it again with `--reset-password` if you forget the password. If the account
already exists, `npm run assign-role -- you@example.com admin` just adds the role.

To get one login per role in a single step — useful for trying the console as a reader or
a cashier rather than as an admin:

```bash
npm run seed:users
```

That creates `admin@`, `billing@`, `reader@`, `cashier@` and `staff@aquafix.local`, each
with a different random password printed once when it runs. Pass `--domain` to change the
addresses, or `--password <shared>` if one known password across all five is easier
locally. Re-running leaves existing accounts alone unless you pass `--reset-password`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm run start` | Production build / start |
| `npm run lint` | ESLint |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:status` | List applied/pending migrations |
| `npm run migrate:undo` | Roll back the last migration |
| `npm run seed` | Seed roles/permissions (`admin`, `user`, `billing-officer`, `meter-reader`, `cashier`) |
| `npm run seed:admin -- <email> <password> [role]` | Create a user (default role `admin`); add `--reset-password` to overwrite an existing user's password |
| `npm run seed:users` | Create one user per role with random passwords printed once; `--domain`, `--password`, `--roles`, `--reset-password` |
| `npm run seed:demo [-- --fresh]` | Seed zones, tariffs, ~40 consumers and two billed cycles of demo history |
| `npm run assign-role -- <email> <role>` | Assign a role to an existing user |
| `npm run queue:work` | Start the BullMQ worker that processes background jobs (e.g. sending mail) |

## The billing pipeline

```
Consumer (zone, category, metered | flat-rate)
   └─ per cycle ─→ Reading (previous → current, usage, flag)
                      └─ review exceptions → lock cycle
                           └─ billing run → Bill + lines → ledger debit
                                              └─ Payment → ledger credit → balance
```

- **Cycles** move `open → locked → billed → closed`. Readings are only editable while
  the cycle is open, and locking refuses while exceptions are unresolved (override with
  "lock anyway", which leaves those accounts unbilled).
- **Readings** are flagged automatically (`ok`, `high`, `zero`, `negative`, `missed`) by
  `flagReading()` in `src/lib/billing.js`. Only `approved` readings reach the run; a
  clean reading approves itself, anything else waits for a human.
- **Pricing** lives in `src/lib/billing.js` as pure functions. Bands are progressive and
  cumulative: `(0,5)`, `(5,20)`, `(20,null)`. The sewerage levy applies to consumption
  plus the fixed charge, not to arrears. Unmetered accounts bill at their category's
  `flat_rate`.
- **The run** (`src/lib/billing-run.js`) bills each consumer in its own transaction, so
  one bad account cannot roll back the rest. `UNIQUE(consumer_id, billing_cycle_id)` on
  `bills` makes a re-run skip what already exists instead of double-billing.
- **Money** is whole UGX in `BIGINT` (never floats), and every movement is a row in
  `ledger_entries`. `consumers.balance` is a cache of `SUM(ledger_entries.amount)`
  written in the same transaction; `recomputeBalance()` in `src/lib/ledger.js` repairs it
  if you ever suspect drift. A bill posts only that cycle's charges — the brought-forward
  figure printed on it is already on the account.
- **Bill lines** are frozen copies of how the total was reached, so re-pricing a tariff
  never changes an invoice that has already been issued.

## How it's put together

### Auth

JWT stored in an httpOnly, `sameSite: lax` cookie (`token`) — see `src/lib/auth.js` and
`src/app/api/auth/{signup,login,logout,me}/route.js`. Stateless, no server-side session
store. `src/proxy.js` redirects unauthenticated requests away from `/dashboard/*` and
authenticated users away from `/login`/`/signup`.

### Roles & permissions (RBAC)

Sequelize models (`User`, `Role`, `Permission`) linked via `user_roles` / `role_permissions`
join tables (`src/lib/rbac.js`, `src/lib/authorize.js`). `requireRole('admin')` gates every
route under `src/app/api/admin/*`. The full management UI lives at `/dashboard/admin`
(`src/app/dashboard/admin/`) — create/delete roles and permissions, assign/remove roles on
users, and assign/remove permissions on roles.

### CSRF protection

`src/proxy.js` checks `Sec-Fetch-Site`/`Origin` on every mutating (`POST`/`PUT`/`PATCH`/`DELETE`)
`/api/*` request and rejects cross-site ones with a 403. No token to manage — it layers on
top of the existing cookie, so no client-side changes are needed.

### Rate limiting

Also in `src/proxy.js`, backed by Redis (`src/lib/rate-limit.js`, fixed-window `INCR`/`EXPIRE`).
A strict limit applies to `/api/auth/login` and `/api/auth/signup` (10 req / 5 min per IP);
a general limit applies to the rest of `/api/*` (100 req / min per IP). Returns 429 with a
`Retry-After` header when exceeded. If Redis is unreachable, requests are allowed through
rather than blocked (fail open) — see the Redis section below.

### Flash messages

The Next.js analog of Laravel's session flash. A short-lived `flash` cookie
(`src/lib/flash.js`) is set right before a server-side redirect (login-required redirect,
signup success, logout) and rendered once by `src/components/flash-toast.jsx`, which clears
it via `DELETE /api/flash` after displaying it.

### File storage

`src/lib/storage.js` is a Laravel `Storage::disk()` equivalent — one call site, swappable
backend via `STORAGE_DRIVER`:
- `local` (default) — writes to `storage/uploads/` (outside `public/`, since Next.js won't
  serve files written there after the server has booted) and serves them back through
  `src/app/api/uploads/local/[key]/route.js`.
- `s3` — presigned PUT URLs via `@aws-sdk/client-s3`; works against AWS S3, Cloudflare R2,
  or MinIO (set `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` accordingly).

`POST /api/uploads` (authenticated) returns `{ key, uploadUrl, publicUrl }`; the client then
PUTs the file bytes directly to `uploadUrl`.

### Events

`src/lib/events.js` is the Laravel `Event::dispatch()` equivalent — an in-process pub/sub
bus (`on(event, listener)` / `emit(event, payload)`) so code that triggers something (e.g.
signup) doesn't need to know everything that should happen as a result. Event names are
listed in `EVENTS`; listeners live one-per-file in `src/lib/events/listeners/` and are wired
to an event in `src/lib/events/listeners/index.js`, the only file that needs to change to
add a new one. `src/instrumentation.js` imports that registry once when the server boots.

`emit()` is fail-open like `enqueue()` below: listeners run concurrently, are isolated from
each other (one throwing or taking longer than 5s doesn't stop or fail the others), and never
throw back into the caller — so a broken listener can't fail or hang the request that
triggered it. Keep listeners themselves fast; hand off actual work to the job queue (as
`send-welcome-email` does) rather than doing it inline.

### Queue & background jobs

Redis + BullMQ (`src/lib/queue.js`, `workers/index.js`). `enqueue(jobName, data)` pushes a
job; a separate `npm run queue:work` process consumes it and dispatches to a handler in
`workers/jobs/`. Enqueuing fails open with a 2s timeout, so a Redis outage never hangs the
request that triggered it (e.g. signup) — the job is just silently dropped in that case.

### Mail

`workers/mail.js` is the Laravel `Mail`-facade equivalent, driver-selected by `MAIL_DRIVER`:
- `log` (default) — prints the message to the worker's console. Zero setup, good for local
  dev when you don't care about the actual email content.
- `smtp` — sends for real via `nodemailer`, against any SMTP provider. For local testing,
  [Mailtrap](https://mailtrap.io) works well:
  1. Create a Mailtrap inbox (Email Testing sandbox) and open its SMTP Settings.
  2. Set in `.env.local`:
     ```
     MAIL_DRIVER=smtp
     SMTP_HOST=sandbox.smtp.mailtrap.io
     SMTP_PORT=2525
     SMTP_SECURE=false
     SMTP_USER=<from Mailtrap>
     SMTP_PASSWORD=<from Mailtrap>
     ```
  3. Restart `npm run queue:work` (it loads `.env.local` once at startup) and sign up a user
     — the welcome email lands in the Mailtrap inbox instead of a real mailbox.

Templates are plain functions returning `{ subject, html, text }` (see
`workers/templates/welcome-email.js`) — no template engine dependency.

### Migrations

Umzug-backed (`database/migrate.js`), not a built-in Next.js feature — Next has no
`artisan migrate` equivalent, so this project wires one up via plain scripts:
`npm run migrate` / `migrate:status` / `migrate:undo`, plus `npm run seed` and
`npm run assign-role`.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
