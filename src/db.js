import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined,
  max: 4,
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

let poolCerrado = false;

export async function closePool() {
  if (poolCerrado) return;
  poolCerrado = true;
  await pool.end();
}
