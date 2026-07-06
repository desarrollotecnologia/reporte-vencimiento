import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});
const r = await p.query(`SELECT id, nombre, refrigeracion FROM desposte.cava_desposte ORDER BY id`);
console.log(JSON.stringify(r.rows, null, 2));
await p.end();
