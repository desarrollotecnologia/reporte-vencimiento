import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({
  host: process.env.POSTGRES_HOST, port: 5432, database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER, password: String(process.env.POSTGRES_PASSWORD || ''),
});

async function q(label, sql, params = []) {
  const r = await p.query(sql, params);
  console.log('\n=== ' + label + ' ===');
  console.log(JSON.stringify(r.rows, null, 2));
}

// Muestra lengua + media canal 1 del mismo animal (mismos 2 primeros segmentos del código)
await q('LENGUA + MEDIA CANAL 1 mismo animal (3 dias cava)', `
  WITH base AS (
    SELECT
      codigo,
      TRIM(nombre_parte) AS tipo,
      nombre_propietario,
      destino,
      sucursal,
      empresa_destino,
      nombre_cava,
      dias_en_cava,
      fecha_ingreso_cava,
      split_part(trim(codigo), '-', 1) || '-' || split_part(trim(codigo), '-', 2) AS animal_base
    FROM trazabilidad_proceso.vw_pbi01
    WHERE fecha_salida_cava IS NULL
      AND dias_en_cava = 3
      AND TRIM(nombre_parte) IN ('Lengua', 'Media Canal 1')
  )
  SELECT * FROM base
  WHERE animal_base IN (
    SELECT animal_base FROM base WHERE tipo = 'Lengua' INTERSECT
    SELECT animal_base FROM base WHERE tipo = 'Media Canal 1'
  )
  ORDER BY animal_base, tipo
  LIMIT 20
`);

await q('LENGUA con destino distinto a MEDIA CANAL 1 mismo animal', `
  WITH piezas AS (
    SELECT
      codigo,
      TRIM(nombre_parte) AS tipo,
      nombre_propietario,
      destino,
      sucursal,
      split_part(trim(codigo), '-', 1) || '-' || split_part(trim(codigo), '-', 2) AS animal_base
    FROM trazabilidad_proceso.vw_pbi01
    WHERE fecha_salida_cava IS NULL AND dias_en_cava = 3
      AND TRIM(nombre_parte) IN ('Lengua', 'Media Canal 1')
  ),
  pares AS (
    SELECT
      l.animal_base,
      l.codigo AS codigo_lengua,
      l.nombre_propietario AS prop_lengua,
      l.destino AS destino_lengua,
      l.sucursal AS sucursal_lengua,
      m.codigo AS codigo_media,
      m.nombre_propietario AS prop_media,
      m.destino AS destino_media,
      m.sucursal AS sucursal_media
    FROM piezas l
    JOIN piezas m ON m.animal_base = l.animal_base AND m.tipo = 'Media Canal 1'
    WHERE l.tipo = 'Lengua'
  )
  SELECT * FROM pares
  WHERE destino_lengua IS DISTINCT FROM destino_media
     OR prop_lengua IS DISTINCT FROM prop_media
     OR sucursal_lengua IS DISTINCT FROM sucursal_media
  LIMIT 15
`);

await q('CAMPOS vw_pbi01 para trazabilidad', `
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='trazabilidad_proceso' AND table_name='vw_pbi01'
  AND column_name ILIKE ANY(ARRAY['%prop%','%dest%','%sucurs%','%empresa%','%program%','%codigo%','%ident%'])
  ORDER BY ordinal_position
`);

await q('LENGUA via riel con propietario y destino programado', `
  SELECT
    COALESCE(NULLIF(TRIM(pp.identificacion), ''), ppcr.id_producto::text) AS codigo,
    TRIM(tpp.nombre) AS tipo,
    COALESCE(NULLIF(TRIM(e3.nombre), ''), 'SIN PROPIETARIO') AS propietario,
    COALESCE(s.nombre, '') AS sucursal,
    COALESCE(de.nombre, '') AS destino,
    ppel.fecha_programacion_despacho,
    ppcr.fecha_ingreso,
    CURRENT_DATE - ppcr.fecha_ingreso::date AS dias_en_cava
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  JOIN trazabilidad_proceso.producto p ON p.id::text = pp.id_producto::text
  JOIN trazabilidad_proceso.producto_empresa pe ON pe.id_producto::text = p.id::text AND pe.activo = true
  JOIN organizaciones.empresa e3 ON e3.id = pe.id_empresa
  LEFT JOIN trazabilidad_proceso.parte_producto_empresa ppe ON ppe.id_producto::text = pp.id_producto::text AND ppe.id_parte_producto = pp.id
  LEFT JOIN trazabilidad_proceso.parte_producto_empresa_local ppel ON ppel.id_parte_producto_empresa = ppe.id
  LEFT JOIN organizaciones.sucursal s ON s.id = ppel.id_local
  LEFT JOIN trazabilidad_proceso.destino de ON de.id = s.id_destino
  WHERE ppcr.fecha_salida IS NULL
    AND TRIM(tpp.nombre) = 'Lengua'
    AND ppcr.fecha_ingreso::date = CURRENT_DATE - 3
  LIMIT 10
`);

await q('observaciones lengua con RETIRAR LIBRILLOS', `
  SELECT codigo, nombre_parte, observaciones, destino, nombre_propietario
  FROM trazabilidad_proceso.vw_pbi01 v
  JOIN trazabilidad_proceso.parte_producto pp ON pp.id_producto::text = split_part(v.codigo,'-',1)
  WHERE v.fecha_salida_cava IS NULL AND TRIM(v.nombre_parte) = 'Lengua'
  LIMIT 3
`);

await p.end();
