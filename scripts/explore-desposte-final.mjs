import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});

const r1 = await p.query(`
  SELECT pd.identificacion, COALESCE(nc.nombre_alternativo, c.nombre) AS corte,
         pd.fecha_vencimiento, pd.fecha_vencimiento::date - CURRENT_DATE AS dias,
         cd.nombre AS cava, pd.peso, l.codigo AS lote, pd.alistamiento
  FROM desposte.producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  JOIN desposte.corte c ON c.id = nc.id_corte
  JOIN desposte.lote l ON l.id = pd.id_lote
  LEFT JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
  LEFT JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
  WHERE pd.fecha_fin_vigencia IS NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
  ORDER BY pd.fecha_vencimiento
  LIMIT 15
`);
console.log('desposte.producto_desposte:', JSON.stringify(r1.rows, null, 2));

const r2 = await p.query(`
  SELECT COUNT(DISTINCT pd.id)::int AS total
  FROM desposte.producto_desposte pd
  JOIN desposte.lote l ON l.id = pd.id_lote
  JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
  JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
  WHERE pd.fecha_fin_vigencia IS NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND cd.refrigeracion = true
`);
console.log('count en cava refrigerada:', r2.rows);

const r3 = await p.query(`
  SELECT DISTINCT ON (pd.id_a)
    pd.identificacion, COALESCE(nc.nombre_alternativo, c.nombre) AS corte,
    pd.fecha_vencimiento, pd.fecha_vencimiento::date - CURRENT_DATE AS dias, pd.peso
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  JOIN desposte.corte c ON c.id = nc.id_corte
  WHERE pd.fecha_fin_vigencia IS NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND pd.fecha_vencimiento::date >= CURRENT_DATE - 30
  ORDER BY pd.id_a, pd.fecha DESC NULLS LAST, pd.hora DESC NULLS LAST
  LIMIT 15
`);
console.log('a_desposte DISTINCT ON id_a:', JSON.stringify(r3.rows, null, 2));

const r4 = await p.query(`
  SELECT COUNT(*)::int FROM (
    SELECT DISTINCT ON (pd.id_a) pd.id_a
    FROM a_desposte.a_producto_desposte pd
    WHERE pd.fecha_fin_vigencia IS NULL
      AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
      AND pd.fecha_vencimiento::date >= CURRENT_DATE - 60
    ORDER BY pd.id_a, pd.fecha DESC NULLS LAST, pd.hora DESC NULLS LAST
  ) x
`);
console.log('count a_desposte recientes:', r4.rows);

await p.end();
