/**
 * Infraestructura de acceso a PostgreSQL.
 *
 * Se comparte un único pool durante toda la vida del proceso para reutilizar
 * conexiones tanto en ejecuciones manuales como en las disparadas por cron.
 */
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

/**
 * Pool global con concurrencia limitada para no sobrecargar SIRT.
 *
 * Cuando SSL está habilitado se mantiene la política histórica de aceptar
 * certificados no verificados. En producción se recomienda usar una CA válida
 * y activar la verificación del certificado.
 */
export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined,
  max: 4,
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
});

/**
 * Ejecuta una sentencia SQL mediante el pool compartido.
 *
 * @param {string} text Sentencia SQL, preferiblemente parametrizada.
 * @param {unknown[]} [params=[]] Valores asociados a `$1`, `$2`, etc.
 * @returns {Promise<import('pg').QueryResult>}
 * @throws {Error} Propaga errores de conexión y ejecución de PostgreSQL.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

// Protege `pool.end()` frente a cierres repetidos desde finally y señales.
let poolCerrado = false;

/**
 * Cierra de forma idempotente todas las conexiones del pool.
 *
 * Después de invocarla, el proceso no debe intentar nuevas consultas.
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (poolCerrado) return;
  poolCerrado = true;
  await pool.end();
}
