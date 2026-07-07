import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

function envStr(key, fallback = '') {
  const v = process.env[key];
  return v === undefined || v === null ? fallback : String(v);
}

function envInt(key, fallback) {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  postgres: {
    host: envStr('POSTGRES_HOST'),
    port: envInt('POSTGRES_PORT', 5432),
    database: envStr('POSTGRES_DB'),
    user: envStr('POSTGRES_USER'),
    password: envStr('POSTGRES_PASSWORD'),
    ssl: envStr('POSTGRES_SSL', 'false').toLowerCase() === 'true',
  },
  smtp: {
    host: envStr('SMTP_HOST'),
    port: envInt('SMTP_PORT', 465),
    user: envStr('SMTP_USER'),
    password: envStr('SMTP_PASSWORD'),
    useTls: envStr('SMTP_USE_TLS', 'false').toLowerCase() === 'true',
    from: envStr('SMTP_FROM'),
    fromName: envStr('SMTP_FROM_NAME', 'Sistema Reportes'),
  },
  reportTo: envStr('REPORT_TO')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),
  /** Solo recibe confirmación de envío (sin adjunto). */
  reportNotifyTo: envStr('REPORT_NOTIFY_TO')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),
  cronSchedule: envStr('CRON_SCHEDULE', '59 5 * * *'),
  timezone: envStr('TIMEZONE', 'America/Bogota'),
  diasEnCava: envInt('DIAS_EN_CAVA', 3),
  diasVencimientoCortes: envInt('DIAS_VENCIMIENTO_CORTES', 3),
  /** Ventana hacia atrás para cortes vencidos recientes (evita histórico obsoleto). */
  cortesLookbackDias: envInt('CORTES_LOOKBACK_DIAS', 7),
  /** adesposte | pbi05 | both */
  cortesFuente: envStr('CORTES_FUENTE', 'both').toLowerCase(),
  reportsDir: join(__dirname, '..', 'reports'),
};

export const TIPOS_CAVA = [
  'Lengua',
  'Media Canal 1',
  'Media Canal 2 Cola',
  'Patas y Manos',
  'Visceras Blancas',
  'Visceras Rojas',
  'Cabeza',
];
