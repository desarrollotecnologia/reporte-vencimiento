import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: String(process.env.POSTGRES_PASSWORD || ''),
  connectionTimeoutMillis: 30000,
});

const r1 = await p.query(`
  SELECT id, TRIM(nombre) AS nombre
  FROM trazabilidad_proceso.tipo_parte_producto
  WHERE TRIM(nombre) IN (
    'Cabeza','Visceras Blancas','Visceras Rojas','Lengua','Patas y Manos','Media Canal 1','Media Canal 2 Cola'
  ) OR nombre ILIKE '%media canal%'
  ORDER BY nombre
`);
console.log('=== TIPOS EN SIRT (tipo_parte_producto) ===');
console.table(r1.rows);

const r2 = await p.query(`
  SELECT TRIM(tpp.nombre) AS tipo,
         split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3) AS tercer_segmento,
         COUNT(*)::int AS cantidad,
         MIN(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)) AS ejemplo_codigo
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp
    ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  WHERE ppcr.fecha_salida IS NULL
    AND TRIM(tpp.nombre) IN ('Cabeza','Visceras Blancas','Visceras Rojas','Lengua','Patas y Manos')
  GROUP BY 1, 2
  ORDER BY 1, 2
`);
console.log('\n=== TERCER SEGMENTO DEL CODIGO POR TIPO (riel/cava) ===');
console.table(r2.rows);

const r3 = await p.query(`
  SELECT TRIM(nombre_parte) AS tipo,
         split_part(trim(codigo), '-', 3) AS tercer_segmento,
         COUNT(*)::int AS cantidad,
         MIN(codigo) AS ejemplo_codigo
  FROM trazabilidad_proceso.vw_pbi01
  WHERE fecha_salida_cava IS NULL
    AND TRIM(nombre_parte) IN (
      'Media Canal 1','Media Canal 2 Cola','Lengua','Cabeza','Visceras Blancas','Visceras Rojas','Patas y Manos'
    )
  GROUP BY 1, 2
  ORDER BY 1, 2
`);
console.log('\n=== TERCER SEGMENTO DEL CODIGO POR TIPO (vw_pbi01) ===');
console.table(r3.rows);

const r4 = await p.query(`
  SELECT TRIM(tpp.nombre) AS tipo,
         COUNT(DISTINCT split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3)) AS variantes_tercer_segmento,
         array_agg(DISTINCT split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3) ORDER BY split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3)) AS segmentos
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp
    ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  WHERE ppcr.fecha_salida IS NULL
    AND TRIM(tpp.nombre) IN ('Cabeza','Visceras Blancas','Visceras Rojas','Lengua','Patas y Manos')
  GROUP BY 1
  ORDER BY 1
`);
console.log('\n=== TODOS LOS SUFIJOS POR TIPO (en cava ahora) ===');
for (const row of r4.rows) {
  console.log(`${row.tipo}: ${row.segmentos.join(', ')}`);
}

await p.end();
