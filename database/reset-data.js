const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Wipes the operational data — consumers, readings, bills, payments, the
// ledger, cycles, zones and tariffs — so a real register can be entered from
// scratch. Deliberately leaves users, roles, permissions and organisation
// settings alone, so you keep your login and your branding.

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

// Children first, though FK checks are off for the truncate.
const TABLES = [
  'ledger_entries',
  'payments',
  'bill_lines',
  'bills',
  'readings',
  'billing_cycles',
  'consumers',
  'tariff_bands',
  'tariffs',
  'tariff_schedules',
  'zones',
];

const KEPT = ['users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'settings'];

async function main() {
  loadEnv();

  const missing = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing database config: ${missing.join(', ')}.`);
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  // Show what is about to go, then require an explicit flag. This is not
  // recoverable.
  console.log(`Database: ${process.env.DB_NAME}\n`);
  console.log('About to permanently delete:');
  for (const table of TABLES) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    console.log(`  ${String(row.n).padStart(6)}  ${table}`);
  }
  console.log(`\nKeeping: ${KEPT.join(', ')}`);

  if (!process.argv.includes('--confirm')) {
    console.log('\nNothing deleted. Re-run with --confirm to go ahead:');
    console.log('  npm run reset:data -- --confirm');
    await connection.end();
    return;
  }

  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) await connection.query(`TRUNCATE TABLE \`${table}\``);
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  const [[users]] = await connection.query('SELECT COUNT(*) AS n FROM users');
  console.log(`\nDone. ${TABLES.length} tables cleared; ${users.n} user account(s) untouched.`);
  console.log('Next: add zones, a tariff schedule, then consumers.');
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
