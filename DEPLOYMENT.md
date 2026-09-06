# Deploying AquaFix

The console is a standard Next.js server plus MySQL. `next start` is the
supported way to self-host it — no special build config, and `src/proxy.js`
works with none.

## 1. HTTPS is not optional

`setSessionCookie()` marks the session cookie `Secure` whenever
`NODE_ENV=production`, and browsers refuse to store a `Secure` cookie that
arrives over plain HTTP. Serve `aquafix.loganate.cc` over TLS or **nobody will
be able to log in** — and the failure is silent: the login request returns 200,
the browser quietly drops the cookie, and the next page bounces back to
`/login` as if the password were wrong.

(`localhost` is exempt in Chrome, which is why this does not show up in local
testing. curl is also lenient. Only a real domain over http reproduces it.)

## 2. Environment

Copy `.env.local.example` and fill it in on the server. It is gitignored, so it
has to be created there — it will not arrive with the push.

| Variable | Notes |
| --- | --- |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | The production MySQL. Use a dedicated user, not root. |
| `JWT_SECRET` | **Generate a fresh one.** Not the development value. `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`. Changing it later signs everyone out, including every handset. |
| `REDIS_URL` | Optional — see below. |
| `MAIL_DRIVER` | `log` unless you have SMTP. |
| `STORAGE_DRIVER` | `local` writes to `storage/uploads`, which must survive deploys. |

Redis backs rate limiting and the background queue. `checkRateLimit()` fails
open behind a 200 ms timeout, so the app still works without it — but every API
request then pays up to 200 ms waiting for a server that is not there. Run
Redis, or accept that tax.

## 3. First deploy

```bash
npm ci
npm run migrate          # creates the database if missing, applies all 10 migrations
npm run seed             # roles and permissions — required before any account exists
npm run build
npm start                # or run it under pm2/systemd
```

Then create the people who will use it. `seed:admin` takes `email password
[role]`; the role must already exist from `npm run seed`:

```bash
npm run seed:admin -- lordrick@example.com 'a-real-password' admin
npm run seed:admin -- reader@example.com   'a-real-password' meter-reader
npm run seed:admin -- cashier@example.com  'a-real-password' cashier
```

Passwords must be at least 8 characters. `-- --reset-password` changes one for
an account that already exists.

## 4. Behind the reverse proxy

Forward `X-Forwarded-For`. `getClientIp()` reads it, and rate limiting keys on
it — without it every request looks like one client and the login limit (10 per
5 minutes) applies to the whole utility at once.

That limit is per IP. If the office is behind one NAT address, several people
signing in at once can trip it; raise `STRICT_LIMIT` in `src/proxy.js` if that
becomes a problem in practice.

## 5. Data

The register, the ledger and every issued invoice live in MySQL. Back it up
before you need to:

```bash
mysqldump --single-transaction --routines water_bill > backup-$(date +%F).sql
```

`consumers.balance` is a cached mirror of `SUM(ledger_entries.amount)`. They
should never disagree; if they ever do, the ledger is the truth:

```sql
SELECT c.account_no, c.balance,
       COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE consumer_id = c.id), 0) AS ledger
FROM consumers c
WHERE c.balance <> COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE consumer_id = c.id), 0);
```

An empty result is the healthy state.

## 6. The field app

`mobile/` builds against whatever host it is given at build time:

```bash
cd mobile
flutter build apk --release --dart-define=KUWE_BASE_URL=https://aquafix.loganate.cc
```

Without that flag it falls back to `http://10.0.2.2:3000`, the emulator's route
to a development machine — which is right for local work and wrong for anything
handed to a reader.

Signing lives in `android/key.properties` and `android/upload-keystore.jks`.
Both are gitignored and will not arrive with the push, so a build made on
another machine falls back to the debug key. **Keep that keystore.** Android
identifies an app by its signature; an update signed with a different key will
not install over an existing one, and there is no way to recover or reissue it.

## 7. Once it is live

- Log in and set Settings → the organisation name, tagline and bill footer, since
  those print on every bill.
- Check that the tariff schedule attached to the current cycle is the one you
  intend to charge, before running billing for real.
