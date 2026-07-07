import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const p = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: String(process.env.POSTGRES_PASSWORD || ''),
  connectionTimeoutMillis: 60000,
});

// Medias canal en PBI
const r1 = await p.query(`
  SELECT codigo, TRIM(nombre_parte) AS tipo, nombre_propietario, dias_en_cava
  FROM trazabilidad_proceso.vw_pbi01
  WHERE fecha_salida_cava IS NULL
    AND (nombre_parte ILIKE '%media canal%')
  ORDER BY nombre_parte, codigo
  LIMIT 15
`);
console.log('=== PBI medias canal (muestra) ===');
console.table(r1.rows);

// ¿Hay medias canal en riel con sufijo?
const r2 = await p.query(`
  SELECT
    COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text) AS codigo,
    TRIM(tpp.nombre) AS tipo,
    split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3) AS sufijo,
    COUNT(*)::int AS n
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp
    ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  WHERE ppcr.fecha_salida IS NULL
    AND (tpp.nombre ILIKE '%media canal%' OR pp.identificacion LIKE '%1001%' OR pp.identificacion LIKE '%1002%')
  GROUP BY 1,2,3
  ORDER BY tipo, codigo
  LIMIT 30
`);
console.log('\n=== Riel: media canal o sufijos 1001/1002 ===');
console.table(r2.rows);

// Sufijos 1001 y 1002 en riel
const r3 = await p.query(`
  SELECT TRIM(tpp.nombre) AS tipo,
         split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3) AS sufijo,
         COUNT(*)::int AS n,
         MIN(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)) AS ejemplo
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp
    ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  WHERE ppcr.fecha_salida IS NULL
    AND split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 3) IN ('1001','1002')
  GROUP BY 1,2
`);
console.log('\n=== Sufijos 1001 / 1002 ===');
console.table(r3.rows);

// Códigos de 2 segmentos en riel - qué tipo tienen?
const r4 = await p.query(`
  SELECT TRIM(tpp.nombre) AS tipo,
         COUNT(*)::int AS n,
         MIN(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)) AS ejemplo
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp
    ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  WHERE ppcr.fecha_salida IS NULL
    AND COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text) ~ '^[^-]+-[^-]+$'
  GROUP BY 1
  ORDER BY n DESC
  LIMIT 20
`);
console.log('\n=== Riel: códigos con solo 2 segmentos por tipo ===');
console.table(r4.rows);

// Cruce: mismo codigo base en PBI media y riel viscera?
const r5 = await p.query(`
  WITH pbi AS (
    SELECT codigo, TRIM(nombre_parte) AS tipo
    FROM trazabilidad_proceso.vw_pbi01
    WHERE fecha_salida_cava IS NULL AND nombre_parte ILIKE '%media canal%'
  ),
  riel AS (
    SELECT COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text) AS codigo,
           TRIM(tpp.nombre) AS tipo
    FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
    JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
    JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
    WHERE ppcr.fecha_salida IS NULL
  )
  SELECT p.codigo AS codigo_pbi, p.tipo AS tipo_pbi, r.codigo AS codigo_riel, r.tipo AS tipo_riel
  FROM pbi p
  JOIN riel r ON split_part(trim(p.codigo),'-',1)||'-'||split_part(trim(p.codigo),'-',2)
             = split_part(trim(r.codigo),'-',1)||'-'||split_part(trim(r.codigo),'-',2)
  WHERE p.tipo ILIKE '%media canal%' AND r.tipo NOT ILIKE '%media canal%'
  LIMIT 20
`);
console.log('\n=== Mismo animal: PBI=media canal pero riel=otro tipo ===');
console.table(r5.rows);

await p.end();
