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

const ROLES = ['admin', 'user', 'billing-officer', 'meter-reader', 'cashier'];
const PERMISSIONS = [
  'manage-users',
  'manage-consumers',
  // Adding a connection, and nothing else. Narrower than manage-consumers,
  // which is the permission to change anybody's account: somebody enrolling a
  // household at their gate needs to create one, not to edit the register.
  // Held by admin alone for now — a technician role can be given it later
  // without touching the field app, which reads the permission, not the role.
  'register-consumers',
  'capture-readings',
  'run-billing',
  'record-payments',
];
const ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  'billing-officer': ['manage-consumers', 'capture-readings', 'run-billing', 'record-payments'],
  'meter-reader': ['capture-readings'],
  cashier: ['record-payments'],
};

async function main() {
  loadEnv();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  for (const name of ROLES) {
    await connection.query('INSERT IGNORE INTO roles (name) VALUES (?)', [name]);
  }
  for (const name of PERMISSIONS) {
    await connection.query('INSERT IGNORE INTO permissions (name) VALUES (?)', [name]);
  }

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const [[role]] = await connection.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    for (const permissionName of permissionNames) {
      const [[permission]] = await connection.query(
        'SELECT id FROM permissions WHERE name = ?',
        [permissionName]
      );
      await connection.query(
        'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [role.id, permission.id]
      );
    }
  }

  console.log(`Seeded roles (${ROLES.join(', ')}) and permissions (${PERMISSIONS.join(', ')}).`);
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
