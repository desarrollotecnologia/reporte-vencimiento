import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});

async function q(label, sql) {
  const r = await p.query(sql);
  console.log('\n=== ' + label + ' ===');
  console.log(JSON.stringify(r.rows, null, 2));
}

await q('a_nombre_corte cols', `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='a_desposte' AND table_name='a_nombre_corte' ORDER BY ordinal_position
`);

await q('a_lote cols', `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='a_desposte' AND table_name='a_lote' ORDER BY ordinal_position
`);

await q('a_caja cols cava?', `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='desposte' AND table_name='caja' ORDER BY ordinal_position
`);

await q('desposte.caja en cava - cols extra', `
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema IN ('desposte','a_desposte')
    AND (column_name ILIKE '%cava%' OR column_name ILIKE '%ubic%' OR column_name ILIKE '%estante%')
  ORDER BY table_schema, table_name
`);

await q('a_producto_desposte + a_nombre_corte', `
  SELECT pd.identificacion, nc.nombre AS corte, pd.fecha_vencimiento,
         pd.fecha_vencimiento::date - CURRENT_DATE AS dias_hasta_vencimiento,
         pd.peso, pd.alistamiento, pd.accion
  FROM a_desposte.a_producto_desposte pd
  JOIN a_desposte.a_nombre_corte nc ON nc.id = pd.id_nombre_corte
  WHERE pd.fecha_vencimiento IS NOT NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND pd.fecha_fin_vigencia IS NULL
  ORDER BY pd.fecha_vencimiento DESC
  LIMIT 10
`);

await q('a_caja + a_lote + a_nombre_corte', `
  SELECT c.codigo, nc.nombre AS corte, c.fecha_vencimiento,
         c.fecha_vencimiento::date - CURRENT_DATE AS dias_hasta_vencimiento,
         c.precamara, c.cuarto_canal, c.peso, c.fecha_despacho, c.accion
  FROM a_desposte.a_caja c
  JOIN a_desposte.a_lote l ON l.id = c.id_lote
  JOIN a_desposte.a_nombre_corte nc ON nc.id = l.id_corte
  WHERE c.fecha_vencimiento IS NOT NULL
    AND c.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND c.fecha_despacho IS NULL
    AND c.fecha_fin_vigencia IS NULL
  ORDER BY c.fecha_vencimiento
  LIMIT 10
`);

await q('a_lote cols detail', `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='a_desposte' AND table_name='a_lote' ORDER BY ordinal_position
`);

await q('a_estante cols', `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='a_desposte' AND table_name='a_estante' ORDER BY ordinal_position
`);

await q('desposte producto_desposte vs a_ count', `
  SELECT
    (SELECT COUNT(*)::int FROM desposte.producto_desposte WHERE fecha_fin_vigencia IS NULL AND fecha_vencimiento::date <= CURRENT_DATE + 3) AS desposte,
    (SELECT COUNT(*)::int FROM a_desposte.a_producto_desposte WHERE fecha_fin_vigencia IS NULL AND fecha_vencimiento::date <= CURRENT_DATE + 3) AS a_desposte
`);

await p.end();
