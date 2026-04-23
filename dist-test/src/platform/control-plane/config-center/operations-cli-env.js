import { join } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
// Valid environment names for deployment and governance operations
const ENVIRONMENT_NAMES = ["dev", "test", "staging", "pre-prod", "prod", "development", "production"];
// Valid rollout strategies for deployments
const DEPLOYMENT_ROLLOUT_STRATEGIES = ["rolling", "canary", "blue_green"];
// Valid actions for enterprise governance CLI
const ENTERPRISE_GOVERNANCE_ACTIONS = ["summary", "export"];
// Valid actions for ops program CLI
const OPS_PROGRAM_ACTIONS = ["summary", "export"];
// Valid actions for environment deployment CLI
const ENVIRONMENT_DEPLOYMENT_ACTIONS = ["summary", "export", "list-bundles", "build"];
// Valid actions for acceptance readiness CLI
const ACCEPTANCE_READINESS_ACTIONS = ["summary", "export"];
// Valid actions for platform operator CLI
const PLATFORM_OPERATOR_ACTIONS = ["summary", "export"];
// Valid target statuses for stable release gate promotion
const PLATFORM_TARGET_STATUSES = ["canary", "tenant_gray", "production_ready"];
// Valid actions for data plane CLI
const DATA_PLANE_ACTIONS = [
    "create_analytics_fact",
    "create_archive_bundle",
    "create_replay_dataset",
    "start_movement_job",
    "complete_movement_job",
    "summary",
    "export",
];
// Valid data movement operation types
const DATA_MOVEMENT_TYPES = [
    "analytics_etl",
    "archive_compaction",
    "replay_dataset_build",
    "artifact_lifecycle_move",
];
// Valid terminal statuses for data movement jobs
const DATA_MOVEMENT_TERMINAL_STATUSES = ["completed", "failed", "cancelled"];
/**
 * Throws a missing environment variable error.
 */
function missingEnv(name) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}
/**
 * Throws an invalid environment variable error.
 */
function invalidEnv(name) {
    throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}
/**
 * Reads a required environment variable, throwing if missing or empty.
 */
function requiredEnv(env, name) {
    return readTrimmedEnv(env, name) ?? missingEnv(name);
}
/**
 * Reads an optional environment variable, returning null if missing or empty.
 */
function optionalEnv(env, name) {
    return readTrimmedEnv(env, name) ?? null;
}
/**
 * Reads a required enum value from environment, throwing if invalid.
 */
function requiredEnumValue(env, name, allowed) {
    const value = requiredEnv(env, name);
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
/**
 * Reads an optional enum value from environment, returning null if missing or invalid.
 */
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
/**
 * Parses an optional JSON array environment variable into string array.
 * Returns empty array if missing or invalid.
 */
function optionalJsonArrayEnv(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return [];
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return invalidEnv(name);
    }
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Parses an optional JSON object environment variable.
 * Returns undefined if missing or invalid.
 */
function optionalJsonObjectEnv(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return undefined;
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
/**
 * Parses an optional positive number from environment, returning null if missing.
 * Throws if value exists but is not a valid positive number.
 */
function optionalNumberEnv(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return null;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        return invalidEnv(name);
    }
    return value;
}
/**
 * Loads enterprise governance CLI configuration from environment variables.
 * Supports summary and export actions for governance data.
 */
export function loadEnterpriseGovernanceCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        environment: requiredEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES),
        action: optionalEnumValue(env, "AA_ENTERPRISE_GOVERNANCE_ACTION", ENTERPRISE_GOVERNANCE_ACTIONS) ?? "summary",
        artifactRoot: optionalEnv(env, "AA_ENTERPRISE_GOVERNANCE_ARTIFACT_ROOT"),
        taskId: optionalEnv(env, "AA_ENTERPRISE_GOVERNANCE_TASK_ID"),
        shiftOwner: optionalEnv(env, "AA_ENTERPRISE_GOVERNANCE_SHIFT_OWNER"),
        dependencyManifestPath: optionalEnv(env, "AA_DEPENDENCY_MANIFEST_PATH"),
        dependencyLockfilePath: optionalEnv(env, "AA_DEPENDENCY_LOCKFILE_PATH"),
    };
}
/**
 * Loads ops program CLI configuration from environment variables.
 * Supports summary and export actions for ops program data.
 */
export function loadOpsProgramCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        environment: requiredEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES),
        action: optionalEnumValue(env, "AA_OPS_PROGRAM_ACTION", OPS_PROGRAM_ACTIONS) ??
            optionalEnumValue(env, "AA_HA_PROGRAM_ACTION", OPS_PROGRAM_ACTIONS) ??
            "summary",
        artifactRoot: optionalEnv(env, "AA_OPS_PROGRAM_ARTIFACT_ROOT") ?? optionalEnv(env, "AA_ARTIFACT_ROOT"),
        taskId: optionalEnv(env, "AA_OPS_PROGRAM_TASK_ID") ?? optionalEnv(env, "AA_TASK_ID"),
        shiftOwner: optionalEnv(env, "AA_OPS_PROGRAM_SHIFT_OWNER") ?? optionalEnv(env, "AA_SHIFT_OWNER"),
    };
}
/**
 * Loads environment deployment CLI configuration from environment variables.
 * Supports deployments with rolling, canary, or blue-green strategies.
 */
export function loadEnvironmentDeploymentCliEnv(env = process.env, cwd = process.cwd()) {
    const action = optionalEnumValue(env, "AA_DEPLOYMENT_ACTION", ENVIRONMENT_DEPLOYMENT_ACTIONS) ?? "list-bundles";
    return {
        dbPath: action === "list-bundles" ? null : requiredEnv(env, "AA_DB_PATH"),
        action,
        repoRootDir: optionalEnv(env, "AA_DEPLOYMENT_REPO_ROOT") ?? cwd,
        artifactRoot: optionalEnv(env, "AA_DEPLOYMENT_ARTIFACT_ROOT") ?? optionalEnv(env, "AA_ARTIFACT_ROOT"),
        targetEnvironment: optionalEnumValue(env, "AA_DEPLOYMENT_TARGET_ENVIRONMENT", ENVIRONMENT_NAMES),
        version: optionalEnv(env, "AA_DEPLOYMENT_VERSION"),
        commitSha: optionalEnv(env, "AA_DEPLOYMENT_COMMIT_SHA") ?? optionalEnv(env, "AA_COMMIT_SHA"),
        rolloutStrategy: optionalEnumValue(env, "AA_DEPLOYMENT_ROLLOUT_STRATEGY", DEPLOYMENT_ROLLOUT_STRATEGIES),
        generatedAt: optionalEnv(env, "AA_DEPLOYMENT_GENERATED_AT") ?? optionalEnv(env, "AA_GENERATED_AT"),
        taskId: optionalEnv(env, "AA_DEPLOYMENT_TASK_ID") ?? optionalEnv(env, "AA_TASK_ID"),
    };
}
export function loadAcceptanceReadinessCliEnv(env = process.env, cwd = process.cwd()) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_ACCEPTANCE_READINESS_ACTION", ACCEPTANCE_READINESS_ACTIONS) ?? "summary",
        repoRootDir: optionalEnv(env, "AA_ACCEPTANCE_READINESS_REPO_ROOT") ?? cwd,
        evidenceRootDir: optionalEnv(env, "AA_ACCEPTANCE_READINESS_EVIDENCE_ROOT") ?? join(cwd, "data", "stable-evidence"),
        artifactRoot: optionalEnv(env, "AA_ACCEPTANCE_READINESS_ARTIFACT_ROOT"),
        targetEnvironment: optionalEnumValue(env, "AA_ACCEPTANCE_READINESS_TARGET_ENVIRONMENT", ENVIRONMENT_NAMES) ?? "prod",
        version: optionalEnv(env, "AA_ACCEPTANCE_READINESS_VERSION"),
        commitSha: optionalEnv(env, "AA_ACCEPTANCE_READINESS_COMMIT_SHA"),
        rolloutStrategy: optionalEnumValue(env, "AA_ACCEPTANCE_READINESS_ROLLOUT_STRATEGY", DEPLOYMENT_ROLLOUT_STRATEGIES),
        generatedAt: optionalEnv(env, "AA_ACCEPTANCE_READINESS_GENERATED_AT"),
        taskId: optionalEnv(env, "AA_ACCEPTANCE_READINESS_TASK_ID"),
    };
}
/**
 * Loads platform operator CLI configuration from environment variables.
 * Supports stable release gate management with evidence collection.
 */
export function loadPlatformOperatorCliEnv(env = process.env, cwd = process.cwd()) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        environment: requiredEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES),
        action: optionalEnumValue(env, "AA_PLATFORM_ACTION", PLATFORM_OPERATOR_ACTIONS) ?? "summary",
        artifactRoot: optionalEnv(env, "AA_PLATFORM_ARTIFACT_ROOT"),
        targetStatus: optionalEnumValue(env, "AA_PLATFORM_TARGET_STATUS", PLATFORM_TARGET_STATUSES) ?? "canary",
        evidenceRootDir: optionalEnv(env, "AA_PLATFORM_EVIDENCE_ROOT") ?? `${cwd}/data/stable-evidence`,
        outputDir: optionalEnv(env, "AA_PLATFORM_OUTPUT_DIR") ?? `${cwd}/data/platform-operator`,
        generatedAt: optionalEnv(env, "AA_GENERATED_AT"),
    };
}
/**
 * Loads data plane CLI configuration from environment variables.
 * Supports analytics facts, archive bundles, replay datasets, and data movement jobs.
 */
export function loadDataPlaneCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_DATA_PLANE_ACTION", DATA_PLANE_ACTIONS) ?? "summary",
        artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT"),
        namespaceId: optionalEnv(env, "AA_NAMESPACE_ID"),
        factId: optionalEnv(env, "AA_FACT_ID"),
        metricName: optionalEnv(env, "AA_METRIC_NAME"),
        dimensions: optionalJsonObjectEnv(env, "AA_DIMENSIONS_JSON"),
        value: optionalNumberEnv(env, "AA_VALUE"),
        windowStart: optionalEnv(env, "AA_WINDOW_START"),
        windowEnd: optionalEnv(env, "AA_WINDOW_END"),
        sourceRef: optionalEnv(env, "AA_SOURCE_REF"),
        bundleId: optionalEnv(env, "AA_BUNDLE_ID"),
        bundleType: optionalEnv(env, "AA_BUNDLE_TYPE"),
        sourceRefs: optionalJsonArrayEnv(env, "AA_SOURCE_REFS_JSON"),
        summaryRef: optionalEnv(env, "AA_SUMMARY_REF"),
        datasetId: optionalEnv(env, "AA_DATASET_ID"),
        datasetType: optionalEnv(env, "AA_DATASET_TYPE"),
        sampleRefs: optionalJsonArrayEnv(env, "AA_SAMPLE_REFS_JSON"),
        truthRefs: optionalJsonArrayEnv(env, "AA_TRUTH_REFS_JSON"),
        version: optionalEnv(env, "AA_VERSION"),
        jobId: optionalEnv(env, "AA_JOB_ID"),
        sourceNamespaceId: optionalEnv(env, "AA_SOURCE_NAMESPACE_ID"),
        targetNamespaceId: optionalEnv(env, "AA_TARGET_NAMESPACE_ID"),
        movementType: optionalEnumValue(env, "AA_MOVEMENT_TYPE", DATA_MOVEMENT_TYPES),
        inputRefs: optionalJsonArrayEnv(env, "AA_INPUT_REFS_JSON"),
        status: optionalEnumValue(env, "AA_STATUS", DATA_MOVEMENT_TERMINAL_STATUSES),
        report: optionalJsonObjectEnv(env, "AA_REPORT_JSON"),
        tenantId: optionalEnv(env, "AA_TENANT_ID"),
    };
}
//# sourceMappingURL=operations-cli-env.js.map