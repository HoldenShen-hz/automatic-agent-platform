import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
// Valid environment names
export const ENVIRONMENT_NAMES = ["dev", "test", "staging", "pre-prod", "prod"];
// Valid tenant platform actions
export const TENANT_ACTIONS = [
    "create_workspace",
    "add_workspace_member",
    "create_organization",
    "add_organization_member",
    "create_tenant",
    "bind_deployment",
    "create_namespace",
    "topology",
];
// Valid enterprise capability actions
export const ENTERPRISE_ACTIONS = ["register_readiness", "summary", "export", "list_readiness", "list_reports"];
// Valid marketplace actions
export const MARKETPLACE_ACTIONS = [
    "register_package",
    "submit_review",
    "decide_review",
    "publish",
    "revoke",
    "summary",
    "export",
    "list_packages",
    "list_reviews",
    "list_publications",
    "list_reports",
];
// Valid deployment execution actions
export const DEPLOYMENT_EXECUTION_ACTIONS = ["summary", "export"];
// Valid control plane actions
export const CONTROL_PLANE_ACTIONS = ["summary", "heartbeat", "select"];
// Valid ops governance actions
export const OPS_GOVERNANCE_ACTIONS = ["summary", "export"];
// Valid secret management actions
export const SECRET_ACTIONS = ["register", "resolve", "rotate", "issue", "revoke", "leases", "due", "request_due", "refresh", "summary"];
// Valid worker register actions
export const WORKER_REGISTER_ACTIONS = ["issue", "complete"];
export const GATEWAY_TARGET_ACTIONS = ["upsert", "list", "resolve"];
export const INSPECT_KINDS = [
    "task",
    "execution",
    "approval",
    "tasks",
    "workflows",
    "decisions",
    "workers",
];
export const SKILL_CREATOR_ACTIONS = ["create", "validate"];
export const SHADOW_SNAPSHOT_ACTIONS = ["create", "list", "restore"];
export const MEMORY_ACTIONS = [
    "initialize",
    "remember",
    "prefetch",
    "queue_prefetch",
    "system_prompt_block",
    "sync_turn",
    "shutdown",
    "list",
    "quality",
    "consolidate",
    "revoke",
];
export const MODEL_ROUTE_CLASSES = ["default", "classification", "writing", "coding", "reasoning"];
export const MODEL_ROUTE_RISK_LEVELS = ["low", "medium", "high", "critical"];
/**
 * Throws a missing environment variable error.
 */
export function missingEnv(name) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}
/**
 * Throws an invalid environment variable error.
 */
export function invalidEnv(name) {
    throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}
/**
 * Throws an invalid gate value error for secondary gates.
 */
export function invalidGateValue(name) {
    throw new ValidationError(`invalid_gate_value:${name}`, `invalid_gate_value:${name}`);
}
/**
 * Reads a required environment variable, throwing if missing or empty.
 */
export function requiredEnv(env, name) {
    return readTrimmedEnv(env, name) ?? missingEnv(name);
}
/**
 * Reads an optional environment variable, returning null if missing or empty.
 */
export function optionalEnv(env, name) {
    return readTrimmedEnv(env, name) ?? null;
}
/**
 * Parses an optional number from environment, returning null if missing.
 * Throws if value exists but is not a valid finite number.
 */
export function optionalNumber(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Parses a required number from environment, throwing if missing or invalid.
 */
export function requiredNumber(env, name) {
    const parsed = optionalNumber(env, name);
    if (parsed == null) {
        return missingEnv(name);
    }
    return parsed;
}
/**
 * Reads an optional enum value from environment, returning null if missing.
 * Throws if value exists but is not in the allowed list.
 */
export function optionalEnumValue(env, name, allowed) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return null;
    }
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
/**
 * Reads a required enum value from environment, throwing if missing or invalid.
 */
export function requiredEnumValue(env, name, allowed) {
    const value = requiredEnv(env, name);
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
/**
 * Parses a JSON array of strings from environment variable.
 * @param required - If true, throws on missing; if false, returns null
 */
export function parseStringArrayJson(env, name, required) {
    const raw = required ? requiredEnv(env, name) : optionalEnv(env, name);
    if (raw == null) {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return invalidEnv(name);
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Parses a JSON object from environment variable, returning null if missing.
 */
export function parseObjectJson(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return invalidEnv(name);
    }
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
export function parseJsonValue(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return invalidEnv(name);
    }
}
/**
 * Parses a JSON object with boolean values from environment variable.
 * Returns undefined if missing. Uses invalidGateValue for AA_SECONDARY_GATES_JSON.
 */
export function parseBooleanMapJson(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return undefined;
    }
    const parsed = parseObjectJson(env, name);
    if (parsed == null) {
        return undefined;
    }
    for (const entry of Object.values(parsed)) {
        if (typeof entry !== "boolean") {
            return name === "AA_SECONDARY_GATES_JSON" ? invalidGateValue(name) : invalidEnv(name);
        }
    }
    return parsed;
}
export function parseBoolean(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return undefined;
    }
    if (value === "true" || value === "1") {
        return true;
    }
    if (value === "false" || value === "0") {
        return false;
    }
    return invalidEnv(name);
}
export function parseInteger(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
export function parseStringArrayFromCsv(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return null;
    }
    const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    return items.length > 0 ? items : [];
}
/**
 * Parses marketplace compatibility JSON with apiContract, permissionSurface, and runtimeCapability fields.
 */
export function parseCompatibilityJson(env, name) {
    const parsed = parseObjectJson(env, name);
    if (parsed == null) {
        return null;
    }
    if (typeof parsed.apiContract !== "string"
        || typeof parsed.permissionSurface !== "string"
        || typeof parsed.runtimeCapability !== "string") {
        return invalidEnv(name);
    }
    return {
        apiContract: parsed.apiContract,
        permissionSurface: parsed.permissionSurface,
        runtimeCapability: parsed.runtimeCapability,
    };
}
export function parseTypedJson(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return undefined;
    }
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        throw new ValidationError(`invalid_json:${name}:${error instanceof Error ? error.message : String(error)}`, `invalid_json:${name}:${error instanceof Error ? error.message : String(error)}`);
    }
}
export function parseProviderHealthJson(env, name) {
    const parsed = parseTypedJson(env, name);
    if (parsed == null) {
        return {};
    }
    const summaries = {};
    for (const [provider, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
            if (value !== "healthy" && value !== "degraded" && value !== "failed") {
                return invalidEnv(name);
            }
            summaries[provider] = {
                status: value,
                successRate: value === "healthy" ? 1 : value === "degraded" ? 0.75 : 0.25,
                totalCalls: 0,
                failedCalls: 0,
                fallbackCount: 0,
                latestFailureCodes: [],
            };
            continue;
        }
        if (value == null || typeof value !== "object" || Array.isArray(value)) {
            return invalidEnv(name);
        }
        const candidate = value;
        if (candidate.status !== "healthy" && candidate.status !== "degraded" && candidate.status !== "failed") {
            return invalidEnv(name);
        }
        summaries[provider] = {
            status: candidate.status,
            successRate: typeof candidate.successRate === "number" ? candidate.successRate : 1,
            totalCalls: typeof candidate.totalCalls === "number" ? candidate.totalCalls : 0,
            failedCalls: typeof candidate.failedCalls === "number" ? candidate.failedCalls : 0,
            fallbackCount: typeof candidate.fallbackCount === "number" ? candidate.fallbackCount : 0,
            latestFailureCodes: Array.isArray(candidate.latestFailureCodes)
                ? candidate.latestFailureCodes.filter((item) => typeof item === "string")
                : [],
        };
    }
    return summaries;
}
export function buildStructuredMemoryContent(env) {
    const workContext = optionalEnv(env, "AA_MEMORY_WORK_CONTEXT") ?? undefined;
    const topOfMind = parseStringArrayFromCsv(env, "AA_MEMORY_TOP_OF_MIND") ?? undefined;
    const recentHistory = parseStringArrayFromCsv(env, "AA_MEMORY_RECENT_HISTORY") ?? undefined;
    const longTermBackground = parseStringArrayFromCsv(env, "AA_MEMORY_LONG_TERM_BACKGROUND") ?? undefined;
    const facts = parseTypedJson(env, "AA_MEMORY_FACTS_JSON");
    if (workContext == null
        && topOfMind == null
        && recentHistory == null
        && longTermBackground == null
        && facts == null) {
        return undefined;
    }
    return {
        schemaVersion: "memory.v2",
        workContext: workContext ?? null,
        topOfMind: topOfMind ?? [],
        recentHistory: recentHistory ?? [],
        longTermBackground: longTermBackground ?? [],
        facts: facts ?? [],
    };
}
/**
 * Loads tenant platform CLI configuration from environment variables.
 * Supports workspace, organization, and tenant management operations.
 */
//# sourceMappingURL=remaining-cli-env-support.js.map