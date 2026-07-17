/**
 * Capa de presentación para Microsoft Excel.
 *
 * Convierte los modelos ya enriquecidos en un libro navegable. Este módulo no
 * calcula vencimientos: solo agrega, ordena y representa los resultados que
 * recibe del dominio.
 */
import ExcelJS from 'exceljs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';
import {
  VIDA_UTIL_HABILES,
  TIPOS_REPORTE,
  TIPOS_RESUMEN_ORDEN,
  ETIQUETA_TIPO,
  fmtFecha,
  diaHabilDesdeHoy,
} from './vidaUtil.js';

const VERDE = 'FF259C39';
const VERDE_OSC = 'FF1B5E20';
const BLANCO = 'FFFFFFFF';
const AMARILLO = 'FFFFF9C4';
const NARANJA = 'FFFFE0B2';
const AZUL = 'FFE3F2FD';
const GRIS = 'FFF5F5F5';
const ROJO = 'FFFFCDD2';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
const HEADER_FONT = { bold: true, color: { argb: BLANCO }, size: 11 };

/** Aplica un color de fondo uniforme conservando valores y demás estilos. */
function fillRow(row, color) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });
}

/** Establece la convención visual de todos los encabezados tabulares. */
function estiloEncabezado(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderThin();
  });
  row.height = 26;
}

/** Crea un borde nuevo para evitar compartir objetos mutables entre celdas. */
function borderThin() {
  return {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  };
}

/**
 * Ajusta el ancho según el contenido y aplica límites para evitar hojas
 * ilegibles por columnas extremadamente cortas o largas.
 */
function autoAncho(hoja, min = 10, max = 42) {
  hoja.columns.forEach((col) => {
    let w = min;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value?.text ?? cell.value ?? '').length;
      if (len + 2 > w) w = Math.min(len + 2, max);
    });
    col.width = w;
  });
}

/** Inserta una banda de título combinada con el estilo corporativo. */
function titulo(hoja, fila, texto, cols = 8) {
  hoja.mergeCells(fila, 1, fila, cols);
  const cell = hoja.getCell(fila, 1);
  cell.value = texto;
  cell.font = { bold: true, size: 14, color: { argb: BLANCO } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSC } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  hoja.getRow(fila).height = 28;
}

/** @deprecated Utilidad conservada; no participa en la generación actual. */
function contarPor(items, fn) {
  const m = new Map();
  for (const x of items) {
    const k = fn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Calcula indicadores del resumen general respetando el orden de negocio. */
function resumenPorTipo(todosEnCava, proximos) {
  return TIPOS_RESUMEN_ORDEN.map((tipo) => {
    const enCava = todosEnCava.filter((p) => p.tipo_producto === tipo);
    const cerca = proximos.filter((p) => p.tipo_producto === tipo);
    return {
      tipo,
      etiqueta: ETIQUETA_TIPO[tipo] || tipo,
      vida_util: VIDA_UTIL_HABILES[tipo],
      en_cava: enCava.length,
      total: cerca.length,
      manana: cerca.filter((p) => p.alerta === 'mañana').length,
      pasado: cerca.filter((p) => p.alerta === 'pasado_mañana').length,
      dia8: cerca.filter((p) => p.alerta === 'dia_8_cava').length,
      dia10: cerca.filter((p) => p.alerta === 'dia_10_cava').length,
    };
  });
}

/** Agrupa productos por propietario y calcula totales por tipo y alerta. */
function resumenPropietarios(items, campoProp = 'propietario') {
  const props = [...new Set(items.map((x) => x[campoProp] || 'SIN PROPIETARIO'))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  return props.map((prop) => {
    const delProp = items.filter((x) => (x[campoProp] || 'SIN PROPIETARIO') === prop);
    const porTipo = Object.fromEntries(TIPOS_REPORTE.map((t) => [t, 0]));
    delProp.forEach((p) => {
      if (porTipo[p.tipo_producto] !== undefined) porTipo[p.tipo_producto] += 1;
    });
    return {
      propietario: prop,
      ...porTipo,
      total: delProp.length,
      manana: delProp.filter((x) => x.alerta === 'mañana').length,
      pasado: delProp.filter((x) => x.alerta === 'pasado_mañana').length,
    };
  });
}

/** Agrupa cortes por cliente para construir la hoja de navegación. */
function resumenCortesCliente(cortes) {
  const clientes = [...new Set(cortes.map((c) => c.propietario || 'SIN CLIENTE'))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  return clientes.map((cli) => {
    const del = cortes.filter((c) => (c.propietario || 'SIN CLIENTE') === cli);
    return {
      cliente: cli,
      total: del.length,
      manana: del.filter((c) => c.alerta === 'mañana').length,
      pasado: del.filter((c) => c.alerta === 'pasado_mañana').length,
    };
  });
}

/** Traduce la prioridad funcional de una alerta a su color de presentación. */
function colorAlerta(alerta) {
  if (alerta === 'mañana') return NARANJA;
  if (alerta === 'pasado_mañana') return AZUL;
  if (alerta === 'dia_8_cava') return AMARILLO;
  if (alerta === 'dia_10_cava') return ROJO;
  return null;
}

/** Construye un vínculo interno compatible con nombres de hoja con espacios. */
function linkHoja(nombreHoja, celda) {
  return `#'${nombreHoja}'!${celda}`;
}

/** Aplica texto y formato de enlace a una celda del resumen. */
function aplicarHipervinculo(celda, texto, nombreHoja, celdaDestino) {
  celda.value = { text: texto, hyperlink: linkHoja(nombreHoja, celdaDestino) };
  celda.font = { color: { argb: 'FF1565C0' }, underline: true };
}

/**
 * Añade filtros y formato de tabla cuando existen filas.
 *
 * ExcelJS puede rechazar rangos que ya tengan determinadas combinaciones de
 * formato. La tabla es una mejora opcional, por lo que el libro continúa como
 * rango normal si esa operación falla.
 */
function agregarTabla(hoja, nombre, ref, columnas, filas) {
  if (!filas.length) return;
  try {
    hoja.addTable({
      name: nombre,
      ref,
      headerRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: columnas.map((c) => ({ name: c, filterButton: true })),
      rows: filas,
    });
  } catch {
    // Si el rango ya tiene formato, la hoja sigue siendo usable sin tabla dinámica.
  }
}

/**
 * Crea la hoja detallada de productos y registra la primera fila de cada
 * propietario para enlazarla desde el resumen.
 */
function hojaDetalleProductos(wb, productos, anchors) {
  const h = wb.addWorksheet('Detalle Productos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const headers = [
    'Propietario',
    'Código',
    'Animal base',
    'Media vinculada',
    'Tipo',
    'Alerta',
    'Fecha ingreso',
    'Fecha vencimiento',
    'Vida útil (días háb.)',
    'Días háb. en cava',
    'Cava',
    'Destino',
    'Sucursal',
    'Observaciones',
  ];
  h.addRow(headers);
  estiloEncabezado(h.getRow(1));

  const sorted = [...productos].sort((a, b) => {
    const p = a.propietario.localeCompare(b.propietario, 'es');
    return p !== 0 ? p : a.codigo.localeCompare(b.codigo);
  });

  const filasTabla = [];
  sorted.forEach((p) => {
    if (!anchors.has(p.propietario)) anchors.set(p.propietario, h.rowCount + 1);
    const row = h.addRow([
      p.propietario,
      p.codigo,
      p.animal_base || '',
      p.media_vinculada ? `${p.media_vinculada} (${p.media_vinculada_tipo || ''})` : '',
      ETIQUETA_TIPO[p.tipo_producto] || p.tipo_producto,
      p.alerta_label,
      p.fecha_ingreso,
      p.fecha_vencimiento,
      p.vida_util_habiles,
      p.dias_habiles_en_cava,
      p.cava,
      p.destino,
      p.sucursal,
      p.observaciones,
    ]);
    const c = colorAlerta(p.alerta);
    if (c) fillRow(row, c);
    row.eachCell((cell) => {
      cell.border = borderThin();
    });
    filasTabla.push([
      p.propietario,
      p.codigo,
      p.animal_base || '',
      p.media_vinculada ? `${p.media_vinculada} (${p.media_vinculada_tipo || ''})` : '',
      ETIQUETA_TIPO[p.tipo_producto] || p.tipo_producto,
      p.alerta_label,
      p.fecha_ingreso,
      p.fecha_vencimiento,
      p.vida_util_habiles,
      p.dias_habiles_en_cava,
      p.cava,
      p.destino,
      p.sucursal,
      p.observaciones,
    ]);
  });

  if (filasTabla.length) {
    agregarTabla(h, 'TablaDetalleProductos', `A1:N${filasTabla.length + 1}`, headers, filasTabla);
  }
  autoAncho(h);
  return h;
}

/**
 * Genera y persiste el libro completo del reporte.
 *
 * @param {object} input
 * @param {Array<Record<string, any>>} input.productos Productos con alerta.
 * @param {Array<Record<string, any>>} [input.productosEnCava=input.productos] Inventario completo.
 * @param {Array<Record<string, any>>} input.cortes Cortes con alerta.
 * @param {string} input.fechaReporte Fecha utilizada en títulos y nombre.
 * @returns {Promise<{
 *   ruta: string,
 *   nombreArchivo: string,
 *   fManana: string,
 *   fPasado: string
 * }>}
 */
export async function generarExcel({ productos, productosEnCava = productos, cortes, fechaReporte }) {
  await mkdir(config.reportsDir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bot Vencimiento Cava — Colbeef';
  wb.created = new Date();

  const fManana = fmtFecha(diaHabilDesdeHoy(1));
  const fPasado = fmtFecha(diaHabilDesdeHoy(2));
  const anchorsProd = new Map();

  // ── HOJA 1: RESUMEN ─────────────────────────────────────────────────────
  const res = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 4 }] });
  titulo(res, 1, 'Reporte de vencimiento en cava — Colbeef', 8);
  res.addRow([]);
  res.getCell(3, 1).value = 'Fecha del reporte';
  res.getCell(3, 2).value = fechaReporte;
  res.getCell(3, 4).value = 'Vence mañana';
  res.getCell(3, 5).value = fManana;
  res.getCell(3, 6).value = 'Vence pasado mañana';
  res.getCell(3, 7).value = fPasado;
  res.getRow(3).font = { bold: true };

  let row = 5;
  res.getCell(row, 1).value = 'PRODUCTOS EN CAVA (días hábiles)';
  res.getCell(row, 1).font = { bold: true, color: { argb: VERDE_OSC }, size: 12 };
  row += 1;

  const headProd = [
    'Producto',
    'Vida útil (días háb.)',
    'Total en cava',
    'Próximos a vencer',
    'Mañana',
    'Pasado mañana',
    'Día 8 en cava (MC)',
    'Día 10 en cava (MC)',
  ];
  res.addRow(headProd);
  estiloEncabezado(res.getRow(row));
  row += 1;

  const resTipos = resumenPorTipo(productosEnCava, productos);
  for (const r of resTipos) {
    const dataRow = res.addRow([
      r.etiqueta,
      r.vida_util,
      r.en_cava,
      r.total,
      r.manana,
      r.pasado,
      r.dia8,
      r.dia10,
    ]);
    dataRow.eachCell((cell) => {
      cell.border = borderThin();
      cell.alignment = { horizontal: 'center' };
    });
    dataRow.getCell(1).alignment = { horizontal: 'left' };
    if (r.manana > 0) dataRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
    if (r.pasado > 0) dataRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    if (r.dia8 > 0) dataRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } };
    if (r.dia10 > 0) dataRow.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } };
    row += 1;
  }
  const totalRow = res.addRow([
    'TOTAL',
    '',
    productosEnCava.length,
    productos.length,
    productos.filter((p) => p.alerta === 'mañana').length,
    productos.filter((p) => p.alerta === 'pasado_mañana').length,
    productos.filter((p) => p.alerta === 'dia_8_cava').length,
    productos.filter((p) => p.alerta === 'dia_10_cava').length,
  ]);
  totalRow.font = { bold: true };
  fillRow(totalRow, GRIS);
  row = totalRow.number + 1;
  res.getCell(row, 1).value =
    'Nota: Lengua y media canal del mismo animal comparten código base (ej. 2606-12533). En detalle, Media vinculada muestra la media canal asociada.';
  res.getCell(row, 1).font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  res.mergeCells(row, 1, row, 8);
  row += 2;

  res.getCell(row, 1).value = 'CORTES EN CAVA';
  res.getCell(row, 1).font = { bold: true, color: { argb: VERDE_OSC }, size: 12 };
  row += 1;
  const headCortes = ['', 'Total próximos', 'Mañana', 'Pasado mañana'];
  res.addRow(headCortes);
  estiloEncabezado(res.getRow(row));
  row += 1;
  res.addRow([
    'Cortes de desposte',
    cortes.length,
    cortes.filter((c) => c.alerta === 'mañana').length,
    cortes.filter((c) => c.alerta === 'pasado_mañana').length,
  ]);
  res.getRow(row).eachCell((c) => {
    c.border = borderThin();
    c.alignment = { horizontal: 'center' };
  });
  res.getRow(row).getCell(1).alignment = { horizontal: 'left' };
  row += 2;

  res.getCell(row, 1).value = 'Leyenda';
  res.getCell(row, 1).font = { bold: true };
  row += 1;
  res.addRow(['Mañana', 'Producto que debe salir de cava el próximo día hábil (vence mañana)']);
  fillRow(res.getRow(row), NARANJA);
  row += 1;
  res.addRow(['Pasado mañana', 'Producto que vence en el segundo día hábil siguiente']);
  fillRow(res.getRow(row), AZUL);
  row += 1;
  res.addRow(['Día 8 en cava (MC)', 'Media canal con 8 días hábiles en cava — alerta anticipada de salida']);
  fillRow(res.getRow(row), AMARILLO);
  row += 1;
  res.addRow(['Día 10 en cava (MC)', 'Media canal con 10 días hábiles en cava — segunda alerta si no salió']);
  fillRow(res.getRow(row), ROJO);
  autoAncho(res);

  // ── HOJA 2: PRODUCTOS RESUMEN (tabla dinámica por propietario) ───────────
  const prodRes = wb.addWorksheet('Productos - Resumen', { views: [{ state: 'frozen', ySplit: 3 }] });
  titulo(prodRes, 1, 'Productos por propietario — use filtros o enlace Ver detalle', 6 + TIPOS_REPORTE.length);
  prodRes.addRow([]);
  const colsRes = [
    'Propietario',
    ...TIPOS_REPORTE,
    'Total',
    'Mañana',
    'Pasado mañana',
    'Ver detalle',
  ];
  prodRes.addRow(colsRes);
  estiloEncabezado(prodRes.getRow(3));

  hojaDetalleProductos(wb, productos, anchorsProd);

  const resProp = resumenPropietarios(productos);
  const filasResProp = [];
  const filasPropMeta = [];
  resProp.forEach((r) => {
    const dataRow = prodRes.addRow([
      r.propietario,
      ...TIPOS_REPORTE.map((t) => r[t] || 0),
      r.total,
      r.manana,
      r.pasado,
      anchorsProd.has(r.propietario) ? 'Ver detalle ▶' : '',
    ]);
    filasResProp.push([
      r.propietario,
      ...TIPOS_REPORTE.map((t) => r[t] || 0),
      r.total,
      r.manana,
      r.pasado,
    ]);
    filasPropMeta.push({ r, rowNum: dataRow.number });
    dataRow.eachCell((cell) => {
      cell.border = borderThin();
      cell.alignment = { horizontal: 'center' };
    });
    dataRow.getCell(1).alignment = { horizontal: 'left' };
    if (r.manana > 0) dataRow.getCell(colsRes.length - 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
    if (r.pasado > 0) dataRow.getCell(colsRes.length - 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  });

  if (filasResProp.length) {
    const endCol = String.fromCharCode(64 + colsRes.length - 1);
    agregarTabla(
      prodRes,
      'TablaResumenProductos',
      `A3:${endCol}${filasResProp.length + 3}`,
      colsRes.slice(0, -1),
      filasResProp
    );
  }

  filasPropMeta.forEach(({ r, rowNum }) => {
    const anchor = anchorsProd.get(r.propietario);
    if (!anchor) return;
    const destino = `A${anchor}`;
    aplicarHipervinculo(prodRes.getCell(rowNum, 1), r.propietario, 'Detalle Productos', destino);
    aplicarHipervinculo(prodRes.getCell(rowNum, colsRes.length), 'Ver detalle ▶', 'Detalle Productos', destino);
  });
  autoAncho(prodRes);

  // ── HOJA 4-5: CORTES ────────────────────────────────────────────────────
  const anchorsCortes = new Map();
  const cortRes = wb.addWorksheet('Cortes - Resumen', { views: [{ state: 'frozen', ySplit: 3 }] });
  titulo(cortRes, 1, 'Cortes por cliente — próximos a vencer', 6);
  cortRes.addRow([]);
  const colsCortRes = ['Cliente / Propietario', 'Total', 'Mañana', 'Pasado mañana', 'Ver detalle'];
  cortRes.addRow(colsCortRes);
  estiloEncabezado(cortRes.getRow(3));

  const hDetCort = wb.addWorksheet('Detalle Cortes', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headCort = [
    'Cliente',
    'Corte',
    'Alerta',
    'Identificación',
    'Lote interno',
    'Fecha producción',
    'Fecha vencimiento',
    'Ubicación',
    'Kilos',
    'Conservación',
  ];
  hDetCort.addRow(headCort);
  estiloEncabezado(hDetCort.getRow(1));
  const filasCortDet = [];
  const cortSorted = [...cortes].sort((a, b) => a.propietario.localeCompare(b.propietario, 'es'));
  cortSorted.forEach((c) => {
    if (!anchorsCortes.has(c.propietario)) anchorsCortes.set(c.propietario, hDetCort.rowCount + 1);
    const rowC = hDetCort.addRow([
      c.propietario,
      c.corte,
      c.alerta_label,
      c.identificacion,
      c.lote_interno,
      c.fecha_produccion,
      c.fecha_vencimiento,
      c.ubicacion,
      c.kilos,
      c.tipo_conservacion,
    ]);
    const col = colorAlerta(c.alerta);
    if (col) fillRow(rowC, col);
    rowC.eachCell((cell) => {
      cell.border = borderThin();
    });
    filasCortDet.push([
      c.propietario,
      c.corte,
      c.alerta_label,
      c.identificacion,
      c.lote_interno,
      c.fecha_produccion,
      c.fecha_vencimiento,
      c.ubicacion,
      c.kilos,
      c.tipo_conservacion,
    ]);
  });
  if (filasCortDet.length) {
    agregarTabla(hDetCort, 'TablaDetalleCortes', `A1:J${filasCortDet.length + 1}`, headCort, filasCortDet);
  }
  autoAncho(hDetCort);

  const resCortCli = resumenCortesCliente(cortes);
  const filasResCort = [];
  const filasCortMeta = [];
  resCortCli.forEach((r) => {
    const dataRow = cortRes.addRow([
      r.cliente,
      r.total,
      r.manana,
      r.pasado,
      anchorsCortes.has(r.cliente) ? 'Ver detalle ▶' : '',
    ]);
    filasResCort.push([r.cliente, r.total, r.manana, r.pasado]);
    filasCortMeta.push({ r, rowNum: dataRow.number });
    dataRow.eachCell((cell) => {
      cell.border = borderThin();
      cell.alignment = { horizontal: 'center' };
    });
    dataRow.getCell(1).alignment = { horizontal: 'left' };
  });
  if (filasResCort.length) {
    agregarTabla(cortRes, 'TablaResumenCortes', `A3:D${filasResCort.length + 3}`, colsCortRes.slice(0, 4), filasResCort);
  }
  filasCortMeta.forEach(({ r, rowNum }) => {
    const anchor = anchorsCortes.get(r.cliente);
    if (!anchor) return;
    const destino = `A${anchor}`;
    aplicarHipervinculo(cortRes.getCell(rowNum, 1), r.cliente, 'Detalle Cortes', destino);
    aplicarHipervinculo(cortRes.getCell(rowNum, 5), 'Ver detalle ▶', 'Detalle Cortes', destino);
  });
  autoAncho(cortRes);

  const nombreArchivo = `reporte-vencimiento-cava-${fechaReporte.replace(/\//g, '')}.xlsx`;
  const ruta = join(config.reportsDir, nombreArchivo);
  await wb.xlsx.writeFile(ruta);
  return { ruta, nombreArchivo, fManana, fPasado };
}
