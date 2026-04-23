import { ValidationError } from "../../contracts/errors.js";
export function readRedisConnectionConfigFromEnv(prefix, env = process.env) {
    const host = readTrimmedEnvValue(env[`${prefix}_HOST`]);
    const port = parsePositiveInteger(env[`${prefix}_PORT`]);
    const sentinels = parseSentinelEndpoints(env[`${prefix}_SENTINELS`]);
    const mode = readDeploymentMode(env[`${prefix}_MODE`], sentinels.length > 0 ? "sentinel" : undefined);
    if (mode == null && host == null && port == null && sentinels.length === 0) {
        return null;
    }
    return {
        ...(mode != null ? { mode } : {}),
        ...(host != null ? { host } : {}),
        ...(port != null ? { port } : {}),
        ...(readTrimmedEnvValue(env[`${prefix}_PASSWORD`]) != null ? { password: readTrimmedEnvValue(env[`${prefix}_PASSWORD`]) } : {}),
        ...(parseNonNegativeInteger(env[`${prefix}_DB`]) != null ? { db: parseNonNegativeInteger(env[`${prefix}_DB`]) } : {}),
        ...(parseBoolean(env[`${prefix}_TLS`]) != null ? { tls: parseBoolean(env[`${prefix}_TLS`]) } : {}),
        ...(parsePositiveInteger(env[`${prefix}_CONNECT_TIMEOUT_MS`]) != null ? { connectTimeout: parsePositiveInteger(env[`${prefix}_CONNECT_TIMEOUT_MS`]) } : {}),
        ...(parseNullableNonNegativeInteger(env[`${prefix}_MAX_RETRIES_PER_REQUEST`]) !== undefined
            ? { maxRetriesPerRequest: parseNullableNonNegativeInteger(env[`${prefix}_MAX_RETRIES_PER_REQUEST`]) }
            : {}),
        ...(parseBoolean(env[`${prefix}_LAZY_CONNECT`]) != null ? { lazyConnect: parseBoolean(env[`${prefix}_LAZY_CONNECT`]) } : {}),
        ...(parseBoolean(env[`${prefix}_ENABLE_OFFLINE_QUEUE`]) != null ? { enableOfflineQueue: parseBoolean(env[`${prefix}_ENABLE_OFFLINE_QUEUE`]) } : {}),
        ...(parsePositiveInteger(env[`${prefix}_RETRY_BASE_DELAY_MS`]) != null ? { retryBaseDelayMs: parsePositiveInteger(env[`${prefix}_RETRY_BASE_DELAY_MS`]) } : {}),
        ...(parsePositiveInteger(env[`${prefix}_RETRY_MAX_DELAY_MS`]) != null ? { retryMaxDelayMs: parsePositiveInteger(env[`${prefix}_RETRY_MAX_DELAY_MS`]) } : {}),
        ...(readTrimmedEnvValue(env[`${prefix}_SENTINEL_NAME`]) != null ? { sentinelName: readTrimmedEnvValue(env[`${prefix}_SENTINEL_NAME`]) } : {}),
        ...(sentinels.length > 0 ? { sentinels } : {}),
        ...(readTrimmedEnvValue(env[`${prefix}_SENTINEL_PASSWORD`]) != null ? { sentinelPassword: readTrimmedEnvValue(env[`${prefix}_SENTINEL_PASSWORD`]) } : {}),
    };
}
export function buildRedisClientOptions(config, overrides = {}) {
    const mode = inferDeploymentMode(config);
    const baseDelayMs = config.retryBaseDelayMs ?? 100;
    const maxDelayMs = config.retryMaxDelayMs ?? 2_000;
    const common = {
        password: config.password,
        db: config.db ?? 0,
        tls: config.tls ? {} : undefined,
        lazyConnect: config.lazyConnect ?? true,
        enableOfflineQueue: config.enableOfflineQueue ?? false,
        maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
        connectTimeout: config.connectTimeout ?? 5_000,
        retryStrategy: (times) => {
            if (times > 8) {
                return null;
            }
            return Math.min(baseDelayMs * (2 ** Math.max(0, times - 1)), maxDelayMs);
        },
        ...overrides,
    };
    if (mode === "sentinel") {
        const sentinels = (config.sentinels ?? []).map((sentinel) => ({
            host: sentinel.host,
            port: sentinel.port,
        }));
        if (sentinels.length === 0) {
            throw new ValidationError("redis.sentinel_endpoints_required", "redis.sentinel_endpoints_required", { retryable: false, source: "runtime" });
        }
        if (typeof config.sentinelName !== "string" || config.sentinelName.trim().length === 0) {
            throw new ValidationError("redis.sentinel_name_required", "redis.sentinel_name_required", { retryable: false, source: "runtime" });
        }
        return {
            ...common,
            sentinels,
            name: config.sentinelName,
            sentinelPassword: config.sentinelPassword,
        };
    }
    return {
        ...common,
        host: config.host ?? "localhost",
        port: config.port ?? 6379,
    };
}
function inferDeploymentMode(config) {
    if (config.mode != null) {
        return config.mode;
    }
    if ((config.sentinels?.length ?? 0) > 0) {
        return "sentinel";
    }
    return "standalone";
}
function readTrimmedEnvValue(raw) {
    if (raw == null) {
        return null;
    }
    const value = raw.trim();
    return value.length > 0 ? value : null;
}
function parsePositiveInteger(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function parseNonNegativeInteger(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
function parseNullableNonNegativeInteger(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return undefined;
    }
    if (value.toLowerCase() === "null") {
        return null;
    }
    return parseNonNegativeInteger(value) ?? undefined;
}
function parseBoolean(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return null;
    }
    const normalized = value.toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return null;
}
function readDeploymentMode(raw, fallback) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return fallback ?? null;
    }
    return value === "standalone" || value === "sentinel" ? value : fallback ?? null;
}
function parseSentinelEndpoints(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return [];
    }
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => {
        const [host, portRaw] = entry.split(":");
        const port = parsePositiveInteger(portRaw);
        if (!host || port == null) {
            throw new ValidationError("redis.sentinel_endpoint_invalid", "redis.sentinel_endpoint_invalid", {
                retryable: false,
                source: "runtime",
                details: { entry },
            });
        }
        return { host, port };
    });
}
//# sourceMappingURL=redis-client-options.js.map