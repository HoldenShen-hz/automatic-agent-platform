import { join } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
const COMPLIANCE_PROGRAM_ACTIONS = ["summary", "export"];
const HA_PROGRAM_ACTIONS = ["summary", "export"];
const PMF_ACTIONS = ["report", "run", "export", "history", "latest"];
const PERCEPTION_ACTIONS = ["upsert_source", "ingest", "brief", "propose", "export", "sources", "briefs"];
const EVOLUTION_ACTIONS = [
    "propose_budget",
    "propose_experience",
    "sync",
    "apply",
    "rollback",
    "list",
    "resolve_budget",
    "evaluate_budget",
];
const ENVIRONMENT_NAMES = ["dev", "test", "staging", "pre-prod", "prod"];
const EVOLUTION_SCOPE_TYPES = ["account", "division", "tenant", "workspace", "organization", "role"];
function invalidEnv(name) {
    throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}
function missingEnv(name) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}
function requiredEnv(env, name) {
    return readTrimmedEnv(env, name) ?? missingEnv(name);
}
function optionalEnv(env, name) {
    if (Object.prototype.hasOwnProperty.call(env, name) && env[name] === "") {
        return null;
    }
    return readTrimmedEnv(env, name);
}
function requiredEnumValue(env, name, allowed) {
    const value = requiredEnv(env, name);
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
function optionalEnumValue(env, name, allowed) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return null;
    }
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
function optionalIntegerEnv(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return null;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
function optionalFloatEnv(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return null;
    }
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
function optionalBooleanEnv(env, name, defaultValue = false) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return defaultValue;
    }
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    return invalidEnv(name);
}
function optionalJsonEnv(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return undefined;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return invalidEnv(name);
    }
}
function optionalCsvEnv(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return [];
    }
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
}
function resolveDefaultDbPath(cwd) {
    return join(cwd, "data", "sqlite", "authoritative-demo.db");
}
function resolveDefaultArtifactRoot(cwd) {
    return join(cwd, "data", "artifacts");
}
function resolveDbPath(env, cwd) {
    return optionalEnv(env, "AA_DB_PATH") ?? resolveDefaultDbPath(cwd);
}
function parseBudgetPolicyFromEnv(env, prefix) {
    return {
        maxTaskCostUsd: optionalFloatEnv(env, `${prefix}_MAX_TASK_COST_USD`) ?? 5,
        maxDailyCostUsd: optionalFloatEnv(env, `${prefix}_MAX_DAILY_COST_USD`) ?? 50,
        maxMonthlyCostUsd: optionalFloatEnv(env, `${prefix}_MAX_MONTHLY_COST_USD`) ?? 500,
        warnAtRatio: optionalFloatEnv(env, `${prefix}_WARN_AT_RATIO`) ?? 0.8,
        mode: optionalEnv(env, `${prefix}_MODE`) ?? "supervised",
    };
}
export function loadComplianceProgramCliEnv(env = process.env, cwd = process.cwd()) {
    return {
        dbPath: resolveDbPath(env, cwd),
        action: optionalEnumValue(env, "AA_COMPLIANCE_PROGRAM_ACTION", COMPLIANCE_PROGRAM_ACTIONS) ?? "summary",
        artifactRoot: optionalEnv(env, "AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT"),
    };
}
export function loadHaProgramCliEnv(env = process.env, cwd = process.cwd()) {
    const environment = requiredEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES);
    return {
        dbPath: resolveDbPath(env, cwd),
        environment,
        action: optionalEnumValue(env, "AA_HA_PROGRAM_ACTION", HA_PROGRAM_ACTIONS) ?? "summary",
        artifactRoot: optionalEnv(env, "AA_HA_PROGRAM_ARTIFACT_ROOT"),
    };
}
export function loadPmfCliEnv(env = process.env, cwd = process.cwd()) {
    return {
        dbPath: resolveDbPath(env, cwd),
        artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT") ?? resolveDefaultArtifactRoot(cwd),
        action: requiredEnumValue(env, "AA_PMF_ACTION", PMF_ACTIONS),
        profileName: optionalEnv(env, "AA_PMF_PROFILE_NAME"),
        divisionId: optionalEnv(env, "AA_PMF_DIVISION_ID"),
        windowDays: optionalIntegerEnv(env, "AA_PMF_WINDOW_DAYS"),
        evaluatedAt: optionalEnv(env, "AA_PMF_EVALUATED_AT"),
        limit: optionalIntegerEnv(env, "AA_PMF_LIMIT"),
    };
}
export function loadPerceptionCliEnv(env = process.env, cwd = process.cwd()) {
    return {
        dbPath: resolveDbPath(env, cwd),
        artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT") ?? resolveDefaultArtifactRoot(cwd),
        action: requiredEnumValue(env, "AA_PERCEPTION_ACTION", PERCEPTION_ACTIONS),
        accountId: optionalEnv(env, "AA_PERCEPTION_ACCOUNT_ID"),
        tenantId: optionalEnv(env, "AA_TENANT_ID"),
        sourceId: optionalEnv(env, "AA_SOURCE_ID"),
        sourceType: optionalEnv(env, "AA_SOURCE_TYPE"),
        sourceName: optionalEnv(env, "AA_SOURCE_NAME"),
        sourceEnabled: optionalBooleanEnv(env, "AA_SOURCE_ENABLED", true),
        sourceSchedule: optionalJsonEnv(env, "AA_SOURCE_SCHEDULE_JSON"),
        sourceFilters: optionalJsonEnv(env, "AA_SOURCE_FILTERS_JSON"),
        sourcePriority: optionalIntegerEnv(env, "AA_SOURCE_PRIORITY"),
        intelItems: optionalJsonEnv(env, "AA_INTEL_ITEMS_JSON"),
        sourceIds: optionalJsonEnv(env, "AA_SOURCE_IDS_JSON"),
        briefGeneratedAt: optionalEnv(env, "AA_BRIEF_GENERATED_AT"),
        briefLimit: optionalIntegerEnv(env, "AA_BRIEF_LIMIT"),
        briefSince: optionalEnv(env, "AA_BRIEF_SINCE"),
        briefUntil: optionalEnv(env, "AA_BRIEF_UNTIL"),
        briefId: optionalEnv(env, "AA_BRIEF_ID"),
        sourcesEnabledOnly: optionalBooleanEnv(env, "AA_SOURCES_ENABLED_ONLY", false),
        briefsLimit: optionalIntegerEnv(env, "AA_BRIEFS_LIMIT"),
    };
}
export function loadEvolutionCliEnv(env = process.env, cwd = process.cwd()) {
    return {
        dbPath: resolveDbPath(env, cwd),
        action: requiredEnumValue(env, "AA_EVOLUTION_ACTION", EVOLUTION_ACTIONS),
        taskId: optionalEnv(env, "AA_TASK_ID"),
        executionId: optionalEnv(env, "AA_EXECUTION_ID"),
        sourceAgentId: optionalEnv(env, "AA_SOURCE_AGENT_ID"),
        scopeType: optionalEnumValue(env, "AA_SCOPE_TYPE", EVOLUTION_SCOPE_TYPES),
        scopeRef: optionalEnv(env, "AA_SCOPE_REF"),
        currentPolicy: parseBudgetPolicyFromEnv(env, "AA_CURRENT_POLICY"),
        observedAverageCostUsd: optionalFloatEnv(env, "AA_OBSERVED_AVERAGE_COST_USD"),
        sampleSize: optionalIntegerEnv(env, "AA_SAMPLE_SIZE"),
        successRate: optionalFloatEnv(env, "AA_SUCCESS_RATE"),
        proposalReason: optionalEnv(env, "AA_PROPOSAL_REASON"),
        targetScope: optionalEnv(env, "AA_TARGET_SCOPE"),
        taskContext: optionalEnv(env, "AA_TASK_CONTEXT"),
        taskIntent: optionalEnv(env, "AA_TASK_INTENT"),
        queryTools: optionalCsvEnv(env, "AA_QUERY_TOOLS"),
        minQualityScore: optionalFloatEnv(env, "AA_MIN_QUALITY_SCORE"),
        proposalId: optionalEnv(env, "AA_PROPOSAL_ID"),
        appliedBy: optionalEnv(env, "AA_APPLIED_BY"),
        rolledBackBy: optionalEnv(env, "AA_ROLLED_BACK_BY"),
        reasonCode: optionalEnv(env, "AA_REASON_CODE"),
        status: optionalEnv(env, "AA_STATUS"),
        basePolicy: parseBudgetPolicyFromEnv(env, "AA_BASE_POLICY"),
        currentTaskCostUsd: optionalFloatEnv(env, "AA_CURRENT_TASK_COST_USD"),
        nextEstimatedCostUsd: optionalFloatEnv(env, "AA_NEXT_ESTIMATED_COST_USD"),
    };
}
//# sourceMappingURL=product-cli-env.js.map