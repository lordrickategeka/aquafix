const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/*
  Runs any of this project's commands against a throwaway copy of the database
  instead of the real one.

  The live database on a developer's machine is not seed data — it is Kuwe
  Foundation's actual register, readings and issued invoices. Anything that
  writes while being tested (the Flutter app, a billing run, a payment) needs
  somewhere else to write. This points DB_NAME at "<database>_sandbox" and
  hands off to the ordinary scripts, which all read config through the same
  loadEnv() that lets an already-set variable win.

    node database/sandbox.js setup       create it, migrate, seed demo data
    node database/sandbox.js dev         next dev on port 3001 against it
    node database/sandbox.js reset       drop it and build it again
    node database/sandbox.js run <cmd>   anything else, e.g. run npm run seed
*/

const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('No .env.local found. Copy .env.local.example and fill it in.');
    process.exit(1);
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !(match[1].trim() in process.env)) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

function sandboxName() {
  const live = process.env.DB_NAME;
  if (!live) {
    console.error('DB_NAME is not set in .env.local.');
    process.exit(1);
  }

  const name = process.env.SANDBOX_DB_NAME || `${live}_sandbox`;

  // The whole point is that these differ. A typo in SANDBOX_DB_NAME that made
  // them equal would send a "throwaway" reset straight at the real register.
  if (name === live) {
    console.error(`SANDBOX_DB_NAME is the same as DB_NAME ("${live}"). Refusing to run.`);
    process.exit(1);
  }
  return name;
}

function childEnv(name) {
  return { ...process.env, DB_NAME: name };
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    // Windows needs a shell to resolve the .cmd shims for npx and npm; node
    // itself is a real executable, so it is spawned directly.
    shell: process.platform === 'win32' && command !== 'node',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function dropDatabase(name) {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await connection.end();
  console.log(`Dropped ${name}.`);
}

function setup(name) {
  const env = childEnv(name);

  // migrate.js creates the database if it is missing, so this is also what
  // brings a brand new sandbox into existence.
  run('node', ['database/migrate.js'], env);
  run('node', ['database/seed.js'], env);
  run('node', ['database/seed-admin.js', 'admin@sandbox.test', 'password', 'admin'], env);
  run('node', ['database/seed-admin.js', 'reader@sandbox.test', 'password', 'meter-reader'], env);
  run('node', ['database/seed-admin.js', 'cashier@sandbox.test', 'password', 'cashier'], env);
  run('node', ['database/seed-demo.js'], env);

  console.log('');
  console.log(`Sandbox ready: ${name}`);
  console.log('  admin@sandbox.test   / password   (everything)');
  console.log('  reader@sandbox.test  / password   (capture-readings only)');
  console.log('  cashier@sandbox.test / password   (record-payments only)');
  console.log('');
  console.log('Start it with:  npm run dev:sandbox   (http://localhost:3001)');
}

async function main() {
  loadEnv();
  const name = sandboxName();
  const command = process.argv[2] || 'setup';

  console.log(`[sandbox] database: ${name}  (live database "${process.env.DB_NAME}" untouched)`);

  if (command === 'setup') {
    setup(name);
  } else if (command === 'reset') {
    await dropDatabase(name);
    setup(name);
  } else if (command === 'dev') {
    // A different port so it can run beside the real console rather than
    // fighting it for 3000 — and so a handset pointed at 3001 cannot possibly
    // reach the live data.
    run('npx', ['next', 'dev', '--port', process.env.SANDBOX_PORT || '3001'], childEnv(name));
  } else if (command === 'run') {
    const rest = process.argv.slice(3);
    if (rest.length === 0) {
      console.error('Nothing to run. Try: node database/sandbox.js run npm run seed');
      process.exit(1);
    }
    run(rest[0], rest.slice(1), childEnv(name));
  } else {
    console.error(`Unknown command "${command}". Use: setup | reset | dev | run <cmd>`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
