import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});

const r1 = await p.query(`
  SELECT codigo, TRIM(nombre_parte) AS tipo, nombre_propietario, destino, sucursal, dias_en_cava
  FROM trazabilidad_proceso.vw_pbi01
  WHERE fecha_salida_cava IS NULL AND nombre_parte = 'Media Canal 1 '
  ORDER BY dias_en_cava DESC LIMIT 5
`);
console.log('Media canal 1 muestra:', JSON.stringify(r1.rows, null, 2));

const r2 = await p.query(`
  SELECT
    COALESCE(NULLIF(TRIM(pp.identificacion), ''), ppcr.id_producto::text) AS codigo,
    TRIM(tpp.nombre) AS tipo,
    COALESCE(NULLIF(TRIM(e3.nombre), ''), 'SIN PROPIETARIO') AS propietario,
    pp.observaciones
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  JOIN trazabilidad_proceso.producto pr ON pr.id::text = pp.id_producto::text
  JOIN trazabilidad_proceso.producto_empresa pe ON pe.id_producto::text = pr.id::text AND pe.activo = true
  JOIN organizaciones.empresa e3 ON e3.id = pe.id_empresa
  WHERE ppcr.fecha_salida IS NULL AND TRIM(tpp.nombre) = 'Lengua'
  AND pp.observaciones IS NOT NULL AND pp.observaciones <> ''
  LIMIT 8
`);
console.log('Lenguas con observaciones:', JSON.stringify(r2.rows, null, 2));

// Join lengua (riel) + media canal (pbi) por animal base
const r3 = await p.query(`
  WITH lengua AS (
    SELECT
      COALESCE(NULLIF(TRIM(pp.identificacion), ''), ppcr.id_producto::text) AS codigo,
      COALESCE(NULLIF(TRIM(e3.nombre), ''), 'SIN PROPIETARIO') AS propietario,
      COALESCE(s.nombre, '') AS sucursal,
      COALESCE(de.nombre, '') AS destino,
      pp.observaciones,
      ppel.fecha_programacion_despacho,
      split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion), ''), ppcr.id_producto::text)), '-', 1)
        || '-' || split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion), ''), ppcr.id_producto::text)), '-', 2) AS animal_base,
      CURRENT_DATE - ppcr.fecha_ingreso::date AS dias_en_cava
    FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
    JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
    JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
    JOIN trazabilidad_proceso.producto pr ON pr.id::text = pp.id_producto::text
    JOIN trazabilidad_proceso.producto_empresa pe ON pe.id_producto::text = pr.id::text AND pe.activo = true
    JOIN organizaciones.empresa e3 ON e3.id = pe.id_empresa
    LEFT JOIN trazabilidad_proceso.parte_producto_empresa ppe ON ppe.id_producto::text = pp.id_producto::text AND ppe.id_parte_producto = pp.id
    LEFT JOIN trazabilidad_proceso.parte_producto_empresa_local ppel ON ppel.id_parte_producto_empresa = ppe.id
    LEFT JOIN organizaciones.sucursal s ON s.id = ppel.id_local
    LEFT JOIN trazabilidad_proceso.destino de ON de.id = s.id_destino
    WHERE ppcr.fecha_salida IS NULL AND TRIM(tpp.nombre) = 'Lengua'
  ),
  media AS (
    SELECT
      codigo,
      nombre_propietario AS propietario,
      sucursal,
      destino,
      empresa_destino,
      fecha_programacion_despacho,
      split_part(trim(codigo), '-', 1) || '-' || split_part(trim(codigo), '-', 2) AS animal_base,
      dias_en_cava
    FROM trazabilidad_proceso.vw_pbi01
    WHERE fecha_salida_cava IS NULL AND nombre_parte = 'Media Canal 1 '
  )
  SELECT
    l.codigo AS codigo_lengua,
    l.propietario AS prop_lengua,
    l.destino AS destino_lengua,
    l.sucursal AS sucursal_lengua,
    l.observaciones,
    l.fecha_programacion_despacho AS prog_lengua,
    m.codigo AS codigo_media,
    m.propietario AS prop_media,
    m.destino AS destino_media,
    m.sucursal AS sucursal_media,
    m.fecha_programacion_despacho AS prog_media,
    l.dias_en_cava AS dias_lengua,
    m.dias_en_cava AS dias_media
  FROM lengua l
  LEFT JOIN media m ON m.animal_base = l.animal_base
  WHERE l.dias_en_cava = 3 OR m.dias_en_cava = 3
  LIMIT 15
`);
console.log('CRUCE lengua-media por animal_base:', JSON.stringify(r3.rows, null, 2));

const r4 = await p.query(`
  SELECT COUNT(*)::int AS pares_distinto_destino
  FROM (
    SELECT l.animal_base
    FROM (
      SELECT split_part(trim(codigo),'-',1)||'-'||split_part(trim(codigo),'-',2) AS animal_base, destino
      FROM trazabilidad_proceso.vw_pbi01 WHERE fecha_salida_cava IS NULL AND TRIM(nombre_parte)='Lengua'
    ) l
    JOIN (
      SELECT split_part(trim(codigo),'-',1)||'-'||split_part(trim(codigo),'-',2) AS animal_base, destino
      FROM trazabilidad_proceso.vw_pbi01 WHERE fecha_salida_cava IS NULL AND nombre_parte='Media Canal 1 '
    ) m ON m.animal_base = l.animal_base
    WHERE l.destino IS DISTINCT FROM m.destino AND l.destino <> '' AND m.destino <> ''
  ) x
`);
console.log('Pares mismo animal destino distinto (pbi):', r4.rows);

await p.end();
