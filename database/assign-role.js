const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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

async function main() {
  loadEnv();

  const [, , email, roleName] = process.argv;
  if (!email || !roleName) {
    console.error('Usage: npm run assign-role -- <email> <roleName>');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  const [[user]] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    console.error(`No user found with email "${email}"`);
    process.exit(1);
  }

  const [[role]] = await connection.query('SELECT id FROM roles WHERE name = ?', [roleName]);
  if (!role) {
    console.error(`No role found named "${roleName}"`);
    process.exit(1);
  }

  await connection.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [
    user.id,
    role.id,
  ]);

  console.log(`Assigned role "${roleName}" to ${email}.`);
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
