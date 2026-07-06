import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});

const tests = [
  ['a_caja sin despacho vencimiento proximo', `
    SELECT COUNT(DISTINCT c.codigo)::int AS n FROM a_desposte.a_caja c
    WHERE c.fecha_fin_vigencia IS NULL AND c.fecha_despacho IS NULL
      AND c.fecha_vencimiento::date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
  `],
  ['a_caja + corte recientes', `
    SELECT c.codigo, COALESCE(nc.nombre_alternativo, ct.nombre) AS corte,
           c.fecha_vencimiento, c.fecha_vencimiento::date - CURRENT_DATE AS dias,
           c.precamara, l.codigo AS lote
    FROM a_desposte.a_caja c
    JOIN a_desposte.a_lote al ON al.id = c.id_lote
    JOIN desposte.lote l ON l.id = al.id_lote_desposte
    JOIN desposte.plan_desposte pd ON pd.id = l.id_plan_desposte
    LEFT JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
    LEFT JOIN desposte.nombre_corte nc ON nc.id = ls.id_subproducto
    LEFT JOIN desposte.corte ct ON ct.id = nc.id_corte
    WHERE c.fecha_fin_vigencia IS NULL AND c.fecha_despacho IS NULL
      AND c.fecha_vencimiento::date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
    ORDER BY c.fecha_vencimiento LIMIT 10
  `],
  ['producto_desposte alistamiento false', `
    SELECT COUNT(*)::int FROM desposte.producto_desposte pd
    WHERE pd.fecha_fin_vigencia IS NULL AND pd.alistamiento = false
      AND pd.fecha_vencimiento::date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
  `],
  ['a_producto DISTINCT alistamiento false', `
    SELECT COUNT(*)::int FROM (
      SELECT DISTINCT ON (pd.id_a) pd.id_a
      FROM a_desposte.a_producto_desposte pd
      WHERE pd.fecha_fin_vigencia IS NULL AND pd.alistamiento = false
        AND pd.fecha_vencimiento::date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
      ORDER BY pd.id_a, pd.fecha DESC NULLS LAST, pd.hora DESC NULLS LAST
    ) x
  `],
  ['a_producto en cava con lote+cava', `
    SELECT DISTINCT ON (pd.id_a)
      pd.identificacion, COALESCE(nc.nombre_alternativo, ct.nombre) AS corte,
      pd.fecha_vencimiento, pd.fecha_vencimiento::date - CURRENT_DATE AS dias,
      cd.nombre AS cava, l.codigo AS lote, pd.peso, pd.alistamiento
    FROM a_desposte.a_producto_desposte pd
    JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
    JOIN desposte.corte ct ON ct.id = nc.id_corte
    JOIN a_desposte.a_lote al ON al.id = pd.id_lote
    JOIN desposte.lote l ON l.id = al.id_lote_desposte
    LEFT JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
    LEFT JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
    WHERE pd.fecha_fin_vigencia IS NULL
      AND pd.fecha_vencimiento::date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
      AND pd.alistamiento = false
    ORDER BY pd.id_a, pd.fecha DESC NULLS LAST, pd.hora DESC NULLS LAST
    LIMIT 15
  `],
];

for (const [label, sql] of tests) {
  const r = await p.query(sql);
  console.log('\n=== ' + label + ' ===');
  console.log(JSON.stringify(r.rows, null, 2));
}
await p.end();
