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
sign-in. A meter reader gets readings only, a cashier gets payments only,
`register-consumers` adds the registration tab, and somebody holding more than
one gets a tab bar. Nobody is shown a screen the server would refuse them at.

| Permission | Tab |
| --- | --- |
| `capture-readings` | Readings |
| `record-payments` | Payments |
| `register-consumers` | Register |

Held by `admin` alone for now — a technician role can be given
`register-consumers` later without touching this app, which reads the
permission and never the role.

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

### A refused reading is not left on the handset

The cycle can be locked at the office while a reader is out of signal, and the
handset only learns it when it next tries to send. What it does then depends on
why the server said no, which is why every rejection carries a code
(`SETTLED_CODES` in `../src/lib/readings.js`):

- **Settled** — `cycle-closed`, `billed`, `unmetered`. Nothing anyone types will
  ever be accepted. The typed value is put back to the last figure the server
  confirmed and the row stops being pending. Leaving it would show a reading
  the office does not have, and a reader quoting it at a gate would be quoting a
  number that was never saved.
- **The reader's to fix** — a value below the previous reading, say. The reading
  stays pending with the server's own sentence attached, because the reader
  stood at that meter and the figure is worth correcting rather than discarding.

The same response carries the cycle's current status, so one refusal locks every
screen at once rather than waiting for a download the reader may not manage.
`captureBlockReason()` in `lib/logic/capture_lock.dart` is the single definition
of whether capture is allowed — the controller enforces it and the meter screen
explains it, so the two cannot disagree. When it says no, no keypad is shown at
all; the alternative, a keypad that cannot save, is what left handsets holding
refused numbers in the first place.

### A meter is also a profile

A locked meter still opens. A reader gets asked what an account owes and what it
used, and that does not stop being true because the office locked the cycle, so
every row opens whatever the cycle status — to the keypad when capture is open,
and to a read-only record when it is not. Phone, zone, category, meter number,
arrears and the last three cycles' consumption are all in the round payload
already; `lib/ui/widgets/meter_profile.dart` shows them, inline when the meter
is locked and in a sheet from the capture screen's toolbar when it is not.

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

### Registering a connection is online-only too

For a related reason. The `KW-` account number is handed out by the server
inside a transaction that reads the highest one already issued; a handset cannot
invent one without risking two households holding the same number. And a queued
registration would leave somebody told they are signed up while the office has
never heard of them. So the form either reaches the office and comes back with a
real account number — shown in the largest type on the screen, because it is
what the customer writes down — or it says plainly that nothing was registered.

The zones and categories in the form come from the server on every visit rather
than being cached, so a zone added at the office this morning is pickable this
afternoon. That call doubles as a permission check: a 403 means the office has
withdrawn `register-consumers` since sign-in, and the tab says so instead of
waiting until a filled-in form is refused.

### What the server provides

| Call | Purpose |
| --- | --- |
| `POST /api/auth/login` with `client: "mobile"` | returns the JWT itself, plus roles and permissions |
| `GET /api/mobile/session` | is this stored token still good, and what may this person do |
| `GET /api/mobile/round` | the whole walk in one response: cycle, consumers, previous readings, usage history |
| `POST /api/readings` | the outbox, in one request; answers with what saved and what was rejected |
| `GET /api/mobile/accounts` | account lookup with balances, for either field role |
| `GET /api/mobile/consumers` | the zones and categories the registration form offers |
| `POST /api/mobile/consumers` | registers a connection and answers with its new account number |
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
