import { dirname } from "node:path";

import { ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath, type SandboxPolicy } from "../../shared/sandbox-path-policy.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const storageConfigLogger = new StructuredLogger({ retentionLimit: 50 });

/**
 * Supported storage drivers.
 */
export type StorageDriver = "sqlite" | "postgres";

/**
 * Options for validating storage backend configuration.
 */
export interface StorageBackendConfigValidationOptions {
  environment: string;
  env?: NodeJS.ProcessEnv;
  sandboxPolicy?: SandboxPolicy;
}

/**
 * PostgreSQL-specific runtime profile information.
 */
export interface PostgresStorageBackendRuntimeProfile {
  dsnConfigured: boolean;
  dsnSource: string | null;
  dsnValue?: string | null;
  host: string | null;
  database: string | null;
  sslmode: string | null;
  poolMin: number | null;
  poolMax: number | null;
  dualRun: boolean;
  shadowSqlitePath: string | null;
  schema: string | null;
}

/**
 * Runtime profile for a storage backend including driver and configuration.
 */
export interface StorageBackendRuntimeProfile {
  environment: string;
  driver: StorageDriver;
  /** List of configuration issues (empty if valid) */
  issues: string[];
  /** PostgreSQL-specific profile if driver is postgres */
  postgres: PostgresStorageBackendRuntimeProfile | null;
}

/**
 * Environments that are considered production-like and have stricter requirements.
 */
const PRODUCTION_LIKE_ENVIRONMENTS = new Set(["staging", "pre-prod", "prod"]);

/**
 * Hostnames that are considered localhost and not production-ready.
 */
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Reads an environment variable and returns its source variable name.
 */
function readEnvWithSource(env: NodeJS.ProcessEnv, names: string[]): { value: string; source: string } | null {
  for (const name of names) {
    const value = env[name];
    if (value != null && value.trim().length > 0) {
      return {
        value: value.trim(),
        source: name,
      };
    }
  }
  return null;
}

/**
 * Reads an environment variable value.
 */
function readEnv(env: NodeJS.ProcessEnv, names: string[]): string | null {
  return readEnvWithSource(env, names)?.value ?? null;
}

/**
 * Parses a string as a non-negative integer.
 * @param value - The string value to parse
 * @param code - Error code to use if parsing fails
 * @returns The parsed number
 */
function parseNonNegativeInteger(value: string, code: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(code, code, {
      retryable: false,
      details: { value },
    });
  }
  return Number.parseInt(value, 10);
}

/**
 * Parses an optional non-negative integer.
 * @param value - The string value to parse (may be undefined/empty)
 * @param code - Error code to use if parsing fails
 * @returns The parsed value and any issue found
 */
function parseOptionalNonNegativeInteger(value: string | undefined, code: string): { value: number | null; issue: string | null } {
  if (value == null || value.trim().length === 0) {
    return {
      value: null,
      issue: null,
    };
  }
  try {
    return {
      value: parseNonNegativeInteger(value.trim(), code),
      issue: null,
    };
  } catch (error) {
    return {
      value: null,
      issue: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Resolves the storage driver from environment variables.
 * Defaults to SQLite if not explicitly configured.
 * @param env - Process environment variables
 * @returns The configured storage driver
 */
export function resolveStorageDriver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  const raw = env.AA_STORAGE_DRIVER?.trim();
  if (raw == null || raw.length === 0) {
    return "sqlite";
  }
  if (raw === "sqlite" || raw === "postgres") {
    return raw;
  }
  throw new ValidationError(`storage.driver_invalid:${raw}`, `storage.driver_invalid:${raw}`, {
    retryable: false,
    details: { raw },
  });
}

/**
 * Builds a list of configuration issues for a storage backend.
 * @param options - Validation options
 * @returns Array of issue descriptions
 */
export function buildStorageBackendConfigIssues(
  options: StorageBackendConfigValidationOptions,
): string[] {
  return inspectStorageBackendConfig(options).issues;
}

/**
 * Inspects storage backend configuration and returns a runtime profile.
 *
 * This function validates the configuration and returns detailed information
 * about the storage backend including driver, PostgreSQL settings, and any issues.
 *
 * @param options - Validation options including environment and environment variables
 * @returns A runtime profile with configuration details and issues
 */
export function inspectStorageBackendConfig(
  options: StorageBackendConfigValidationOptions,
): StorageBackendRuntimeProfile {
  const env = options.env ?? process.env;
  let driver: StorageDriver;
  try {
    driver = resolveStorageDriver(env);
  } catch (error) {
    return {
      environment: options.environment,
      driver: "sqlite",
      issues: [error instanceof Error ? error.message : String(error)],
      postgres: null,
    };
  }

  // SQLite is always valid
  if (driver === "sqlite") {
    return {
      environment: options.environment,
      driver,
      issues: [],
      postgres: null,
    };
  }

  // PostgreSQL validation
  const issues: string[] = [];
  const dsnRecord = readEnvWithSource(env, ["AA_STORAGE_POSTGRES_DSN", "AA_PG_DSN", "DATABASE_URL"]);
  const dualRun = env.AA_STORAGE_POSTGRES_DUAL_RUN?.trim() === "true";
  const shadowSqlitePath = readEnv(env, [
    "AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH",
    "AA_STORAGE_DUAL_RUN_SQLITE_PATH",
  ]);
  const schema = env.AA_STORAGE_POSTGRES_SCHEMA?.trim() || null;

  // Parse pool configuration
  const poolMinResult = parseOptionalNonNegativeInteger(
    env.AA_STORAGE_POSTGRES_POOL_MIN,
    "storage.postgres.pool_min_invalid",
  );
  const poolMaxResult = parseOptionalNonNegativeInteger(
    env.AA_STORAGE_POSTGRES_POOL_MAX,
    "storage.postgres.pool_max_invalid",
  );
  if (poolMinResult.issue != null) {
    issues.push(poolMinResult.issue);
  }
  if (poolMaxResult.issue != null) {
    issues.push(poolMaxResult.issue);
  }
  const poolMin = poolMinResult.value ?? 0;
  const poolMax = poolMaxResult.value ?? 20;
  if (poolMin > poolMax) {
    issues.push("storage.postgres.pool_min_exceeds_max");
  }

  // Parse DSN
  let parsed: URL | null = null;
  if (dsnRecord == null) {
    issues.push("storage.postgres.dsn_missing");
  } else {
    try {
      parsed = new URL(dsnRecord.value);
    } catch (err) {
      storageConfigLogger.log({ level: "warn", message: "Failed to parse PostgreSQL DSN", data: { dsnValue: dsnRecord.value, error: err instanceof Error ? err.message : String(err) } });
      issues.push("storage.postgres.dsn_invalid");
    }
  }

  // Extract PostgreSQL connection details
  const host = parsed?.hostname.toLowerCase() ?? null;
  const database = parsed == null || parsed.pathname === "" || parsed.pathname === "/"
    ? null
    : parsed.pathname.replace(/^\/+/, "");
  const sslmode = parsed?.searchParams.get("sslmode")?.trim().toLowerCase() ?? null;

  // Validate PostgreSQL configuration
  if (parsed != null) {
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      issues.push(`storage.postgres.protocol_invalid:${parsed.protocol}`);
    }
    if (database == null || database.length === 0) {
      issues.push("storage.postgres.database_missing");
    }
    // Production environments have stricter requirements
    if (PRODUCTION_LIKE_ENVIRONMENTS.has(options.environment)) {
      if (host != null && LOCALHOST_HOSTNAMES.has(host)) {
        issues.push(`storage.postgres.host_not_production_ready:${host}`);
      }
      if (sslmode == null || sslmode === "disable" || sslmode === "allow" || sslmode === "prefer") {
        issues.push("storage.postgres.sslmode_required");
      }
    }
  }

  // Production requires dual-run mode for PostgreSQL
  if (PRODUCTION_LIKE_ENVIRONMENTS.has(options.environment) && !dualRun) {
    issues.push("storage.postgres.dual_run_required");
  }

  // Validate shadow SQLite path if dual-run is enabled
  if (dualRun) {
    if (shadowSqlitePath == null) {
      issues.push("storage.postgres.shadow_sqlite_path_missing");
    } else if (options.sandboxPolicy != null) {
      let check = checkSandboxPath(options.sandboxPolicy, shadowSqlitePath);
      if (!check.allowed && check.reasonCode?.startsWith("sandbox.path_unresolvable:")) {
        check = checkSandboxPath(options.sandboxPolicy, dirname(shadowSqlitePath));
      }
      if (!check.allowed) {
        issues.push(`storage.postgres.shadow_sqlite_path_invalid:${check.reasonCode ?? "sandbox_denied"}`);
      }
    }
  }

  // Validate schema name format
  if (schema != null && !/^[a-z_][a-z0-9_]*$/i.test(schema)) {
    issues.push(`storage.postgres.schema_invalid:${schema}`);
  }

  return {
    environment: options.environment,
    driver,
    issues,
    postgres: {
      dsnConfigured: dsnRecord != null,
      dsnSource: dsnRecord?.source ?? null,
      dsnValue: dsnRecord?.value ?? null,
      host,
      database,
      sslmode,
      poolMin: poolMinResult.value,
      poolMax: poolMaxResult.value,
      dualRun,
      shadowSqlitePath,
      schema,
    },
  };
}
