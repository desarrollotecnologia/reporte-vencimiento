/**
 * Configuración central de la aplicación.
 *
 * Este módulo es la única frontera entre las variables de entorno y el resto
 * del código productivo. Carga el archivo `.env` desde la raíz del proyecto
 * para que la configuración no dependa del directorio desde el que se ejecute
 * Node.js.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Obtiene una variable como texto sin convertir valores vacíos al fallback.
 *
 * @param {string} key Nombre de la variable de entorno.
 * @param {string} [fallback=''] Valor usado cuando la variable no existe.
 * @returns {string}
 */
function envStr(key, fallback = '') {
  const v = process.env[key];
  return v === undefined || v === null ? fallback : String(v);
}

/**
 * Convierte una variable a número y evita propagar `NaN` a la configuración.
 *
 * @param {string} key Nombre de la variable de entorno.
 * @param {number} fallback Valor utilizado cuando la conversión falla.
 * @returns {number}
 */
function envInt(key, fallback) {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Configuración normalizada consumida por infraestructura y casos de uso.
 *
 * Las credenciales pueden quedar vacías en esta fase: la conexión concreta
 * será quien reporte el error. Para despliegues críticos conviene añadir una
 * validación explícita de campos obligatorios al inicio del proceso.
 */
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
  /** Recibe reportes de prueba y confirmaciones del envío productivo. */
  reportNotifyTo: envStr('REPORT_NOTIFY_TO')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),
  cronSchedule: envStr('CRON_SCHEDULE', '59 5 * * *'),
  timezone: envStr('TIMEZONE', 'America/Bogota'),
  diasEnCava: envInt('DIAS_EN_CAVA', 3),
  diasVencimientoCortes: envInt('DIAS_VENCIMIENTO_CORTES', 3),
  /** Ventana hacia atrás configurada; la consulta actual conserva un valor fijo en SQL. */
  cortesLookbackDias: envInt('CORTES_LOOKBACK_DIAS', 7),
  /** adesposte | pbi05 | both */
  cortesFuente: envStr('CORTES_FUENTE', 'both').toLowerCase(),
  reportsDir: join(__dirname, '..', 'reports'),
};

/**
 * Catálogo legado de tipos consultados en cava.
 *
 * @deprecated El flujo actual deriva el catálogo desde `VIDA_UTIL_HABILES`.
 */
export const TIPOS_CAVA = [
  'Lengua',
  'Media Canal 1',
  'Media Canal 2 Cola',
  'Patas y Manos',
  'Visceras Blancas',
  'Visceras Rojas',
  'Cabeza',
];
