import { dirname } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath } from "../../control-plane/iam/sandbox-policy.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const storageConfigLogger = new StructuredLogger({ retentionLimit: 50 });
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
function readEnvWithSource(env, names) {
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
function readEnv(env, names) {
    return readEnvWithSource(env, names)?.value ?? null;
}
/**
 * Parses a string as a non-negative integer.
 * @param value - The string value to parse
 * @param code - Error code to use if parsing fails
 * @returns The parsed number
 */
function parseNonNegativeInteger(value, code) {
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
function parseOptionalNonNegativeInteger(value, code) {
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
    }
    catch (error) {
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
export function resolveStorageDriver(env = process.env) {
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
export function buildStorageBackendConfigIssues(options) {
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
export function inspectStorageBackendConfig(options) {
    const env = options.env ?? process.env;
    let driver;
    try {
        driver = resolveStorageDriver(env);
    }
    catch (error) {
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
    const issues = [];
    const dsnRecord = readEnvWithSource(env, ["AA_STORAGE_POSTGRES_DSN", "AA_PG_DSN", "DATABASE_URL"]);
    const dualRun = env.AA_STORAGE_POSTGRES_DUAL_RUN?.trim() === "true";
    const shadowSqlitePath = readEnv(env, [
        "AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH",
        "AA_STORAGE_DUAL_RUN_SQLITE_PATH",
    ]);
    const schema = env.AA_STORAGE_POSTGRES_SCHEMA?.trim() || null;
    // Parse pool configuration
    const poolMinResult = parseOptionalNonNegativeInteger(env.AA_STORAGE_POSTGRES_POOL_MIN, "storage.postgres.pool_min_invalid");
    const poolMaxResult = parseOptionalNonNegativeInteger(env.AA_STORAGE_POSTGRES_POOL_MAX, "storage.postgres.pool_max_invalid");
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
    let parsed = null;
    if (dsnRecord == null) {
        issues.push("storage.postgres.dsn_missing");
    }
    else {
        try {
            parsed = new URL(dsnRecord.value);
        }
        catch (err) {
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
        }
        else if (options.sandboxPolicy != null) {
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
//# sourceMappingURL=storage-backend-config.js.map