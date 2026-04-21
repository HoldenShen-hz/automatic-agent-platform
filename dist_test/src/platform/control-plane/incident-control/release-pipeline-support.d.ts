/**
 * Release Pipeline Service
 *
 * Manages the build, publish, and deploy lifecycle for releases across environments.
 * Constructs release bundles that combine version metadata, configuration, and secrets
 * into a deployable unit. Supports rolling, canary, and blue-green deployment strategies.
 *
 * The service handles environment promotion from dev through test, staging, pre-prod,
 * and finally to production, ensuring each environment meets readiness requirements
 * before allowing promotion to the next.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/architecture_governance_and_versioning_contract.md | Architecture Governance Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
export { extractWorkflowDispatchReceipt } from "./workflow-dispatch-receipt.js";
import { SecretManagementService, type ManagedSecretMetadata } from "../iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, EnvironmentName, SecretLeaseStatus } from "../../contracts/types/domain.js";
/**
 * Environment-specific release configuration loaded from config files.
 * Defines registry, image repository, deployment targets, and workflow paths
 * for each environment in the promotion pipeline.
 */
export interface ReleaseEnvironmentConfig {
    environment: EnvironmentName;
    registry: string;
    imageRepository: string;
    deploymentNamespace: string;
    configPath: string;
    configBundleRef: string;
    registryCredentialRef: string;
    deploymentCredentialRef: string;
    deployWorkflowPath: string;
    publishWorkflowPath: string;
    clusterName: string;
    allowedRolloutStrategies: Array<"rolling" | "canary" | "blue_green">;
}
/**
 * Input parameters for building a release pipeline bundle.
 */
export interface ReleasePipelineInput {
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    registry?: string;
    imageRepository?: string;
    taskId?: string;
    generatedAt?: string;
}
/**
 * A complete release bundle containing all information needed to deploy
 * to a specific environment. Bundles are immutable once created.
 */
export interface ReleasePipelineBundle {
    bundleId: string;
    generatedAt: string;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    imageTag: string;
    imageRef: string;
    imageRepository: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    deploymentNamespace: string;
    clusterName: string;
    configPath: string;
    configBundleRef: string;
    registryCredentialRef: string;
    deploymentCredentialRef: string;
    publishWorkflowPath: string;
    deployWorkflowPath: string;
    requiredReadinessChecks: string[];
    recommendedCommands: string[];
}
/**
 * Result of exporting a release bundle to artifact storage.
 */
export interface ReleasePipelineExportResult {
    bundle: ReleasePipelineBundle;
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/**
 * Result of executing a single pipeline command (build or publish).
 */
export interface ReleasePipelineCommandResult {
    step: "build_image" | "publish_workflow";
    command: string;
    args: string[];
    executed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
}
/**
 * Secret metadata with lease information for release pipeline secrets.
 */
export interface ReleasePipelineSecretMetadata extends ManagedSecretMetadata {
    accessMode: "describe" | "lease";
    leaseId: string | null;
    leaseStatus: SecretLeaseStatus | null;
    leaseExpiresAt: string | null;
    revokedAt: string | null;
}
/**
 * Report documenting a release pipeline execution with command results.
 */
export interface ReleasePipelineExecutionReport {
    executionId: string;
    bundleId: string;
    generatedAt: string;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    imageRef: string;
    imageRepository: string;
    registrySecret: ReleasePipelineSecretMetadata;
    publishWorkflowRunId: string | null;
    publishWorkflowRunUrl: string | null;
    buildCommand: string;
    publishCommand: string;
    executionMode: "execute";
    commandResults: ReleasePipelineCommandResult[];
}
/**
 * Complete result of executing and exporting a release pipeline.
 */
export interface ReleasePipelineExecutionExportResult {
    bundle: ReleasePipelineBundle;
    report: ReleasePipelineExecutionReport;
    bundleJsonArtifact: ArtifactRef;
    bundleMarkdownArtifact: ArtifactRef;
    reportJsonArtifact: ArtifactRef;
    reportMarkdownArtifact: ArtifactRef;
}
/**
 * Request to run a release pipeline command.
 */
export interface ReleasePipelineCommandRequest {
    step: "build_image" | "publish_workflow";
    command: string;
    args: string[];
    cwd: string;
}
/**
 * Interface for running release pipeline commands.
 * Allows mocking or alternative command execution strategies.
 */
export interface ReleasePipelineCommandRunner {
    run(request: ReleasePipelineCommandRequest): ReleasePipelineCommandResult;
}
/**
 * Configuration options for the ReleasePipelineService.
 */
export interface ReleasePipelineServiceOptions {
    repoRootDir?: string;
    configRootDir?: string;
    artifactStoreOptions?: ArtifactStoreOptions;
    secretManagementService?: SecretManagementService;
    store?: AuthoritativeTaskStore;
    commandRunner?: ReleasePipelineCommandRunner;
}
export declare const DEFAULT_REPO_ROOT: string;
export declare const DEFAULT_CONFIG_ROOT: string;
export declare const ROTATION_GUARDED_ENVIRONMENTS: Set<EnvironmentName>;
/**
 * Default command runner that executes commands locally via spawnSync.
 * Captures stdout/stderr and timing information for reporting.
 */
export declare class LocalReleasePipelineCommandRunner implements ReleasePipelineCommandRunner {
    run(request: ReleasePipelineCommandRequest): ReleasePipelineCommandResult;
}
/**
 * Validates and normalizes a semantic version string.
 * Accepts versions with or without 'v' prefix.
 * Throws ValidationError if the version format is invalid.
 */
export declare function sanitizeVersion(version: string): string;
/**
 * Validates and normalizes a git commit SHA.
 * Must be 7-40 hex characters.
 */
export declare function sanitizeCommitSha(commitSha: string): string;
/**
 * Validates and normalizes a container registry URL.
 */
export declare function sanitizeRegistry(registry: string): string;
/**
 * Validates and normalizes an image repository path.
 */
export declare function sanitizeImageRepository(imageRepository: string): string;
/**
 * Validates a secret reference URI format.
 */
export declare function sanitizeSecretRef(secretRef: string, code: string): string;
/**
 * Validates a config bundle reference URI format.
 */
export declare function sanitizeConfigBundleRef(configBundleRef: string): string;
/**
 * Builds a markdown representation of a release bundle for human review.
 */
export declare function buildMarkdown(bundle: ReleasePipelineBundle): string;
/**
 * Builds a markdown representation of a release pipeline execution report.
 */
export declare function buildExecutionMarkdown(report: ReleasePipelineExecutionReport): string;
/**
 * ReleasePipelineService manages the build, publish, and deploy lifecycle.
 * It constructs release bundles with validated metadata, manages secret leases,
 * and executes GitHub Actions workflows for CI/CD integration.
 */
