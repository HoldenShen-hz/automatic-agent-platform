/**
 * Deployment Execution Service
 *
 * Executes deployments to specific environments using release bundles.
 * Triggers GitHub Actions workflows for publishing and deploying images,
 * manages secret leases for credential access, and produces detailed
 * execution reports with command results.
 *
 * Supports plan mode (preview without execution) and execute mode (full deployment).
 * Works in conjunction with ReleasePipelineService to build bundles and
 * EnvironmentDeploymentService to validate environment readiness.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/architecture_governance_and_versioning_contract.md | Architecture Governance Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import { EnvSecretProvider } from "../iam/env-secret-provider.js";
import { SecretManagementService, type ManagedSecretMetadata } from "../iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, EnvironmentName, SecretLeaseStatus } from "../../contracts/types/domain.js";
import { type EnvironmentDeploymentBuildInput } from "./environment-deployment-service.js";
/**
 * Input parameters for building a deployment execution report.
 * Extends environment deployment build input with deployment-specific parameters.
 */
export interface DeploymentExecutionInput extends EnvironmentDeploymentBuildInput {
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    execute?: boolean;
}
/**
 * Result of executing a single deployment command (publish or deploy).
 */
export interface DeploymentCommandResult {
    step: "publish" | "deploy";
    command: string;
    args: string[];
    executed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
}
/**
 * Complete deployment execution report with all deployment details.
 */
export interface DeploymentExecutionReport {
    executionId: string;
    releaseBundleId: string;
    generatedAt: string;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    targetEligible: boolean;
    configBundleRef: string;
    configVersionId: string | null;
    registrySecret: DeploymentExecutionSecretMetadata;
    deploymentSecret: DeploymentExecutionSecretMetadata;
    publishWorkflowRunId: string | null;
    publishWorkflowRunUrl: string | null;
    deployWorkflowRunId: string | null;
    deployWorkflowRunUrl: string | null;
    publishCommand: string;
    deployCommand: string;
    executionMode: "plan" | "execute";
    commandResults: DeploymentCommandResult[];
}
/**
 * Result of exporting a deployment execution report.
 */
export interface DeploymentExecutionExportResult {
    report: DeploymentExecutionReport;
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/**
 * Secret metadata with deployment-specific fields including lease tracking.
 */
export interface DeploymentExecutionSecretMetadata extends ManagedSecretMetadata {
    accessMode: "direct_env" | "describe" | "lease";
    leaseId: string | null;
    leaseStatus: SecretLeaseStatus | null;
    leaseExpiresAt: string | null;
    revokedAt: string | null;
}
/**
 * Configuration options for the DeploymentExecutionService.
 */
export interface DeploymentExecutionServiceOptions {
    repoRootDir?: string;
    artifactStoreOptions?: ArtifactStoreOptions;
    secretProvider?: EnvSecretProvider;
    secretManagementService?: SecretManagementService;
    commandRunner?: DeploymentCommandRunner;
}
/**
 * Request to run a deployment command.
 */
export interface DeploymentCommandRequest {
    step: "publish" | "deploy";
    command: string;
    args: string[];
    cwd: string;
}
/**
 * Interface for running deployment commands.
 * Allows mocking or alternative command execution strategies.
 */
export interface DeploymentCommandRunner {
    run(request: DeploymentCommandRequest): DeploymentCommandResult;
}
/**
 * DeploymentExecutionService executes deployments to environments.
 * It orchestrates the publish and deploy workflow runs, manages secret leases,
 * and produces detailed execution reports for audit and debugging.
 */
export declare class DeploymentExecutionService {
    private readonly store;
    private readonly repoRootDir;
    private readonly artifactStore;
    private readonly environmentDeploymentService;
    private readonly configService;
    private readonly secretProvider;
    private readonly secretManagementService;
    private readonly commandRunner;
    constructor(store: AuthoritativeTaskStore, options?: DeploymentExecutionServiceOptions);
    /**
     * Builds a deployment execution report without executing commands.
     * Useful for previewing what a deployment would do.
     */
    buildReport(input: DeploymentExecutionInput): Promise<DeploymentExecutionReport>;
    /**
     * Internal method that builds the full deployment report with artifacts.
     * Validates environment readiness and bundle availability.
     */
    private buildReportArtifacts;
    /**
     * Exports the deployment execution report to artifact storage
     * and persists records to the database.
     */
    exportReport(input: DeploymentExecutionInput): Promise<DeploymentExecutionExportResult>;
    /**
     * Resolves the source environment for a promotion (the environment before this one).
     */
    private resolveSourceEnvironment;
    /**
     * Builds secret metadata using direct environment variable access.
     * Used when no secret management service is configured.
     */
    private buildDirectSecretMetadata;
    /**
     * Builds secret metadata using the secret management service describe API.
     * Provides more detailed metadata including rotation status.
     */
    private buildDescribedSecretMetadata;
    /**
     * Issues a secret lease for a deployment operation.
     * The lease is used to track who accessed the secret and for what purpose.
     */
    private issueSecretLease;
    /**
     * Revokes a previously issued secret lease.
     */
    private revokeSecretLease;
    /**
     * Updates secret metadata to include lease information.
     */
    private applyLeaseToMetadata;
}
