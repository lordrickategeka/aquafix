const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Demo data for Kyenjojo TWSS: zones, the published tariff, a consumer
// register, and two closed cycles of readings/bills/payments so the arrears
// and collections figures have real history behind them. Bills are produced by
// src/lib/billing.js — the same engine the app runs — so seeded totals and
// app-generated totals cannot drift apart.

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !(match[1].trim() in process.env)) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

// Deterministic RNG so re-seeding produces the same register every time.
function rng(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONES = [
  ['Central', 'CZ', '06:00–11:00 daily'],
  ['Kihuura', 'KH', '06:00–10:00 alternate days'],
  ['Butunduzi', 'BT', 'Mon/Wed/Fri mornings'],
  ['Nyantungo', 'NY', '05:00–09:00 daily'],
  ['Katooke', 'KT', 'Tue–Sat mornings'],
];

// Effective 01 Jul 2026, matching the published schedule.
// flat_rate is what an unmetered connection in that category pays each month.
// Every category needs one, otherwise an account whose meter was never fitted
// (or was stolen) can never be billed at all.
const TARIFFS = [
  {
    category: 'domestic',
    fixed_charge: 2000,
    levy_pct: 10,
    flat_rate: 15000,
    bands: [
      [0, 5, 1050],
      [5, 20, 2180],
      [20, null, 3400],
    ],
  },
  {
    category: 'institutional',
    fixed_charge: 5000,
    levy_pct: 10,
    flat_rate: 45000,
    bands: [[0, null, 2650]],
  },
  {
    category: 'commercial',
    fixed_charge: 12000,
    levy_pct: 10,
    flat_rate: 90000,
    bands: [[0, null, 4120]],
  },
  { category: 'kiosk', fixed_charge: 0, levy_pct: 0, flat_rate: 9000, bands: [] },
];

const PEOPLE = [
  'Nakato Sarah Kabahenda', 'Byaruhanga Moses', 'Tumusiime Grace', 'Asiimwe Robert',
  'Mugisha Denis', 'Namara Joy Kiiza', 'Tibenda Alex', 'Komuhangi Sylvia',
  'Katusabe Ritah', 'Ssemwogerere John', 'Kobusingye Anne', 'Mugume Patrick',
  'Ainembabazi Doreen', 'Kyomuhendo Peace', 'Businge Julius', 'Kemigisa Harriet',
  'Baguma Ronald', 'Atuhaire Christine', 'Kajura Wilson', 'Nyakato Winnie',
  'Muhwezi Edgar', 'Kabagambe Josephine', 'Twinomugisha Simon', 'Kicucu Betty',
  'Rwakaikara Vincent', 'Musinguzi Allan', 'Kabahenda Rose', 'Tumwebaze Ivan',
  'Nabimanya Faith', 'Kyaligonza Martin',
];

const INSTITUTIONS = [
  ['Kyenjojo Secondary School', 'institutional'],
  ['Kihuura Health Centre III', 'institutional'],
  ['St. Adolf Primary School', 'institutional'],
  ['Kyenjojo District Offices', 'institutional'],
];

const BUSINESSES = [
  ['Rwenzori Grain Millers', 'commercial'],
  ['Kabatoro Lodge', 'commercial'],
  ['Nyantungo Trading Centre', 'commercial'],
  ['Kyenjojo Bottling Depot', 'commercial'],
];

const KIOSKS = [
  ['Rwenjura Kiosk 2', 'kiosk'],
  ['Butunduzi Standpipe 1', 'kiosk'],
  ['Katooke Market Standpipe', 'kiosk'],
];

const STREETS = [
  'Rwenjura Road', 'Kabarole Road', 'Market Lane', 'Mabira Road',
  'Nyabwina Close', 'Church Road', 'Hospital Road', 'Station Road',
];

const CYCLES = [
  { period: '2026-07', status: 'billed', due: '2026-07-20' },
  { period: '2026-08', status: 'billed', due: '2026-08-20' },
  { period: '2026-09', status: 'open', due: '2026-09-20' },
];

const WATER_TABLES = [
  'ledger_entries', 'payments', 'bill_lines', 'bills',
  'readings', 'billing_cycles', 'consumers', 'tariff_bands', 'tariffs', 'zones',
];

async function truncateAll(connection) {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of WATER_TABLES) await connection.query(`TRUNCATE TABLE \`${table}\``);
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function main() {
  loadEnv();

  const missing = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing database config: ${missing.join(', ')}.`);
    console.error('Create .env.local (copy .env.local.example) and fill it in.');
    process.exit(1);
  }

  const { buildBill } = await import('../src/lib/billing.js');
  const fresh = process.argv.includes('--fresh');
  const random = rng(20260905);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    multipleStatements: false,
  });

  const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM consumers');
  if (count > 0 && !fresh) {
    console.error(`consumers already holds ${count} row(s). Re-run with --fresh to replace the demo data.`);
    await connection.end();
    process.exit(1);
  }
  if (fresh) {
    await truncateAll(connection);
    console.log('Cleared existing water-billing data.');
  }

  /* ---------- zones + tariffs ---------- */
  const zoneIds = [];
  for (const [name, code, window] of ZONES) {
    const [res] = await connection.query(
      'INSERT INTO zones (name, code, supply_window, created_at) VALUES (?, ?, ?, NOW())',
      [name, code, window],
    );
    zoneIds.push(res.insertId);
  }

  const tariffByCategory = {};
  for (const tariff of TARIFFS) {
    const [res] = await connection.query(
      `INSERT INTO tariffs (category, fixed_charge, levy_pct, flat_rate, effective_from, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        tariff.category,
        tariff.fixed_charge,
        tariff.levy_pct,
        tariff.flat_rate,
        '2026-07-01',
        'Approved by the Water Authority Board',
      ],
    );
    const bands = [];
    for (const [min, max, rate] of tariff.bands) {
      await connection.query(
        'INSERT INTO tariff_bands (tariff_id, min_m3, max_m3, rate_per_m3) VALUES (?, ?, ?, ?)',
        [res.insertId, min, max, rate],
      );
      bands.push({ min_m3: min, max_m3: max, rate_per_m3: rate });
    }
    tariffByCategory[tariff.category] = { ...tariff, id: res.insertId, bands };
  }

  /* ---------- consumers ---------- */
  const register = [
    ...PEOPLE.map((name) => [name, 'domestic']),
    ...INSTITUTIONS,
    ...BUSINESSES,
    ...KIOSKS,
  ];

  const consumers = [];
  let sequence = 100;
  let meterSeq = 31000;

  for (const [name, category] of register) {
    sequence += Math.floor(random() * 5) + 1;
    const accountNo = `KW-${String(sequence).padStart(4, '0')}`;
    const zoneId = zoneIds[Math.floor(random() * zoneIds.length)];
    const metered = category !== 'kiosk' && random() > 0.06;
    const meterNo = metered ? `M-${(meterSeq += Math.floor(random() * 40) + 5)}` : null;
    const status = random() > 0.94 ? 'disconnected' : 'active';
    const connectedAt = `20${19 + Math.floor(random() * 7)}-0${Math.floor(random() * 8) + 1}-1${Math.floor(random() * 9)}`;

    // created_at is defaulted by Sequelize rather than by MySQL, so a raw
    // insert has to set it — otherwise the row lands on the zero date and the
    // registry cannot be sorted by when an account was registered.
    const [res] = await connection.query(
      `INSERT INTO consumers
         (account_no, name, phone, address, zone_id, category, is_metered, meter_no, status, connected_at, balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        accountNo,
        name,
        `07${Math.floor(random() * 90000000 + 10000000)}`.slice(0, 10),
        `Plot ${Math.floor(random() * 60) + 1}, ${STREETS[Math.floor(random() * STREETS.length)]}`,
        zoneId,
        category,
        metered,
        meterNo,
        status,
        connectedAt,
        `${connectedAt} 09:00:00`,
        `${connectedAt} 09:00:00`,
      ],
    );

    consumers.push({
      id: res.insertId,
      account_no: accountNo,
      category,
      is_metered: Boolean(metered),
      status,
      balance: 0,
      meterValue: metered ? Math.floor(random() * 2000) + 200 : null,
      baseUsage: category === 'domestic' ? 6 + Math.floor(random() * 12)
        : category === 'institutional' ? 40 + Math.floor(random() * 40)
        : category === 'commercial' ? 70 + Math.floor(random() * 90)
        : 0,
      history: [],
    });
  }
  console.log(`Seeded ${zoneIds.length} zones, ${TARIFFS.length} tariffs, ${consumers.length} consumers.`);

  /* ---------- cycles, readings, bills, payments ---------- */
  let billsMade = 0;
  let paymentsMade = 0;

  for (const cycle of CYCLES) {
    const [cycleRes] = await connection.query(
      `INSERT INTO billing_cycles (period, status, due_date, locked_at, billed_at, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        cycle.period,
        cycle.status,
        cycle.due,
        cycle.status === 'open' ? null : `${cycle.period}-05 09:00:00`,
        cycle.status === 'billed' ? `${cycle.period}-06 11:00:00` : null,
      ],
    );
    const cycleId = cycleRes.insertId;
    const isOpen = cycle.status === 'open';

    for (const consumer of consumers) {
      if (consumer.status === 'disconnected') continue;

      let readingId = null;
      let usage = null;

      if (consumer.is_metered) {
        const previous = consumer.meterValue;
        const roll = random();
        let current;
        let flag = 'ok';
        let note = null;

        if (isOpen && roll > 0.96) {
          current = null; // meter not reached this round
          flag = 'missed';
          note = 'Meter not accessible';
        } else if (isOpen && roll > 0.93) {
          current = previous + consumer.baseUsage * 8; // spike to review
          flag = 'high';
          note = '8× average — verify';
        } else if (isOpen && roll > 0.91) {
          current = previous; // no movement
          flag = 'zero';
          note = 'No consumption';
        } else {
          const swing = Math.round((random() - 0.4) * consumer.baseUsage * 0.6);
          current = previous + Math.max(1, consumer.baseUsage + swing);
        }

        usage = current === null ? null : current - previous;
        const status = isOpen ? (flag === 'ok' ? 'approved' : 'pending') : 'approved';

        const [readingRes] = await connection.query(
          `INSERT INTO readings
             (consumer_id, billing_cycle_id, previous_value, current_value, usage_m3, flag, status, note, source, read_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'web', ?, ?, ?)`,
          [
            consumer.id, cycleId, previous, current, usage, flag, status, note,
            `${cycle.period}-04 08:30:00`,
            `${cycle.period}-04 08:30:00`,
            `${cycle.period}-04 08:30:00`,
          ],
        );
        readingId = readingRes.insertId;

        if (current !== null) {
          consumer.meterValue = current;
          if (usage > 0) consumer.history.unshift(usage);
        }
        if (flag !== 'ok') usage = null; // exceptions do not bill
      }

      if (isOpen) continue; // the open cycle is left for the user to run

      const tariff = tariffByCategory[consumer.category];
      if (!consumer.is_metered && tariff.flat_rate === null) continue;
      if (consumer.is_metered && usage === null) continue;

      const draft = buildBill({
        consumer: { is_metered: consumer.is_metered },
        tariff,
        usage,
        broughtForward: consumer.balance,
      });

      const invoiceNo = `INV-${cycle.period.slice(2, 4)}${cycle.period.slice(5)}-${consumer.account_no.replace('KW-', '')}`;
      const [billRes] = await connection.query(
        `INSERT INTO bills
           (invoice_no, consumer_id, billing_cycle_id, reading_id, usage_m3, consumption_amount,
            fixed_charge, levy_amount, brought_forward, total_due, issued_at, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?)`,
        [
          invoiceNo, consumer.id, cycleId, readingId, draft.usage_m3,
          draft.consumption_amount, draft.fixed_charge, draft.levy_amount,
          draft.brought_forward, draft.total_due,
          `${cycle.period}-06 11:00:00`, cycle.due,
          `${cycle.period}-06 11:00:00`, `${cycle.period}-06 11:00:00`,
        ],
      );
      billsMade += 1;

      for (const line of draft.lines) {
        await connection.query(
          'INSERT INTO bill_lines (bill_id, description, detail, amount, position) VALUES (?, ?, ?, ?, ?)',
          [billRes.insertId, line.description, line.detail, line.amount, line.position],
        );
      }

      // Only this cycle's charges hit the ledger; the brought-forward part is
      // already on the account.
      const charged = draft.total_due - draft.brought_forward;
      await connection.query(
        `INSERT INTO ledger_entries (consumer_id, type, amount, bill_id, note, occurred_at, created_at)
         VALUES (?, 'bill', ?, ?, ?, ?, ?)`,
        [consumer.id, charged, billRes.insertId, `Bill ${invoiceNo}`, `${cycle.period}-06 11:00:00`, `${cycle.period}-06 11:00:00`],
      );
      consumer.balance += charged;

      // Most accounts pay, some part-pay, a few let it run into arrears.
      const paying = random();
      if (paying > 0.22 && consumer.balance > 0) {
        const full = paying > 0.4;
        const amount = full
          ? consumer.balance
          : Math.round((consumer.balance * (0.3 + random() * 0.4)) / 100) * 100;
        if (amount > 0) {
          const channels = ['mtn', 'mtn', 'mtn', 'airtel', 'airtel', 'bank', 'cash'];
          const channel = channels[Math.floor(random() * channels.length)];
          const receivedAt = `${cycle.period}-${String(12 + Math.floor(random() * 14)).padStart(2, '0')} 14:00:00`;

          const [payRes] = await connection.query(
            `INSERT INTO payments (consumer_id, amount, channel, reference, received_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [consumer.id, amount, channel, `${channel.toUpperCase()}${Math.floor(random() * 900000 + 100000)}`, receivedAt, receivedAt],
          );
          await connection.query(
            `INSERT INTO ledger_entries (consumer_id, type, amount, payment_id, note, occurred_at, created_at)
             VALUES (?, 'payment', ?, ?, ?, ?, ?)`,
            [consumer.id, -amount, payRes.insertId, `Payment ${channel}`, receivedAt, receivedAt],
          );
          await connection.query(
            'UPDATE bills SET status = ? WHERE id = ?',
            [full ? 'paid' : 'part_paid', billRes.insertId],
          );
          consumer.balance -= amount;
          paymentsMade += 1;
        }
      }
    }
  }

  for (const consumer of consumers) {
    await connection.query('UPDATE consumers SET balance = ? WHERE id = ?', [
      consumer.balance,
      consumer.id,
    ]);
  }

  const [[totals]] = await connection.query(
    'SELECT SUM(balance) AS owed, SUM(balance > 0) AS in_arrears FROM consumers',
  );

  console.log(`Seeded ${CYCLES.length} cycles, ${billsMade} bills, ${paymentsMade} payments.`);
  console.log(`Outstanding: UGX ${Number(totals.owed || 0).toLocaleString()} across ${totals.in_arrears} accounts.`);
  console.log('Cycle 2026-09 is open with readings captured — run billing from the app.');
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
