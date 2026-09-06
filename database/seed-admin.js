const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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
  'Usage: npm run seed:admin -- <email> <password> [role] [--reset-password]\n' +
  '  role defaults to "admin". Run `npm run seed` first so the roles exist.';

// Same rules the signup route enforces (src/app/api/auth/signup/route.js).
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const resetPassword = args.includes('--reset-password');
  const [email, password, roleName = 'admin'] = args.filter((arg) => !arg.startsWith('--'));

  if (!email || !password) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" is not a valid email address.`);
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
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

  const [[role]] = await connection.query('SELECT id FROM roles WHERE name = ?', [roleName]);
  if (!role) {
    console.error(`No role found named "${roleName}". Run \`npm run seed\` first.`);
    await connection.end();
    process.exit(1);
  }

  const [[existing]] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
  let userId;

  if (existing) {
    userId = existing.id;
    if (resetPassword) {
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await connection.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
      console.log(`Reset the password for ${email}.`);
    } else {
      console.log(`${email} already exists — keeping the current password.`);
      console.log('Pass --reset-password to overwrite it.');
    }
  } else {
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // created_at is defaulted by Sequelize, not by MySQL, so a raw insert has
    // to set it or the row lands on the epoch.
    const [result] = await connection.query(
      'INSERT INTO users (email, password, created_at) VALUES (?, ?, NOW())',
      [email, hashed],
    );
    userId = result.insertId;
    console.log(`Created user ${email}.`);
  }

  await connection.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [
    userId,
    role.id,
  ]);

  console.log(`${email} now has the "${roleName}" role. Log in at /login.`);
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
