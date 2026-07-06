import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});

for (const [schema, table] of [
  ['desposte', 'nombre_corte'], ['desposte', 'corte'], ['desposte', 'lote'],
  ['desposte', 'lote_subproducto'], ['desposte', 'producto_desposte'],
  ['desposte', 'caja'], ['a_desposte', 'a_lote'], ['a_desposte', 'a_corte'],
]) {
  const r = await p.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
    [schema, table]
  );
  console.log(`${schema}.${table}:`, r.rows.map((x) => x.column_name).join(', '));
}

const sample = await p.query(`
  SELECT * FROM desposte.nombre_corte LIMIT 3
`);
console.log('\nnombre_corte sample:', JSON.stringify(sample.rows, null, 2));

const sampleCorte = await p.query(`SELECT * FROM desposte.corte LIMIT 3`);
console.log('\ncorte sample:', JSON.stringify(sampleCorte.rows, null, 2));

await p.end();
