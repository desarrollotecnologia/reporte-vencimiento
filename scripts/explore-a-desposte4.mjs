import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});
async function q(label, sql, params=[]) {
  const r = await p.query(sql, params);
  console.log('\n=== ' + label + ' ===');
  console.log(JSON.stringify(r.rows, null, 2));
}

await q('a_producto_desposte activos por vencer', `
  SELECT pd.identificacion, COALESCE(nc.nombre_alternativo, c.nombre) AS corte,
         pd.fecha_vencimiento, pd.fecha_vencimiento::date - CURRENT_DATE AS dias,
         pd.peso, l.codigo AS lote_codigo
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  JOIN desposte.corte c ON c.id = nc.id_corte
  JOIN a_desposte.a_lote al ON al.id = pd.id_lote
  JOIN desposte.lote l ON l.id = al.id_lote_desposte
  WHERE pd.fecha_fin_vigencia IS NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
  ORDER BY pd.fecha_vencimiento
  LIMIT 10
`);

await q('con cava via lote_subproducto', `
  SELECT pd.identificacion, COALESCE(nc.nombre_alternativo, c.nombre) AS corte,
         pd.fecha_vencimiento, pd.fecha_vencimiento::date - CURRENT_DATE AS dias,
         cd.nombre AS cava, pd.peso, l.codigo AS lote
  FROM a_desposte.a_producto_desposte pd
  JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
  JOIN desposte.corte c ON c.id = nc.id_corte
  JOIN a_desposte.a_lote al ON al.id = pd.id_lote
  JOIN desposte.lote l ON l.id = al.id_lote_desposte
  JOIN desposte.lote_subproducto ls ON ls.id_lote = l.id
  JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
  WHERE pd.fecha_fin_vigencia IS NULL
    AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3
  ORDER BY pd.fecha_vencimiento
  LIMIT 15
`);

await q('count a_desposte vs desposte vs vw_pbi05', `
  SELECT
    (SELECT COUNT(*)::int FROM a_desposte.a_producto_desposte pd
     WHERE pd.fecha_fin_vigencia IS NULL AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3) AS a_producto,
    (SELECT COUNT(*)::int FROM desposte.producto_desposte pd
     WHERE pd.fecha_fin_vigencia IS NULL AND pd.fecha_vencimiento::date <= CURRENT_DATE + 3) AS producto,
    (SELECT COUNT(*)::int FROM trazabilidad_proceso.vw_pbi05 v
     WHERE v.ubicacion = 'Cava' AND v.fecha_vencimiento::date <= CURRENT_DATE + 3) AS vw_pbi05
`);

await q('a_caja por vencer sin despacho', `
  SELECT c.codigo, c.fecha_vencimiento, c.fecha_vencimiento::date - CURRENT_DATE AS dias,
         c.precamara, c.cuarto_canal, c.peso, l.codigo AS lote
  FROM a_desposte.a_caja c
  JOIN a_desposte.a_lote al ON al.id = c.id_lote
  JOIN desposte.lote l ON l.id = al.id_lote_desposte
  WHERE c.fecha_fin_vigencia IS NULL
    AND c.fecha_vencimiento::date <= CURRENT_DATE + 3
    AND c.fecha_despacho IS NULL
  ORDER BY c.fecha_vencimiento
  LIMIT 10
`);

await q('cavas desposte', `SELECT id, nombre FROM desposte.cava_desposte ORDER BY id`);

await p.end();
