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

export function hoyEnBogota() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

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

export function fmtFecha(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function fmtFechaIso(d) {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function esDiaHabil(d) {
  const w = d.getUTCDay();
  return w !== 0 && w !== 6;
}

/** Suma N días hábiles a partir de la fecha de ingreso (día 0 = ingreso). */
export function addDiasHabiles(fechaInicio, diasHabiles) {
  const d = new Date(fechaInicio);
  let sumados = 0;
  while (sumados < diasHabiles) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esDiaHabil(d)) sumados += 1;
  }
  return d;
}

/** Días hábiles transcurridos desde ingreso hasta hoy (inclusive del ingreso si es hábil). */
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

/** N-ésimo día hábil a partir de hoy (1 = mañana, 2 = pasado mañana). */
export function diaHabilDesdeHoy(offset) {
  let d = hoyEnBogota();
  let n = 0;
  while (n < offset) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esDiaHabil(d)) n += 1;
  }
  return d;
}

export function normalizarTipo(tipo) {
  const t = String(tipo ?? '').trim();
  if (t === 'Media Canal 1' || t.startsWith('Media Canal 1')) return 'Media Canal 1';
  if (t === 'Media Canal 2 Cola' || t.startsWith('Media Canal 2')) return 'Media Canal 2 Cola';
  return t;
}

/** Completa el código con el sufijo del tipo cuando solo trae animal (2 segmentos). */
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

export function vidaUtilDe(tipo) {
  return VIDA_UTIL_HABILES[normalizarTipo(tipo)] ?? null;
}

/**
 * Clasifica vencimiento: mañana | pasado_mañana | otro
 * según fecha límite de salida de cava.
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

export function enriquecerProducto(p) {
  const tipo = normalizarTipo(p.tipo_producto);
  const vida = vidaUtilDe(tipo);
  const ingreso = parseFecha(p.fecha_ingreso);
  const fechaVencimiento = ingreso && vida ? addDiasHabiles(ingreso, vida) : null;
  const alerta = fechaVencimiento ? clasificarAlerta(fechaVencimiento) : 'otro';
  return {
    ...p,
    tipo_producto: tipo,
    vida_util_habiles: vida,
    fecha_vencimiento: fechaVencimiento ? fmtFecha(fechaVencimiento) : '',
    fecha_vencimiento_iso: fechaVencimiento ? fmtFechaIso(fechaVencimiento) : '',
    dias_habiles_en_cava: ingreso ? diasHabilesDesde(ingreso) : 0,
    alerta,
    alerta_label: alerta === 'mañana' ? 'Mañana' : alerta === 'pasado_mañana' ? 'Pasado mañana' : '',
  };
}

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

export function filtrarProximos(items) {
  return items.filter((x) => x.alerta === 'mañana' || x.alerta === 'pasado_mañana');
}
