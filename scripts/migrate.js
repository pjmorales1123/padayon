/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local if present
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1 || line.startsWith('#')) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is required.');
  console.error('Example: set DATABASE_URL=postgresql://user:password@host:5432/db');
  process.exit(1);
}

async function migrate() {
  const client = new Client({ connectionString });
  await client.connect();

  const sqlPath = path.join(__dirname, '../supabase/migrations/001_initial.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.query(sql);
  console.log('Migration applied successfully.');

  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
