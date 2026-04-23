import { dirname, join } from "node:path";
/**
 * Reads an environment variable and trims whitespace.
 * Returns null if the variable is not set or empty after trimming.
 */
export function readTrimmedEnv(env, name) {
    const value = env[name];
    if (value == null) {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
/**
 * Resolves the environment name from options or AA_CONFIG_ENV variable.
 * Defaults to "prod" (fail-closed) if not specified — never fall back to
 * a permissive environment when AA_CONFIG_ENV is missing.
 */
export function resolveConfigEnvironment(options = {}) {
    const explicitEnvironment = options.environment?.trim();
    if (explicitEnvironment != null && explicitEnvironment.length > 0) {
        return explicitEnvironment;
    }
    // CFG-01: Default to "prod" (fail-closed). An unset AA_CONFIG_ENV must
    // never fall back to dev, which enables auto-approval and bypasses the
    // approval gate. Callers wanting dev/test behavior must set the env var.
    return readTrimmedEnv(options.env ?? process.env, "AA_CONFIG_ENV") ?? "prod";
}
/**
 * Resolves the configuration root directory from options or AA_CONFIG_ROOT variable.
 * Defaults to {cwd}/config if not specified.
 */
export function resolveConfigRoot(options = {}) {
    const explicitConfigRoot = options.configRoot?.trim();
    if (explicitConfigRoot != null && explicitConfigRoot.length > 0) {
        return explicitConfigRoot;
    }
    const env = options.env ?? process.env;
    return readTrimmedEnv(env, "AA_CONFIG_ROOT") ?? join(options.cwd ?? process.cwd(), "config");
}
/**
 * Resolves the workspace root directory (parent of config root).
 */
export function resolveConfigWorkspaceRoot(options = {}) {
    return dirname(resolveConfigRoot(options));
}
/**
 * Resolves the expected protected governance version from environment.
 * Used for tamper detection validation.
 */
export function resolveExpectedProtectedGovernanceVersion(env = process.env) {
    return readTrimmedEnv(env, "AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION");
}
/**
 * Parses a positive integer from a string value.
 * Returns null if null, not a valid integer, or <= 0.
 */
function parsePositiveIntegerEnvValue(value) {
    if (value == null) {
        return null;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
/**
 * Loads execution resource ceiling configuration from environment variables.
 * Used to limit agent tool calls, memory usage, and elapsed time.
 */
export function loadExecutionResourceCeilingEnv(env = process.env) {
    return {
        maxToolCalls: parsePositiveIntegerEnvValue(readTrimmedEnv(env, "AA_MAX_AGENT_TOOL_CALLS")),
        maxMemoryMb: parsePositiveIntegerEnvValue(readTrimmedEnv(env, "AA_MAX_AGENT_MEMORY_MB")),
        maxElapsedMs: parsePositiveIntegerEnvValue(readTrimmedEnv(env, "AA_MAX_AGENT_ELAPSED_MS")),
    };
}
//# sourceMappingURL=runtime-env.js.map