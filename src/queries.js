import { query } from './db.js';
import { config } from './config.js';
import { TIPOS_REPORTE, normalizarCodigoProducto, normalizarTipo } from './vidaUtil.js';

const SQL_CAVA_FROM = `
  FROM trazabilidad_proceso.parte_producto_cava_riel ppcr
  JOIN trazabilidad_proceso.parte_producto pp
    ON pp.id = ppcr.id_parte_producto
   AND pp.id_producto::text = ppcr.id_producto::text
  JOIN trazabilidad_proceso.tipo_parte_producto tpp
    ON tpp.id = pp.id_tipo_parte_producto
  JOIN trazabilidad_proceso.producto p
    ON p.id::text = pp.id_producto::text
  JOIN trazabilidad_proceso.producto_empresa pe
    ON pe.id_producto::text = p.id::text
   AND pe.activo = true
  JOIN organizaciones.empresa e3
    ON e3.id = pe.id_empresa
  LEFT JOIN trazabilidad_proceso.cava c
    ON c.id = ppcr.id_cava
  LEFT JOIN trazabilidad_proceso.parte_producto_empresa ppe
    ON ppe.id_producto::text = pp.id_producto::text
   AND ppe.id_parte_producto = pp.id
  LEFT JOIN trazabilidad_proceso.parte_producto_empresa_local ppel
    ON ppel.id_parte_producto_empresa = ppe.id
  LEFT JOIN organizaciones.sucursal s
    ON s.id = ppel.id_local
  LEFT JOIN trazabilidad_proceso.destino de
    ON de.id = s.id_destino
`;

/** Solo medias canal desde PBI (respaldo si no están en riel). */
const TIPOS_PBI = ['Media Canal 1', 'Media Canal 2 Cola'];

function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
  return String(v);
}

function normalizarFilaCava(r) {
  const tipo = normalizarTipo(r.tipo_producto);
  const codigoRaw = String(r.codigo ?? '').trim();
  return {
    codigo: normalizarCodigoProducto(codigoRaw, tipo),
    codigo_raw: codigoRaw,
    tipo_producto: tipo,
    propietario: String(r.propietario ?? '').trim(),
    fecha_ingreso: fmtDate(r.fecha_ingreso),
    cava: String(r.cava ?? '').trim(),
    riel: String(r.riel ?? '').trim(),
    sucursal: String(r.sucursal ?? '').trim(),
    destino: String(r.destino ?? '').trim(),
    observaciones: String(r.observaciones ?? '').trim(),
    fuente: r.fuente ?? '',
  };
}

function claveProducto(fila) {
  return `${fila.codigo}|${fila.tipo_producto}`;
}

/** Todos los productos en cava (riel) — fuente principal con código completo. */
async function fetchProductosCavaRiel() {
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(pp.identificacion), ''), ppcr.id_producto::text) AS codigo,
      TRIM(tpp.nombre) AS tipo_producto,
      COALESCE(NULLIF(TRIM(e3.nombre), ''), 'SIN PROPIETARIO') AS propietario,
      ppcr.fecha_ingreso,
      COALESCE(c.nombre, '') AS cava,
      COALESCE(ppcr.id_riel::text, '') AS riel,
      COALESCE(s.nombre, '') AS sucursal,
      COALESCE(de.nombre, '') AS destino,
      COALESCE(pp.observaciones, '') AS observaciones
    ${SQL_CAVA_FROM}
    WHERE ppcr.fecha_salida IS NULL
      AND TRIM(tpp.nombre) = ANY($1::text[])
      AND ppcr.fecha_ingreso >= (CURRENT_DATE - 200)
    ORDER BY tipo_producto, codigo
    LIMIT 50000
  `;
  const { rows } = await query(sql, [TIPOS_REPORTE]);
  return rows.map((r) => normalizarFilaCava({ ...r, fuente: 'riel' }));
}

/** Medias canal en PBI — respaldo (código corto sin sufijo). */
async function fetchProductosCavaPbi() {
  const sql = `
    SELECT
      codigo,
      TRIM(nombre_parte) AS tipo_producto,
      COALESCE(nombre_propietario, 'SIN PROPIETARIO') AS propietario,
      fecha_ingreso_cava AS fecha_ingreso,
      COALESCE(nombre_cava, '') AS cava,
      COALESCE(sucursal, '') AS sucursal,
      COALESCE(destino, '') AS destino,
      COALESCE(empresa_destino, '') AS empresa_destino
    FROM trazabilidad_proceso.vw_pbi01
    WHERE fecha_salida_cava IS NULL
      AND TRIM(nombre_parte) = ANY($1::text[])
    ORDER BY tipo_producto, codigo
    LIMIT 50000
  `;
  const { rows } = await query(sql, [TIPOS_PBI]);
  return rows.map((r) =>
    normalizarFilaCava({
      ...r,
      riel: '',
      observaciones: r.empresa_destino ? `Empresa destino: ${r.empresa_destino}` : '',
      fuente: 'pbi',
    })
  );
}

/** Combina fuentes: riel (código completo) + PBI solo para medias canal faltantes. */
export async function fetchProductosEnCava() {
  const resultados = await Promise.allSettled([fetchProductosCavaRiel(), fetchProductosCavaPbi()]);
  const nombres = ['riel', 'pbi'];
  const riel = resultados[0].status === 'fulfilled' ? resultados[0].value : [];
  const pbi = resultados[1].status === 'fulfilled' ? resultados[1].value : [];
  resultados.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.warn(`  ⚠ Productos (${nombres[i]}): ${res.reason?.message || res.reason}`);
    }
  });

  const porClave = new Map();
  const codigosRiel = new Set(riel.map((f) => f.codigo));

  for (const fila of riel) {
    porClave.set(claveProducto(fila), fila);
  }

  for (const fila of pbi) {
    if (codigosRiel.has(fila.codigo)) continue;
    const clave = claveProducto(fila);
    if (!porClave.has(clave)) porClave.set(clave, fila);
  }

  return [...porClave.values()].sort((a, b) => {
    const t = a.tipo_producto.localeCompare(b.tipo_producto, 'es');
    return t !== 0 ? t : a.codigo.localeCompare(b.codigo);
  });
}

function normalizarFilaCorte(r, fuente) {
  return {
    identificacion: String(r.identificacion ?? ''),
    lote_interno: String(r.lote_interno ?? ''),
    lote_externo: String(r.lote_externo ?? ''),
    cliente: String(r.cliente ?? ''),
    propietario: String(r.cliente ?? r.propietario ?? '').trim(),
    ubicacion: String(r.ubicacion ?? r.cava ?? ''),
    corte: String(r.corte ?? ''),
    cantidad: String(r.cantidad ?? '1'),
    kilos: String(r.kilos ?? r.peso ?? ''),
    fecha_produccion: fmtDate(r.fecha_produccion),
    fecha_vencimiento: fmtDate(r.fecha_vencimiento),
    tipo_conservacion: String(r.tipo_conservacion ?? ''),
    categoria: String(r.categoria ?? ''),
    fuente,
  };
}

async function fetchCortesDesposte() {
  const sql = `
    SELECT
      pd.identificacion,
      l.codigo AS lote_interno,
      '' AS lote_externo,
      '' AS cliente,
      COALESCE(cav.nombre, 'Cava') AS ubicacion,
      COALESCE(nc.nombre_alternativo, ct.nombre) AS corte,
      COALESCE(pd.peso::text, '') AS kilos,
      pd.fecha_creacion AS fecha_produccion,
      pd.fecha_vencimiento,
      COALESCE(tc.nombre, '') AS tipo_conservacion,
      'Desposte' AS categoria,
      COALESCE(cav.nombre, '') AS cava
    FROM desposte.producto_desposte pd
    JOIN desposte.nombre_corte nc ON nc.id = pd.id_nombre_corte
    JOIN desposte.corte ct ON ct.id = nc.id_corte
    JOIN desposte.lote l ON l.id = pd.id_lote
    LEFT JOIN LATERAL (
      SELECT cd.nombre
      FROM desposte.lote_subproducto ls
      JOIN desposte.cava_desposte cd ON cd.id = ls.id_cava_desposte
      WHERE ls.id_lote = l.id
      ORDER BY cd.refrigeracion DESC NULLS LAST, cd.id
      LIMIT 1
    ) cav ON true
    LEFT JOIN desposte.tipo_conservacion tc ON tc.id = pd.id_tipo_conservacion
    WHERE pd.fecha_fin_vigencia IS NULL
      AND pd.alistamiento = false
      AND pd.fecha_vencimiento IS NOT NULL
      AND pd.fecha_vencimiento::date >= CURRENT_DATE - 7
      AND pd.fecha_vencimiento::date <= CURRENT_DATE + 14
    ORDER BY pd.fecha_vencimiento, ct.nombre
    LIMIT 50000
  `;
  const { rows } = await query(sql);
  return rows.map((r) => normalizarFilaCorte(r, 'desposte'));
}

async function fetchCortesPbi() {
  const sql = `
    SELECT
      '' AS identificacion,
      lote_interno,
      lote_externo,
      cliente,
      ubicacion,
      descripcion_productos AS corte,
      cantidad_producto AS cantidad,
      kilos_producto AS kilos,
      fecha_produccion,
      fecha_vencimiento,
      tipo_conservacion,
      categoria
    FROM trazabilidad_proceso.vw_pbi05
    WHERE ubicacion = 'Cava'
      AND fecha_vencimiento IS NOT NULL
      AND fecha_vencimiento::date >= CURRENT_DATE - 7
      AND fecha_vencimiento::date <= CURRENT_DATE + 14
    ORDER BY fecha_vencimiento, descripcion_productos
    LIMIT 50000
  `;
  const { rows } = await query(sql);
  return rows.map((r) => normalizarFilaCorte(r, 'vw_pbi05'));
}

export async function fetchCortesEnCava() {
  const fuente = config.cortesFuente;
  const tareas = [];
  if (fuente === 'adesposte' || fuente === 'both') tareas.push({ nombre: 'desposte', fn: fetchCortesDesposte });
  if (fuente === 'pbi05' || fuente === 'both') tareas.push({ nombre: 'pbi05', fn: fetchCortesPbi });

  const vistos = new Set();
  const out = [];
  const resultados = await Promise.allSettled(tareas.map((t) => t.fn()));
  resultados.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.warn(`  ⚠ Cortes (${tareas[i].nombre}): ${res.reason?.message || res.reason}`);
      return;
    }
    for (const f of res.value) {
      const clave = [f.identificacion, f.lote_interno, f.corte, f.fecha_vencimiento].join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(f);
    }
  });
  return out;
}

/** @deprecated usar fetchProductosEnCava */
export const fetchProductos3DiasEnCava = fetchProductosEnCava;
/** @deprecated usar fetchCortesEnCava */
export const fetchCortesPorVencer = fetchCortesEnCava;
