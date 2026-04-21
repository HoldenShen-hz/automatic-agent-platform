import type { EnvironmentName } from "../../contracts/types/domain.js";
import type { StableGateTargetStatus } from "../../shared/stability/stable-release-gate.js";
/**
 * Configuration for enterprise governance CLI operations.
 * Supports summary and export actions with optional artifact and task filtering.
 */
export interface EnterpriseGovernanceCliEnvConfig {
    dbPath: string;
    environment: EnvironmentName;
    action: "summary" | "export";
    artifactRoot: string | null;
    taskId: string | null;
    shiftOwner: string | null;
    dependencyManifestPath: string | null;
    dependencyLockfilePath: string | null;
}
/**
 * Configuration for ops program CLI operations.
 * Supports summary and export actions with optional artifact and task filtering.
 */
export interface OpsProgramCliEnvConfig {
    dbPath: string;
    environment: EnvironmentName;
    action: "summary" | "export";
    artifactRoot: string | null;
    taskId: string | null;
    shiftOwner: string | null;
}
/**
 * Configuration for environment deployment CLI operations.
 * Supports deployments across different environments with rollout strategies.
 */
export interface EnvironmentDeploymentCliEnvConfig {
    dbPath: string | null;
    action: "summary" | "export" | "list-bundles";
    repoRootDir: string;
    artifactRoot: string | null;
    targetEnvironment: EnvironmentName | null;
    version: string | null;
    commitSha: string | null;
    rolloutStrategy: "rolling" | "canary" | "blue_green" | null;
    generatedAt: string | null;
    taskId: string | null;
}
export interface AcceptanceReadinessCliEnvConfig {
    dbPath: string;
    action: "summary" | "export";
    repoRootDir: string;
    evidenceRootDir: string;
    artifactRoot: string | null;
    targetEnvironment: EnvironmentName;
    version: string | null;
    commitSha: string | null;
    rolloutStrategy: "rolling" | "canary" | "blue_green" | null;
    generatedAt: string | null;
    taskId: string | null;
}
/**
 * Configuration for platform operator CLI operations.
 * Supports stable release gate management with evidence collection.
 */
export interface PlatformOperatorCliEnvConfig {
    dbPath: string;
    environment: EnvironmentName;
    action: "summary" | "export";
    artifactRoot: string | null;
    targetStatus: StableGateTargetStatus;
    evidenceRootDir: string;
    outputDir: string;
    generatedAt: string | null;
}
/**
 * Configuration for data plane CLI operations.
 * Supports analytics facts, archive bundles, and data movement jobs.
 */
export interface DataPlaneCliEnvConfig {
    dbPath: string;
    action: "create_analytics_fact" | "create_archive_bundle" | "create_replay_dataset" | "start_movement_job" | "complete_movement_job" | "summary" | "export";
    artifactRoot: string | null;
    namespaceId: string | null;
    factId: string | null;
    metricName: string | null;
    dimensions: Record<string, unknown> | undefined;
    value: number | null;
    windowStart: string | null;
    windowEnd: string | null;
    sourceRef: string | null;
    bundleId: string | null;
    bundleType: string | null;
    sourceRefs: string[];
    summaryRef: string | null;
    datasetId: string | null;
    datasetType: string | null;
    sampleRefs: string[];
    truthRefs: string[];
    version: string | null;
    jobId: string | null;
    sourceNamespaceId: string | null;
    targetNamespaceId: string | null;
    movementType: "analytics_etl" | "archive_compaction" | "replay_dataset_build" | "artifact_lifecycle_move" | null;
    inputRefs: string[];
    status: "completed" | "failed" | "cancelled" | null;
    report: Record<string, unknown> | undefined;
    tenantId: string | null;
}
/**
 * Loads enterprise governance CLI configuration from environment variables.
 * Supports summary and export actions for governance data.
 */
export declare function loadEnterpriseGovernanceCliEnv(env?: NodeJS.ProcessEnv): EnterpriseGovernanceCliEnvConfig;
/**
 * Loads ops program CLI configuration from environment variables.
 * Supports summary and export actions for ops program data.
 */
export declare function loadOpsProgramCliEnv(env?: NodeJS.ProcessEnv): OpsProgramCliEnvConfig;
/**
 * Loads environment deployment CLI configuration from environment variables.
 * Supports deployments with rolling, canary, or blue-green strategies.
 */
export declare function loadEnvironmentDeploymentCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): EnvironmentDeploymentCliEnvConfig;
export declare function loadAcceptanceReadinessCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): AcceptanceReadinessCliEnvConfig;
/**
 * Loads platform operator CLI configuration from environment variables.
 * Supports stable release gate management with evidence collection.
 */
export declare function loadPlatformOperatorCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): PlatformOperatorCliEnvConfig;
/**
 * Loads data plane CLI configuration from environment variables.
 * Supports analytics facts, archive bundles, replay datasets, and data movement jobs.
 */
export declare function loadDataPlaneCliEnv(env?: NodeJS.ProcessEnv): DataPlaneCliEnvConfig;
