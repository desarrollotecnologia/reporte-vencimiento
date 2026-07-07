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

const animalBase = (codigo) => {
  const p = String(codigo).trim().split('-');
  return p.length >= 2 ? `${p[0]}-${p[1]}` : codigo;
};

// Conteo en cava por tipo (riel)
const r1 = await p.query(`
  SELECT TRIM(tpp.nombre) AS tipo, COUNT(*)::int AS en_cava
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
  WHERE ppcr.fecha_salida IS NULL
    AND TRIM(tpp.nombre) IN ('Cabeza','Visceras Blancas','Visceras Rojas','Lengua','Patas y Manos','Media Canal 1','Media Canal 2 Cola')
  GROUP BY 1 ORDER BY 1
`);
console.log('=== EN CAVA POR TIPO (riel) ===');
console.table(r1.rows);

// Lenguas con/sin media canal del mismo animal
const r2 = await p.query(`
  WITH lengua AS (
    SELECT
      COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text) AS codigo,
      split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 1)
        || '-' || split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 2) AS animal_base
    FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
    JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
    JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
    WHERE ppcr.fecha_salida IS NULL AND TRIM(tpp.nombre) = 'Lengua'
  ),
  media AS (
    SELECT
      split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 1)
        || '-' || split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 2) AS animal_base,
      TRIM(tpp.nombre) AS tipo_media
    FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
    JOIN trazabilidad_proceso.parte_producto pp ON pp.id = ppcr.id_parte_producto AND pp.id_producto::text = ppcr.id_producto::text
    JOIN trazabilidad_proceso.tipo_parte_producto tpp ON tpp.id = pp.id_tipo_parte_producto
    WHERE ppcr.fecha_salida IS NULL AND tpp.nombre ILIKE '%media canal%'
  )
  SELECT
    COUNT(*)::int AS total_lenguas,
    COUNT(m.animal_base)::int AS lenguas_con_media_mismo_animal,
    COUNT(*) FILTER (WHERE m.tipo_media = 'Media Canal 1')::int AS con_mc1,
    COUNT(*) FILTER (WHERE m.tipo_media = 'Media Canal 2 Cola')::int AS con_mc2,
    COUNT(*) FILTER (WHERE m.animal_base IS NULL)::int AS sin_media
  FROM lengua l
  LEFT JOIN media m ON m.animal_base = l.animal_base
`);
console.log('\n=== LENGUA vs MEDIA CANAL (mismo animal_base) ===');
console.table(r2.rows);

// Muestra cruce
const r3 = await p.query(`
  WITH lengua AS (
    SELECT
      COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text) AS codigo_lengua,
      split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 1)
        || '-' || split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 2) AS animal_base,
      COALESCE(NULLIF(TRIM(e3.nombre),''), 'SIN PROPIETARIO') AS propietario_lengua,
      COALESCE(de.nombre, '') AS destino_lengua
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
      COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text) AS codigo_media,
      split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 1)
        || '-' || split_part(trim(COALESCE(NULLIF(TRIM(pp.identificacion),''), ppcr.id_producto::text)), '-', 2) AS animal_base,
      TRIM(tpp.nombre) AS tipo_media,
      COALESCE(NULLIF(TRIM(e3.nombre),''), 'SIN PROPIETARIO') AS propietario_media,
      COALESCE(de.nombre, '') AS destino_media
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
    WHERE ppcr.fecha_salida IS NULL AND tpp.nombre ILIKE '%media canal%'
  )
  SELECT l.codigo_lengua, l.animal_base, l.propietario_lengua, l.destino_lengua,
         m.codigo_media, m.tipo_media, m.propietario_media, m.destino_media
  FROM lengua l
  LEFT JOIN media m ON m.animal_base = l.animal_base
  LIMIT 12
`);
console.log('\n=== MUESTRA CRUCE LENGUA + MEDIA ===');
console.table(r3.rows);

await p.end();
