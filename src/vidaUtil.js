/**
 * Reglas de dominio para vencimientos en cava.
 *
 * Las fechas se reducen deliberadamente a días calendario representados en
 * UTC. Esto evita que horas y cambios del sistema alteren comparaciones que,
 * para el negocio, solo dependen de la fecha en Bogotá.
 */
/** Vida útil en días hábiles (lun–vie) en cava. */
export const VIDA_UTIL_HABILES = {
  Cabeza: 4,
  'Patas y Manos': 4,
  'Visceras Rojas': 4,
  'Visceras Blancas': 4,
  Lengua: 4,
  'Media Canal 1': 12,
  'Media Canal 2 Cola': 12,
};

export const TIPOS_REPORTE = Object.keys(VIDA_UTIL_HABILES);

/** Orden de la tabla resumen general (como catálogo Colbeef). */
export const TIPOS_RESUMEN_ORDEN = [
  'Media Canal 1',
  'Media Canal 2 Cola',
  'Visceras Rojas',
  'Visceras Blancas',
  'Lengua',
  'Cabeza',
  'Patas y Manos',
];

export const ETIQUETA_TIPO = {
  'Media Canal 1': 'Media canal 1',
  'Media Canal 2 Cola': 'Media canal 2 cola',
  'Visceras Rojas': 'Vísceras rojas',
  'Visceras Blancas': 'Vísceras blancas',
  Lengua: 'Lengua',
  Cabeza: 'Cabeza',
  'Patas y Manos': 'Patas y manos',
};

/** Días hábiles en cava para alertar medias canal (además de mañana/pasado mañana). */
export const DIAS_ALERTA_MEDIA_CANAL = [8, 10];

/** Sufijo del código de identificación por tipo (3.er segmento). */
export const SUFIJO_CODIGO = {
  Cabeza: '6114',
  'Patas y Manos': '6493',
  'Visceras Rojas': '60',
  'Visceras Blancas': '61',
  Lengua: '6000',
  'Media Canal 1': '1001',
  'Media Canal 2 Cola': '1002',
};

const TZ = 'America/Bogota';

/**
 * Obtiene la fecha calendario actual de Bogotá, sin componente de hora.
 *
 * @returns {Date} Medianoche UTC equivalente al año, mes y día de Bogotá.
 */
export function hoyEnBogota() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Convierte las representaciones de fecha admitidas al modelo interno UTC.
 *
 * @param {Date|string|null|undefined} val Fecha nativa, `AAAA-MM-DD` o `DD/MM/AAAA`.
 * @returns {Date|null} Fecha sin hora o `null` cuando el valor no es válido.
 */
export function parseFecha(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate()));
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

/**
 * @param {Date|null|undefined} d Fecha en UTC.
 * @returns {string} Fecha `DD/MM/AAAA` o texto vacío.
 */
export function fmtFecha(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/**
 * @param {Date|null|undefined} d Fecha en UTC.
 * @returns {string} Fecha `AAAA-MM-DD` o texto vacío.
 */
export function fmtFechaIso(d) {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Determina si una fecha corresponde a lunes-viernes.
 *
 * Los festivos no forman parte del calendario actual.
 *
 * @param {Date} d
 * @returns {boolean}
 */
export function esDiaHabil(d) {
  const w = d.getUTCDay();
  return w !== 0 && w !== 6;
}

/**
 * Suma N días hábiles a partir de la fecha de ingreso.
 *
 * El ingreso es día cero: el conteo comienza en el día calendario siguiente.
 *
 * @param {Date} fechaInicio
 * @param {number} diasHabiles
 * @returns {Date}
 */
export function addDiasHabiles(fechaInicio, diasHabiles) {
  const d = new Date(fechaInicio);
  let sumados = 0;
  while (sumados < diasHabiles) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esDiaHabil(d)) sumados += 1;
  }
  return d;
}

/**
 * Cuenta días hábiles transcurridos, incluyendo ingreso y fecha final.
 *
 * @param {Date|string} fechaInicio
 * @param {Date} [hasta=hoyEnBogota()]
 * @returns {number}
 */
export function diasHabilesDesde(fechaInicio, hasta = hoyEnBogota()) {
  const ini = parseFecha(fechaInicio);
  if (!ini) return 0;
  let count = 0;
  const d = new Date(ini);
  while (d <= hasta) {
    if (esDiaHabil(d)) count += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/**
 * Calcula el N-ésimo día hábil posterior a hoy.
 *
 * @param {number} offset `1` para mañana hábil, `2` para el siguiente.
 * @returns {Date}
 */
export function diaHabilDesdeHoy(offset) {
  let d = hoyEnBogota();
  let n = 0;
  while (n < offset) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esDiaHabil(d)) n += 1;
  }
  return d;
}

/**
 * Consolida variantes de nombres que deben compartir reglas.
 *
 * @param {unknown} tipo
 * @returns {string}
 */
export function normalizarTipo(tipo) {
  const t = String(tipo ?? '').trim();
  if (t === 'Media Canal 1' || t.startsWith('Media Canal 1')) return 'Media Canal 1';
  if (t === 'Media Canal 2 Cola' || t.startsWith('Media Canal 2')) return 'Media Canal 2 Cola';
  return t;
}

/**
 * Completa el código con el sufijo del tipo cuando solo trae el animal.
 *
 * Los códigos con tres o más segmentos se respetan para no sobrescribir la
 * identificación entregada por la fuente.
 *
 * @param {unknown} codigo
 * @param {unknown} tipo
 * @returns {string}
 */
export function normalizarCodigoProducto(codigo, tipo) {
  const c = String(codigo ?? '').trim();
  if (!c) return '';
  const tipoNorm = normalizarTipo(tipo);
  const partes = c.split('-').map((p) => p.trim()).filter(Boolean);
  const sufijo = SUFIJO_CODIGO[tipoNorm];
  if (!sufijo) return c;
  if (partes.length >= 3) return partes.join('-');
  if (partes.length === 2) return `${partes[0]}-${partes[1]}-${sufijo}`;
  return c;
}

/**
 * @param {unknown} tipo
 * @returns {number|null} Vida útil o `null` para un tipo desconocido.
 */
export function vidaUtilDe(tipo) {
  return VIDA_UTIL_HABILES[normalizarTipo(tipo)] ?? null;
}

/**
 * @param {unknown} tipo
 * @returns {boolean}
 */
export function esMediaCanal(tipo) {
  const t = normalizarTipo(tipo);
  return t === 'Media Canal 1' || t === 'Media Canal 2 Cola';
}

function labelAlerta(alerta) {
  const map = {
    mañana: 'Mañana',
    pasado_mañana: 'Pasado mañana',
    dia_8_cava: 'Día 8 en cava',
    dia_10_cava: 'Día 10 en cava',
  };
  return map[alerta] || '';
}

/**
 * Aplica alertas preventivas de media canal sin desplazar una alerta de
 * vencimiento más urgente.
 */
function aplicarAlertasMediaCanal(tipo, diasEnCava, alertaVencimiento) {
  if (!esMediaCanal(tipo)) return alertaVencimiento;
  if (alertaVencimiento === 'mañana' || alertaVencimiento === 'pasado_mañana') return alertaVencimiento;
  if (diasEnCava === 10) return 'dia_10_cava';
  if (diasEnCava === 8) return 'dia_8_cava';
  return alertaVencimiento;
}

/**
 * Decide si un elemento procesado pertenece al reporte operativo.
 *
 * @param {{ alerta?: string, tipo_producto?: string }} item
 * @returns {boolean}
 */
export function incluirEnReporte(item) {
  if (item.alerta === 'mañana' || item.alerta === 'pasado_mañana') return true;
  if (esMediaCanal(item.tipo_producto) && (item.alerta === 'dia_8_cava' || item.alerta === 'dia_10_cava')) {
    return true;
  }
  return false;
}

/**
 * Compara un vencimiento contra los dos próximos días hábiles.
 *
 * @param {Date|string|null} fechaVencimiento
 * @param {Date} [hoy=hoyEnBogota()] Reservado para una fecha de referencia.
 * @returns {'mañana'|'pasado_mañana'|'otro'}
 */
export function clasificarAlerta(fechaVencimiento, hoy = hoyEnBogota()) {
  const venc = parseFecha(fechaVencimiento);
  if (!venc) return 'otro';
  const manana = diaHabilDesdeHoy(1);
  const pasado = diaHabilDesdeHoy(2);
  const v = fmtFechaIso(venc);
  if (v === fmtFechaIso(manana)) return 'mañana';
  if (v === fmtFechaIso(pasado)) return 'pasado_mañana';
  return 'otro';
}

/**
 * Añade a un producto los campos derivados de vida útil y alerta.
 *
 * @param {Record<string, any>} p Producto normalizado por la capa de consultas.
 * @returns {Record<string, any>} Nuevo objeto; no modifica la entrada.
 */
export function enriquecerProducto(p) {
  const tipo = normalizarTipo(p.tipo_producto);
  const vida = vidaUtilDe(tipo);
  const ingreso = parseFecha(p.fecha_ingreso);
  const fechaVencimiento = ingreso && vida ? addDiasHabiles(ingreso, vida) : null;
  const diasEnCava = ingreso ? diasHabilesDesde(ingreso) : 0;
  const alertaVenc = fechaVencimiento ? clasificarAlerta(fechaVencimiento) : 'otro';
  const alerta = aplicarAlertasMediaCanal(tipo, diasEnCava, alertaVenc);
  return {
    ...p,
    tipo_producto: tipo,
    vida_util_habiles: vida,
    fecha_vencimiento: fechaVencimiento ? fmtFecha(fechaVencimiento) : '',
    fecha_vencimiento_iso: fechaVencimiento ? fmtFechaIso(fechaVencimiento) : '',
    dias_habiles_en_cava: diasEnCava,
    alerta,
    alerta_label: labelAlerta(alerta),
  };
}

/**
 * Normaliza fechas y alerta de un corte consultado.
 *
 * @param {Record<string, any>} c Corte normalizado.
 * @returns {Record<string, any>}
 */
export function enriquecerCorte(c) {
  const venc = parseFecha(c.fecha_vencimiento);
  const alerta = clasificarAlerta(venc);
  const prod = parseFecha(c.fecha_produccion);
  return {
    ...c,
    propietario: c.cliente || c.propietario || 'SIN CLIENTE',
    fecha_vencimiento: venc ? fmtFecha(venc) : c.fecha_vencimiento,
    fecha_vencimiento_iso: venc ? fmtFechaIso(venc) : '',
    fecha_produccion: prod ? fmtFecha(prod) : c.fecha_produccion,
    alerta,
    alerta_label: alerta === 'mañana' ? 'Mañana' : alerta === 'pasado_mañana' ? 'Pasado mañana' : '',
  };
}

/**
 * @template T
 * @param {T[]} items Elementos enriquecidos con alerta y tipo.
 * @returns {T[]}
 */
export function filtrarProximos(items) {
  return items.filter(incluirEnReporte);
}

/**
 * Extrae los dos primeros segmentos que identifican al animal.
 *
 * @param {unknown} codigo
 * @returns {string}
 */
export function animalBase(codigo) {
  const partes = String(codigo ?? '')
    .trim()
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean);
  return partes.length >= 2 ? `${partes[0]}-${partes[1]}` : String(codigo ?? '').trim();
}

/**
 * La lengua comparte animal_base con la media canal del mismo animal.
 * Si la lengua no tiene destino, se toma de la media canal vinculada.
 * Se prioriza Media Canal 1 y se usa Media Canal 2 Cola como respaldo.
 *
 * @param {Array<Record<string, any>>} productos
 * @returns {Array<Record<string, any>>} Colección nueva con vínculo y datos heredados.
 */
export function vincularLenguaConMediaCanal(productos) {
  const mediasPorAnimal = new Map();
  for (const p of productos) {
    if (!/media canal/i.test(p.tipo_producto)) continue;
    const base = animalBase(p.codigo);
    if (!mediasPorAnimal.has(base)) mediasPorAnimal.set(base, []);
    mediasPorAnimal.get(base).push(p);
  }

  return productos.map((p) => {
    if (normalizarTipo(p.tipo_producto) !== 'Lengua') {
      return { ...p, animal_base: animalBase(p.codigo), media_vinculada: '', media_vinculada_tipo: '' };
    }
    const base = animalBase(p.codigo);
    const medias = mediasPorAnimal.get(base) || [];
    const mc1 = medias.find((m) => m.tipo_producto === 'Media Canal 1');
    const mc2 = medias.find((m) => m.tipo_producto === 'Media Canal 2 Cola');
    const ref = mc1 || mc2;
    if (!ref) {
      return { ...p, animal_base: base, media_vinculada: '', media_vinculada_tipo: '' };
    }
    return {
      ...p,
      animal_base: base,
      media_vinculada: ref.codigo,
      media_vinculada_tipo: ref.tipo_producto,
      destino: p.destino || ref.destino,
      sucursal: p.sucursal || ref.sucursal,
    };
  });
}
