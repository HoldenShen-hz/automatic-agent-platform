/**
 * Environment Deployment Service
 *
 * Provides a comprehensive matrix view of all environments and their deployment readiness.
 * Evaluates each environment's configuration, readiness components, and secret injection
 * status to determine if deployments can proceed. This is the primary service for
 * understanding the overall deployment landscape across dev, test, staging, pre-prod, and prod.
 *
 * The service builds a matrix that shows:
 * - Configuration highlights per environment
 * - Readiness component status (provider, gateway, sandbox, worker fleet, artifact store)
 * - Secret injection readiness
 * - Promotion blockers preventing deployment
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/architecture_governance_and_versioning_contract.md | Architecture Governance Contract}
 */
import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import { SecretManagementService } from "../iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, DeploymentMode, EnvironmentName, EnvironmentReadinessComponentType } from "../../contracts/types/domain.js";
import { type ReleasePipelineBundle } from "./release-pipeline-service.js";
/**
 * Input parameters for building an environment deployment report.
 */
export interface EnvironmentDeploymentBuildInput {
    targetEnvironment?: EnvironmentName | null;
    version?: string;
    commitSha?: string;
    rolloutStrategy?: "rolling" | "canary" | "blue_green";
    generatedAt?: string;
    taskId?: string;
}
/**
 * Summary of readiness status for an environment.
 */
export interface EnvironmentDeploymentReadinessSummary {
    requiredComponentTypes: EnvironmentReadinessComponentType[];
    readyCount: number;
    missingComponentTypes: EnvironmentReadinessComponentType[];
    staleComponentTypes: EnvironmentReadinessComponentType[];
    blockedGateRefs: string[];
}
/**
 * Configuration highlights for an environment.
 */
export interface EnvironmentDeploymentConfigHighlights {
    maxConcurrentTasks: number | null;
    defaultTaskTimeoutMs: number | null;
    defaultStepTimeoutMs: number | null;
    approvalMode: string | null;
    sandboxMode: string | null;
}
/**
 * Detailed deployment entry for a single environment.
 */
export interface EnvironmentDeploymentEntry {
    environment: EnvironmentName;
    order: number;
    configVersionId: string | null;
    configIssueCodes: string[];
    configHighlights: EnvironmentDeploymentConfigHighlights;
    releaseConfig: {
        clusterName: string;
        deploymentNamespace: string;
        allowedRolloutStrategies: Array<"rolling" | "canary" | "blue_green">;
    } | null;
    readiness: EnvironmentDeploymentReadinessSummary;
    deployment: {
        bindingCount: number;
        deploymentModes: DeploymentMode[];
        regions: string[];
        networkBoundaries: string[];
    };
    secretInjection: {
        configBundleRef: string | null;
        registryCredentialRef: string | null;
        deploymentCredentialRef: string | null;
        registryCredentialRegistered: boolean;
        deploymentCredentialRegistered: boolean;
        registryCredentialResolved: boolean;
        deploymentCredentialResolved: boolean;
        ready: boolean;
    };
    deployReady: boolean;
    blockers: string[];
}
/**
 * Complete environment deployment matrix report.
 */
export interface EnvironmentDeploymentReport {
    reportId: string;
    generatedAt: string;
    targetEnvironment: EnvironmentName | null;
    highestReadyEnvironment: EnvironmentName | null;
    targetEligible: boolean;
    promotionPath: EnvironmentName[];
    entries: EnvironmentDeploymentEntry[];
    targetReleaseBundle: ReleasePipelineBundle | null;
    recommendedCommands: string[];
}
/**
 * Result of exporting an environment deployment report.
 */
export interface EnvironmentDeploymentExportResult {
    report: EnvironmentDeploymentReport;
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/**
 * Configuration options for the EnvironmentDeploymentService.
 */
export interface EnvironmentDeploymentServiceOptions {
    repoRootDir?: string;
    configRootDir?: string;
    artifactStoreOptions?: ArtifactStoreOptions;
    readinessStaleThresholdMs?: number;
    secretManagementService?: SecretManagementService;
}
/**
 * EnvironmentDeploymentService builds deployment readiness matrices across all environments.
 * It evaluates configuration validity, readiness component status, secret injection readiness,
 * and identifies blockers that prevent deployment to each environment.
 */
export declare class EnvironmentDeploymentService {
    private readonly store;
    private readonly repoRootDir;
    private readonly configService;
    private readonly releasePipelineService;
    private readonly artifactStore;
    private readonly readinessStaleThresholdMs;
    private readonly secretManagementService;
    constructor(store: AuthoritativeTaskStore, options?: EnvironmentDeploymentServiceOptions);
    /**
     * Builds a comprehensive environment deployment matrix report.
     * Evaluates all environments for deployment readiness and identifies blockers.
     */
    buildReport(input?: EnvironmentDeploymentBuildInput): Promise<EnvironmentDeploymentReport>;
    /**
     * Exports the environment deployment report to artifact storage.
     */
    exportReport(input?: EnvironmentDeploymentBuildInput): Promise<EnvironmentDeploymentExportResult>;
    /**
     * Builds a deployment entry for a single environment.
     * Evaluates configuration, readiness, secrets, and identifies blockers.
     */
    private buildEntry;
    /**
     * Finds the highest environment that is deploy-ready.
     * Walks through environments in order until one is not ready.
     */
    private resolveHighestReadyEnvironment;
    /**
     * Identifies blockers from prerequisite environments that are not ready.
     * A target cannot be deployed to if any earlier environment in the promotion
     * path is not deploy-ready.
     */
    private resolvePromotionPrerequisiteBlockers;
    /**
     * Builds recommended commands for interacting with the deployment.
     */
    private buildRecommendedCommands;
    /**
     * Determines if a readiness record has gone stale based on time since last verification.
     */
    private isReadinessStale;
    /**
     * Safely extracts a finite number from an unknown value.
     */
    private readNumber;
    /**
     * Safely extracts a non-empty string from an unknown value.
     */
    private readString;
    /**
     * Compares two environments by their position in the promotion order.
     */
    private compareEnvironment;
    /**
     * Attempts to describe a secret, returning null if it doesn't exist.
     * Used to check secret registration status without throwing.
     */
    private tryDescribeSecret;
}
