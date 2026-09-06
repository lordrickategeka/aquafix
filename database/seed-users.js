const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// One login per role, so a fresh install has someone to sign in as for every
// part of the console. `npm run seed` creates the roles; this creates the
// people. Re-running it is safe: accounts that already exist keep their
// passwords unless --reset-password says otherwise.

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

const USAGE =
  'Usage: npm run seed:users -- [--domain <domain>] [--password <password>]\n' +
  '                            [--roles <a,b>] [--reset-password]\n' +
  '  --domain          email domain for the seeded accounts (default: aquafix.local)\n' +
  '  --password        one shared password for every account; omit to generate a\n' +
  '                    different random one per account and print it once\n' +
  '  --roles           seed only these roles (default: all of them)\n' +
  '  --reset-password  overwrite the password of accounts that already exist\n' +
  '  Run `npm run seed` first so the roles exist.';

// Same rules the signup route enforces (src/app/api/auth/signup/route.js).
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

// The local part of each address, keyed by the roles seeded in seed.js. "user"
// carries no permissions there, so that account can log in and see the
// dashboard and nothing else — which is what makes it worth having around.
const ACCOUNTS = [
  { role: 'admin', local: 'admin' },
  { role: 'billing-officer', local: 'billing' },
  { role: 'meter-reader', local: 'reader' },
  { role: 'cashier', local: 'cashier' },
  { role: 'user', local: 'staff' },
];

// No O/0/I/l/1: these get read off a screen and typed into a handset by
// someone who did not choose them.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(length = 14) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${name} needs a value.\n\n${USAGE}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  const resetPassword = args.includes('--reset-password');
  const domain = readOption(args, '--domain') || 'aquafix.local';
  const sharedPassword = readOption(args, '--password');
  const rolesOption = readOption(args, '--roles');

  if (sharedPassword && sharedPassword.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  let wanted = ACCOUNTS;
  if (rolesOption) {
    const only = rolesOption
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const known = ACCOUNTS.map((account) => account.role);
    const unknown = only.filter((name) => !known.includes(name));

    if (unknown.length) {
      console.error(`No seeded account for role(s): ${unknown.join(', ')}.`);
      console.error(`Known roles: ${known.join(', ')}.`);
      process.exit(1);
    }
    wanted = ACCOUNTS.filter((account) => only.includes(account.role));
  }

  // Without these, mysql2 connects as an empty user and MySQL 8.4 reports a
  // confusing "Plugin 'mysql_native_password' is not loaded" instead of a
  // plain access-denied error.
  const missing = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing database config: ${missing.join(', ')}.`);
    console.error('Create .env.local (copy .env.local.example) and fill it in.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  // Every role is resolved before a single account is written. Failing halfway
  // would leave accounts created whose generated passwords were never printed —
  // recoverable only by resetting them.
  const [rows] = await connection.query('SELECT id, name FROM roles WHERE name IN (?)', [
    wanted.map((account) => account.role),
  ]);
  const roleIds = new Map(rows.map((role) => [role.name, role.id]));
  const absent = wanted.filter((account) => !roleIds.has(account.role));

  if (absent.length) {
    console.error(`No role found named ${absent.map((a) => `"${a.role}"`).join(', ')}.`);
    console.error('Run `npm run seed` first — it creates the roles this seeder attaches.');
    await connection.end();
    process.exit(1);
  }

  const results = [];

  for (const account of wanted) {
    const email = `${account.local}@${domain}`;

    const [[existing]] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    let userId;
    let password = sharedPassword || generatePassword();
    let note;

    if (existing) {
      userId = existing.id;
      if (resetPassword) {
        await connection.query('UPDATE users SET password = ? WHERE id = ?', [
          await bcrypt.hash(password, BCRYPT_ROUNDS),
          userId,
        ]);
        note = 'password reset';
      } else {
        password = '(unchanged)';
        note = 'already existed';
      }
    } else {
      // created_at is defaulted by Sequelize, not by MySQL, so a raw insert has
      // to set it or the row lands on the epoch.
      const [result] = await connection.query(
        'INSERT INTO users (email, password, created_at) VALUES (?, ?, NOW())',
        [email, await bcrypt.hash(password, BCRYPT_ROUNDS)],
      );
      userId = result.insertId;
      note = 'created';
    }

    await connection.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [
      userId,
      roleIds.get(account.role),
    ]);

    results.push({ email, role: account.role, password, note });
  }

  await connection.end();

  const widthOf = (key) => Math.max(...results.map((row) => row[key].length), key.length);
  const emails = widthOf('email');
  const roles = widthOf('role');
  const passwords = widthOf('password');
  const row = (email, name, password, note) =>
    `  ${email.padEnd(emails)}  ${name.padEnd(roles)}  ${password.padEnd(passwords)}  ${note}`;

  console.log('');
  console.log(row('email', 'role', 'password', ''));
  console.log(`  ${'-'.repeat(emails + roles + passwords + 4)}`);
  for (const result of results) {
    console.log(row(result.email, result.role, result.password, result.note));
  }
  console.log('');

  if (sharedPassword) {
    console.log('Every account above shares one password. Fine on a laptop; on a real');
    console.log('deployment give each person their own with `npm run seed:admin`.');
  } else if (results.some((result) => result.note !== 'already existed')) {
    console.log('The generated passwords are shown here once and stored nowhere else.');
    console.log('Copy them now — --reset-password is the only way back.');
  }
  console.log('Log in at /login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
