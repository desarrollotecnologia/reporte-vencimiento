import { fetchCortesPorVencer, fetchCortesPorVencerAdesposte, fetchCortesPorVencerPbi } from '../src/queries.js';
import { closePool } from '../src/db.js';

const [adesposte, pbi, both] = await Promise.all([
  fetchCortesPorVencerAdesposte(),
  fetchCortesPorVencerPbi(),
  fetchCortesPorVencer(),
]);

console.log('a_desposte:', adesposte.length);
console.log('vw_pbi05:', pbi.length);
console.log('combinado:', both.length);
console.log('muestra a_desposte:', JSON.stringify(adesposte.slice(0, 3), null, 2));
await closePool();
