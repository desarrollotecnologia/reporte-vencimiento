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

await q('desposte.nombre_corte sample', `SELECT id, nombre FROM desposte.nombre_corte LIMIT 5`);
await q('a_corte cols', `SELECT column_name FROM information_schema.columns WHERE table_schema='a_desposte' AND table_name='a_corte' ORDER BY ordinal_position`);

await q('a_producto_desposte con corte', `
  SELECT pd.identificacion, COALESCE(nc_alt.nombre_alternativo, nc.nombre) AS corte,
         pd.fecha_vencimiento, pd.fecha_vencimiento::date - CURRENT_DATE AS dias,
         pd.peso, pd.alistamiento
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  LEFT JOIN a_desposte.a_nombre_corte nc_alt ON nc_alt.id = pd.id_nombre_corte
  WHERE pd.fecha_vencimiento::date <= CURRENT_DATE + 3 AND pd.fecha_fin_vigencia IS NULL
  ORDER BY pd.fecha_vencimiento LIMIT 10
`);

await q('a_caja_producto_desposte cols', `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='a_desposte' AND table_name='a_caja_producto_desposte' ORDER BY ordinal_position
`);

await q('caja_producto_desposte cols', `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='desposte' AND table_name='caja_producto_desposte' ORDER BY ordinal_position
`);

await q('producto en cava via estante', `
  SELECT pd.identificacion, nc.nombre AS corte, pd.fecha_vencimiento,
         pd.fecha_vencimiento::date - CURRENT_DATE AS dias,
         cd.nombre AS cava, e.nombre AS estante
  FROM desposte.producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  JOIN desposte.lote l ON l.id = pd.id_lote
  LEFT JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
  LEFT JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
  LEFT JOIN desposte.estante e ON e.id_cava = cd.id
  WHERE pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND pd.fecha_fin_vigencia IS NULL
  LIMIT 5
`);

await q('a_lote_subproducto + cava', `
  SELECT ls.id, ls.id_lote, cd.nombre AS cava
  FROM a_desposte.a_lote_subproducto ls
  JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
  LIMIT 5
`);

await q('cortes en cava a_desposte via lote', `
  SELECT DISTINCT ON (pd.identificacion)
    pd.identificacion, nc.nombre AS corte, pd.fecha_vencimiento,
    pd.fecha_vencimiento::date - CURRENT_DATE AS dias_hasta_vencimiento,
    cd.nombre AS cava, pd.peso
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  JOIN a_desposte.a_lote al ON al.id = pd.id_lote
  JOIN desposte.lote l ON l.id = al.id_lote_desposte
  JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
  JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
  WHERE pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND pd.fecha_fin_vigencia IS NULL
  ORDER BY pd.identificacion, pd.fecha_vencimiento
  LIMIT 15
`);

await q('count cortes a_desposte en cava', `
  SELECT COUNT(DISTINCT pd.identificacion)::int AS total
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.lote l ON l.id = (SELECT al.id_lote_desposte FROM a_desposte.a_lote al WHERE al.id = pd.id_lote LIMIT 1)
  JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
  WHERE pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND pd.fecha_fin_vigencia IS NULL
`);

await p.end();
