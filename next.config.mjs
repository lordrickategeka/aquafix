/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sequelize eagerly touches all its dialect modules (postgres, sqlite, etc.)
  // at require-time, which trips up bundling for modules that aren't actually
  // installed (e.g. pg-hstore). Native require() resolves this fine at runtime.
  serverExternalPackages: ['sequelize'],
};

export default nextConfig;
