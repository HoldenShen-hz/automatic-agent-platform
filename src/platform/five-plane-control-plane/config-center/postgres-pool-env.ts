import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./gateway-env.js";

/**
 * PostgreSQL connection pool configuration including DSN and pool settings.
 */
export interface PostgresPoolEnvConfig {
  dsn: string | null;
  poolMin: number;
  poolMax: number;
  idleTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  ssl:
    | false
    | {
        rejectUnauthorized: true;
      };
}

/**
 * Options for loading PostgreSQL pool configuration with customizable env var keys.
 */
export interface LoadPostgresPoolEnvOptions {
  dsnKeys?: string[];
  poolMinKeys?: string[];
  poolMaxKeys?: string[];
  idleTimeoutKeys?: string[];
  connectTimeoutKeys?: string[];
  sslModeKeys?: string[];
  defaultPoolMin?: number;
  defaultPoolMax?: number;
  defaultIdleTimeoutSeconds?: number;
  defaultConnectTimeoutSeconds?: number;
}

/**
 * Loads PostgreSQL pool configuration from environment variables.
 * Supports multiple DSN keys for compatibility with different deployment configurations.
 * Validates that poolMin does not exceed poolMax.
 */
export function loadPostgresPoolEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadPostgresPoolEnvOptions = {},
): PostgresPoolEnvConfig {
  const dsn = readFirstTrimmedEnv(
    env,
    options.dsnKeys ?? ["AA_LOCK_POSTGRES_DSN", "AA_STORAGE_POSTGRES_DSN", "POSTGRES_DSN", "AA_PG_DSN", "DATABASE_URL"],
  );
  const poolMin = parseNonNegativeIntegerEnv(
    env,
    options.poolMinKeys ?? ["AA_LOCK_POSTGRES_POOL_MIN", "AA_STORAGE_POSTGRES_POOL_MIN"],
    options.defaultPoolMin ?? 0,
    "lock.postgres.pool_min_invalid",
  );
  const poolMax = parseNonNegativeIntegerEnv(
    env,
    options.poolMaxKeys ?? ["AA_LOCK_POSTGRES_POOL_MAX", "AA_STORAGE_POSTGRES_POOL_MAX"],
    options.defaultPoolMax ?? 20,
    "lock.postgres.pool_max_invalid",
  );
  if (poolMin > poolMax) {
    throw new ValidationError("lock.postgres.pool_min_exceeds_max", "lock.postgres.pool_min_exceeds_max");
  }

  const idleTimeoutSeconds = parsePositiveIntegerEnv(
    env,
    options.idleTimeoutKeys ?? ["AA_LOCK_POSTGRES_IDLE_TIMEOUT_SECONDS"],
    options.defaultIdleTimeoutSeconds ?? 20,
    "lock.postgres.idle_timeout_invalid",
  );
  const connectTimeoutSeconds = parsePositiveIntegerEnv(
    env,
    options.connectTimeoutKeys ?? ["AA_LOCK_POSTGRES_CONNECT_TIMEOUT_SECONDS"],
    options.defaultConnectTimeoutSeconds ?? 10,
    "lock.postgres.connect_timeout_invalid",
  );
  const sslMode = readFirstTrimmedEnv(
    env,
    options.sslModeKeys ?? ["AA_LOCK_POSTGRES_SSLMODE", "PGSSLMODE"],
  )?.toLowerCase() ?? parseSslModeFromDsn(dsn);

  return {
    dsn,
    poolMin,
    poolMax,
    idleTimeoutSeconds,
    connectTimeoutSeconds,
    ssl: sslMode === "require" ? { rejectUnauthorized: true } : false,
  };
}

function parseSslModeFromDsn(dsn: string | null): string | null {
  if (dsn == null) {
    return null;
  }
  try {
    return new URL(dsn).searchParams.get("sslmode")?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads the first available environment variable from a list of candidates.
 * Returns null if none are set or empty.
 */
function readFirstTrimmedEnv(env: NodeJS.ProcessEnv, keys: string[]): string | null {
  for (const key of keys) {
    const value = readTrimmedEnv(env, key);
    if (value != null) {
      return value;
    }
  }
  return null;
}

/**
 * Parses a non-negative integer from environment variable.
 * Returns default value if missing, throws if invalid.
 */
function parseNonNegativeIntegerEnv(
  env: NodeJS.ProcessEnv,
  keys: string[],
  defaultValue: number,
  errorCode: string,
): number {
  const raw = readFirstTrimmedEnv(env, keys);
  if (raw == null) {
    return defaultValue;
  }
  if (!/^\d+$/.test(raw)) {
    throw new ValidationError(errorCode, errorCode);
  }
  return Number.parseInt(raw, 10);
}

/**
 * Parses a positive integer from environment variable.
 * Returns default value if missing, throws if zero or negative.
 */
function parsePositiveIntegerEnv(
  env: NodeJS.ProcessEnv,
  keys: string[],
  defaultValue: number,
  errorCode: string,
): number {
  const value = parseNonNegativeIntegerEnv(env, keys, defaultValue, errorCode);
  if (value <= 0) {
    throw new ValidationError(errorCode, errorCode);
  }
  return value;
}
