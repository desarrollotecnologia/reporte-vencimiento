import cron from 'node-cron';
import os from 'os';
import { config } from './config.js';
import { ejecutarReporte, shutdown } from './report.js';

const runNow = process.argv.includes('--now');
const runPrueba = process.argv.includes('--prueba');

function ipServidor() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function main() {
  const ip = ipServidor();
  console.log('Bot Vencimiento Cava — Colbeef');
  console.log(`Servidor: ${ip}`);
  console.log(`Programación: ${config.cronSchedule} (${config.timezone})`);
  console.log(`Destinatarios reporte: ${config.reportTo.join(', ') || '(ninguno)'}`);
  if (config.reportNotifyTo.length) {
    console.log(`Confirmación / prueba: ${config.reportNotifyTo.join(', ')}`);
  }

  if (runPrueba) {
    try {
      await ejecutarReporte({ modo: 'prueba' });
    } finally {
      await shutdown();
    }
    return;
  }

  if (runNow) {
    try {
      await ejecutarReporte();
    } finally {
      await shutdown();
    }
    return;
  }

  cron.schedule(
    config.cronSchedule,
    async () => {
      try {
        await ejecutarReporte();
      } catch (err) {
        console.error('[CRON] Error en reporte:', err.message);
      }
    },
    { timezone: config.timezone }
  );

  console.log('Bot activo. Esperando próxima ejecución programada (6:00 AM)...');
  console.log('Prueba manual: npm run prueba');
}

main().catch(async (err) => {
  console.error('Error fatal:', err.message);
  await shutdown();
  process.exit(1);
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});
