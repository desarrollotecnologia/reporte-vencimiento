import { config } from './config.js';
import { closePool } from './db.js';
import { fetchProductosEnCava, fetchCortesEnCava } from './queries.js';
import {
  enriquecerProducto,
  enriquecerCorte,
  filtrarProximos,
  fmtFecha,
  diaHabilDesdeHoy,
  vincularLenguaConMediaCanal,
} from './vidaUtil.js';
import { generarExcel } from './excel.js';
import { enviarReporteConConfirmacion, enviarReportePrueba } from './email.js';

function fechaReporteBogota() {
  return new Date().toLocaleDateString('es-CO', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function resumenProductos(productos, cortes) {
  const map = new Map();
  for (const p of productos) {
    const k = p.tipo_producto || 'Sin tipo';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return {
    totalProductos: productos.length,
    totalCortes: cortes.length,
    mananaProductos: productos.filter((p) => p.alerta === 'mañana').length,
    pasadoProductos: productos.filter((p) => p.alerta === 'pasado_mañana').length,
    mananaCortes: cortes.filter((c) => c.alerta === 'mañana').length,
    pasadoCortes: cortes.filter((c) => c.alerta === 'pasado_mañana').length,
    fManana: fmtFecha(diaHabilDesdeHoy(1)),
    fPasado: fmtFecha(diaHabilDesdeHoy(2)),
    porTipo: [...map.entries()]
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo, 'es')),
  };
}

export async function ejecutarReporte({ enviarCorreo = true, modo = 'produccion' } = {}) {
  const fechaReporte = fechaReporteBogota();
  console.log(`[${new Date().toISOString()}] Generando reporte para ${fechaReporte}...`);

  const [rawProd, rawCortes] = await Promise.all([fetchProductosEnCava(), fetchCortesEnCava()]);

  const vinculados = vincularLenguaConMediaCanal(rawProd);
  const todosEnCava = vinculados.map(enriquecerProducto);
  const productos = filtrarProximos(todosEnCava);
  const cortes = filtrarProximos(rawCortes.map(enriquecerCorte));

  console.log(`  → ${todosEnCava.length} productos en cava`);
  console.log(`  → ${productos.length} productos próximos a vencer (mañana / pasado mañana)`);
  console.log(`  → ${cortes.length} cortes próximos a vencer`);

  const { ruta, nombreArchivo } = await generarExcel({
    productos,
    productosEnCava: todosEnCava,
    cortes,
    fechaReporte,
  });
  console.log(`  → Excel: ${ruta}`);

  const resumen = resumenProductos(productos, cortes);

  if (enviarCorreo) {
    if (modo === 'prueba') {
      const info = await enviarReportePrueba({ rutaExcel: ruta, nombreArchivo, resumen, fechaReporte });
      console.log(`  → Prueba enviada a: ${config.reportNotifyTo.join(', ')} (${info.messageId})`);
    } else {
      const { reporte, confirmacion, destinatarios } = await enviarReporteConConfirmacion({
        rutaExcel: ruta,
        nombreArchivo,
        resumen,
        fechaReporte,
      });
      console.log(`  → Reporte enviado a: ${destinatarios.join(', ')} (${reporte.messageId})`);
      if (confirmacion) {
        console.log(`  → Confirmación enviada a: ${config.reportNotifyTo.join(', ')} (${confirmacion.messageId})`);
      }
    }
  }

  return { fechaReporte, productos, productosEnCava: todosEnCava, cortes, ruta, resumen };
}

export async function shutdown() {
  await closePool();
}
