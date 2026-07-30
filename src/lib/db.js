import { Sequelize } from "sequelize";

function createSequelize() {
  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: false,
    },
  );
}

// Next.js dev hot-reload re-executes this module on every edit; without caching
// on globalThis each reload would open a fresh connection pool on top of the
// last one until the DB runs out of connections.
const sequelize = globalThis.__sequelize ?? createSequelize();

if (process.env.NODE_ENV !== "production") {
  globalThis.__sequelize = sequelize;
}

export default sequelize;
