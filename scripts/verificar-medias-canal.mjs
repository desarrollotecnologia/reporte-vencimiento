import dotenv from 'dotenv';
dotenv.config();
import { fetchProductosEnCava } from '../src/queries.js';
import { enriquecerProducto, filtrarProximos } from '../src/vidaUtil.js';
import { closePool } from '../src/db.js';

const raw = await fetchProductosEnCava();
const proximos = filtrarProximos(raw.map(enriquecerProducto));

const medias = proximos.filter((p) => /media canal/i.test(p.tipo_producto));
const viscerasEnMedias = proximos.filter(
  (p) => /media canal/i.test(p.codigo) && !/media canal/i.test(p.tipo_producto)
);
const codigosCortosMedia = proximos.filter(
  (p) => /media canal/i.test(p.tipo_producto) && !p.codigo.endsWith('-1001') && !p.codigo.endsWith('-1002')
);

console.log(`Total en cava: ${raw.length} | Próximos a vencer: ${proximos.length}`);
console.log(`Medias canal próximas: ${medias.length}`);
console.log('\nMuestra medias canal:');
console.table(
  medias.slice(0, 10).map((p) => ({
    codigo: p.codigo,
    tipo: p.tipo_producto,
    propietario: p.propietario,
    alerta: p.alerta_label,
    vence: p.fecha_vencimiento,
  }))
);

const porTipo = Object.groupBy(proximos, (p) => p.tipo_producto);
console.log('\nConteo por tipo (próximos):');
for (const [tipo, items] of Object.entries(porTipo).sort()) {
  console.log(`  ${tipo}: ${items.length}`);
}

if (viscerasEnMedias.length) {
  console.warn('\n⚠ Códigos con patrón media mal tipados:', viscerasEnMedias.length);
}
if (codigosCortosMedia.length) {
  console.warn('⚠ Medias canal sin sufijo 1001/1002:', codigosCortosMedia.length);
  console.table(codigosCortosMedia.slice(0, 5).map((p) => ({ codigo: p.codigo, tipo: p.tipo_producto })));
}

await closePool();
