const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');

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

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await connection.end();
}

async function main() {
  loadEnv();
  await ensureDatabaseExists();

  const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
  });

  const umzug = new Umzug({
    // glob requires forward slashes; path.join emits backslashes on Windows
    migrations: { glob: path.join(__dirname, 'migrations', '*.js').split(path.sep).join('/') },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  const command = process.argv[2] || 'up';

  if (command === 'status') {
    const [executed, pending] = await Promise.all([umzug.executed(), umzug.pending()]);
    console.log('Executed:', executed.map((migration) => migration.name));
    console.log('Pending:', pending.map((migration) => migration.name));
  } else if (command === 'down') {
    const reverted = await umzug.down();
    console.log(
      reverted.length > 0
        ? `Reverted ${reverted.map((migration) => migration.name).join(', ')}.`
        : 'Nothing to revert.'
    );
  } else if (command === 'up') {
    const pending = await umzug.pending();
    if (pending.length === 0) {
      console.log('Already up to date.');
    } else {
      await umzug.up();
      console.log(`Applied ${pending.length} migration(s).`);
    }
  } else {
    throw new Error(`Unknown command "${command}". Use: up | down | status`);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
