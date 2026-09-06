# Kuwe Meter

The field app for Kuwe Foundation's water billing system. A meter reader downloads
their round at the office, walks it with no signal, and sends the readings back
when they next have a connection.

It also lets a cashier take money against an account and hand back a receipt.

The billing console in the parent directory remains the authority on everything —
tariffs, cycles, prices, and the arithmetic on every bill. This app captures
readings and payments; it never decides what anybody owes.

## Running it

The console must be running first (`npm run dev` in the parent directory).

```bash
flutter pub get
flutter run
```

The app defaults to `http://10.0.2.2:3000`, which is how an Android emulator
reaches a server on the host machine. On a real handset, tap the address at the
bottom of the sign-in screen and enter the office server's address instead. A
build can also be aimed somewhere else without anyone tapping it in:

```bash
flutter run --dart-define=KUWE_BASE_URL=http://10.0.2.2:3001
```

Sign in with an account holding `capture-readings` (the `meter-reader` role) or
`record-payments` (`cashier`). An account with neither is refused at sign-in
rather than being shown an app it cannot use.

### Test against the sandbox, never the live database

The database behind `npm run dev` is Kuwe's real register. To exercise anything
that writes, build a throwaway copy from the parent directory:

```bash
npm run sandbox:setup    # create + migrate + seed ~41 consumers with history
npm run dev:sandbox      # serves it on http://localhost:3001
```

It seeds three accounts, one per role, so the permission gating can actually be
seen: `admin@sandbox.test`, `reader@sandbox.test`, `cashier@sandbox.test`, all
with the password `password`. `npm run sandbox:reset` starts it over.

## How it fits together

```
lib/
  logic/reading_rules.dart      the meter rules, ported from the server
  logic/round_controller.dart   the round: load, capture, sync
  logic/payments_controller.dart  account lookup and taking money
  logic/session_controller.dart   sign in, restore, sign out
  data/api_client.dart          HTTP + bearer token in secure storage
  data/kuwe_api.dart            the calls this app makes
  data/local_db.dart            the handset's copy of the round
  ui/home_screen.dart           the one Scaffold; tabs come from permissions
  ui/                           sign in, round list, capture, payments
```

### What you see depends on what you may do

`HomeScreen` builds its tabs from the permissions the server returned at
sign-in. A meter reader gets readings only, a cashier gets payments only, and
somebody holding both gets a tab bar. Nobody is shown a screen the server would
refuse them at.

### Offline is the normal case

Every screen renders from the handset's own SQLite database, never straight from
a response. Downloading writes to that database; the list then re-reads it. A
reading is saved locally the moment it is typed and sent as a separate,
deliberate act, because at the meter there is usually nothing to send over.

There is no separate outbox table — a reading waiting to sync is a row with
`pending = 1`. Two tables would mean two truths, and the one thing this app
cannot afford is showing a reader a number different from the one it will send.

A download preserves rows that still hold an unsent reading, so pulling a fresh
round mid-walk does not discard the morning's work.

### The rules are duplicated on purpose

`logic/reading_rules.dart` is a port of `flagReading()` and the guards in
`saveReading()` from the console's `src/lib/billing.js` and `src/lib/readings.js`.
It exists so a reader standing at a meter with no signal is told *now* that a
value is below the previous reading, rather than tomorrow when the sync fails.

The server stays the authority. Nothing in the port relaxes a rule — it only
anticipates one. `test/reading_rules_test.dart` locks the two together; if one of
those tests fails, the port is wrong, not the server.

### Payments are online-only, deliberately

A reading is a fact about a dial: two handsets capturing the same meter reach
the same number, and the server can settle a disagreement by rule. Money is not
like that. Two cashiers holding unsent receipts for one account are each working
from a balance the other has already moved, and the arithmetic only resolves
after both sync — by which time a customer has been told a figure that was wrong
when it was said. So nothing is queued: if the server cannot be reached, no
receipt is given, and the app says so in those words.

The server settles bills oldest-first and returns the balance it arrived at; the
receipt screen shows that number rather than one the handset worked out.

### What the server provides

| Call | Purpose |
| --- | --- |
| `POST /api/auth/login` with `client: "mobile"` | returns the JWT itself, plus roles and permissions |
| `GET /api/mobile/session` | is this stored token still good, and what may this person do |
| `GET /api/mobile/round` | the whole walk in one response: cycle, consumers, previous readings, usage history |
| `POST /api/readings` | the outbox, in one request; answers with what saved and what was rejected |
| `GET /api/mobile/accounts` | account lookup with balances, for either field role |
| `POST /api/payments` | records money taken, and returns the balance it reached |

The browser console authenticates with an httpOnly cookie, which a handset
cannot hold, so `getSessionUser()` on the server also accepts
`Authorization: Bearer <token>`. The token is only ever returned to a client that
asks for it by name.

## Branding

The mark comes from `../public/aquafix-logo.jpg`, and every derived asset is
built from it by a script in the console:

```bash
node ../scripts/build-logo-assets.mjs
```

Re-run that if the source artwork is ever replaced. It writes the app's
`assets/logo*.png`, the legacy launcher bitmaps, and the Android 8+ adaptive
icon foregrounds. The source is a JPEG with the mark flattened onto off-white,
so the script derives real transparency from how far each pixel has travelled
from the paper towards the ink — half-covered edge pixels get a half alpha,
which is what keeps the curves smooth.

The white knockout is used wherever the mark sits on the brand teal; the logo's
own green is kept for light surfaces and the launcher icon.

## Local toolchain notes

Two settings here work around this machine's Android SDK rather than anything
about the app:

- `compileSdk = 36` in `android/app/build.gradle.kts`, and the matching pin for
  plugin subprojects in `android/build.gradle.kts`. The SDK manager installed
  API 37 with `AndroidVersion.ApiLevel=37.0`, so it landed in
  `platforms/android-37.0` and Gradle's lookup for `android-37` fails.
- `flutter_secure_storage` is held at `^10.3.1`; 11.x requires `compileSdk 37`,
  which Android Gradle Plugin 9.0.1 does not support anyway.
- The Gradle wrapper points at `gradle-9.1.0-bin` rather than `-all`, because the
  `-all` download in `~/.gradle/wrapper/dists` is truncated. `-bin` is the same
  Gradle without sources and docs.

Raise these once the toolchain catches up.

## Not built yet

- Meter photos and GPS on a reading
- Zone filtering — `GET /api/mobile/round` accepts `?zone=`, the app does not use it
