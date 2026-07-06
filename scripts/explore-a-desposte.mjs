import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: String(process.env.POSTGRES_PASSWORD || ''),
});

async function q(label, sql) {
  const r = await p.query(sql);
  console.log('\n=== ' + label + ' ===');
  console.log(JSON.stringify(r.rows, null, 2));
}

await q('TABLAS a_desposte', `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'a_desposte'
  ORDER BY table_name
`);

await q('COLUMNAS a_producto_desposte', `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'a_desposte' AND table_name = 'a_producto_desposte'
  ORDER BY ordinal_position
`);

await q('COLUMNAS a_caja', `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'a_desposte' AND table_name = 'a_caja'
  ORDER BY ordinal_position
`);

await q('COLUMNAS a_cava_desposte', `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'a_desposte' AND table_name = 'a_cava_desposte'
  ORDER BY ordinal_position
`);

await q('MUESTRA a_producto_desposte POR VENCER', `
  SELECT pd.id, pd.identificacion, nc.nombre AS corte, pd.fecha_vencimiento,
         pd.fecha_vencimiento::date - CURRENT_DATE AS dias_hasta_vencimiento,
         pd.peso, pd.alistamiento
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  WHERE pd.fecha_vencimiento IS NOT NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND pd.fecha_fin_vigencia IS NULL
  ORDER BY pd.fecha_vencimiento
  LIMIT 10
`);

await q('MUESTRA a_caja POR VENCER', `
  SELECT c.id, c.codigo, c.fecha_vencimiento,
         c.fecha_vencimiento::date - CURRENT_DATE AS dias_hasta_vencimiento,
         c.precamara, c.cuarto_canal, c.peso, c.fecha_despacho
  FROM a_desposte.a_caja c
  WHERE c.fecha_vencimiento IS NOT NULL
    AND c.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND c.fecha_despacho IS NULL
  ORDER BY c.fecha_vencimiento
  LIMIT 10
`);

await q('RELACION a_caja lote/corte', `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'a_desposte' AND table_name = 'a_lote'
  ORDER BY ordinal_position
`);

await q('a_caja con corte', `
  SELECT c.codigo, nc.nombre AS corte, c.fecha_vencimiento,
         c.fecha_vencimiento::date - CURRENT_DATE AS dias_hasta_vencimiento,
         c.precamara, c.cuarto_canal
  FROM a_desposte.a_caja c
  JOIN a_desposte.a_lote l ON l.id = c.id_lote
  JOIN desposte.nombre_corte nc ON nc.id = l.id_corte
  WHERE c.fecha_vencimiento IS NOT NULL
    AND c.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND c.fecha_despacho IS NULL
  ORDER BY c.fecha_vencimiento
  LIMIT 10
`);

await p.end();
