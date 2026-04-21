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
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { ConfigGovernanceService } from "../config-center/config-governance-service.js";
import { StorageError, ToolExecutionError, ValidationError } from "../../contracts/errors.js";
import { EnvSecretProvider } from "../iam/env-secret-provider.js";
import { createWorkspaceWritePolicy } from "../iam/sandbox-policy.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { EnvironmentDeploymentService } from "./environment-deployment-service.js";
import { extractWorkflowDispatchReceipt } from "./workflow-dispatch-receipt.js";
const ENVIRONMENT_ORDER = ["dev", "test", "staging", "pre-prod", "prod"];
/**
 * Default command runner that executes commands locally via spawnSync.
 */
class LocalDeploymentCommandRunner {
    run(request) {
        const startedAt = Date.now();
        const result = spawnSync(request.command, request.args, {
            cwd: request.cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return {
            step: request.step,
            command: request.command,
            args: [...request.args],
            executed: true,
            exitCode: result.status ?? 1,
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
            durationMs: Date.now() - startedAt,
        };
    }
}
/**
 * Builds a markdown representation of a deployment execution report.
 */
function buildMarkdown(report) {
    const lines = [
        "# Deployment Execution Report",
        "",
        `- Execution ID: \`${report.executionId}\``,
        `- Environment: \`${report.environment}\``,
        `- Version: \`${report.version}\``,
        `- Commit SHA: \`${report.commitSha}\``,
        `- Rollout Strategy: \`${report.rolloutStrategy}\``,
        `- Target Eligible: \`${report.targetEligible}\``,
        `- Config Bundle Ref: \`${report.configBundleRef}\``,
        `- Config Version: \`${report.configVersionId ?? "unknown"}\``,
        `- Registry Secret Ref: \`${report.registrySecret.secretRef}\``,
        `- Deployment Secret Ref: \`${report.deploymentSecret.secretRef}\``,
        `- Execution Mode: \`${report.executionMode}\``,
        `- Publish Workflow Run: \`${report.publishWorkflowRunId ?? "pending"}\`${report.publishWorkflowRunUrl == null ? "" : ` url=\`${report.publishWorkflowRunUrl}\``}`,
        `- Deploy Workflow Run: \`${report.deployWorkflowRunId ?? "pending"}\`${report.deployWorkflowRunUrl == null ? "" : ` url=\`${report.deployWorkflowRunUrl}\``}`,
        "",
        "## Commands",
        "",
        `- Publish: \`${report.publishCommand}\``,
        `- Deploy: \`${report.deployCommand}\``,
        "",
        "## Secret Resolution",
        "",
        `- Registry Secret Ready: \`${report.registrySecret.resolved}\` (${report.registrySecret.envName})`,
        `- Registry Secret Access: \`${report.registrySecret.accessMode}\`${report.registrySecret.leaseId == null ? "" : ` lease=\`${report.registrySecret.leaseId}\``}`,
        `- Deployment Secret Ready: \`${report.deploymentSecret.resolved}\` (${report.deploymentSecret.envName})`,
        `- Deployment Secret Access: \`${report.deploymentSecret.accessMode}\`${report.deploymentSecret.leaseId == null ? "" : ` lease=\`${report.deploymentSecret.leaseId}\``}`,
        "",
        "## Command Results",
        "",
        ...(report.commandResults.length > 0
            ? report.commandResults.map((result) => `- \`${result.step}\`: exit=${result.exitCode}, executed=${result.executed}, durationMs=${result.durationMs}`)
            : ["- none"]),
    ];
    return `${lines.join("\n")}\n`;
}
/**
 * DeploymentExecutionService executes deployments to environments.
 * It orchestrates the publish and deploy workflow runs, manages secret leases,
 * and produces detailed execution reports for audit and debugging.
 */
export class DeploymentExecutionService {
    store;
    repoRootDir;
    artifactStore;
    environmentDeploymentService;
    configService;
    secretProvider;
    secretManagementService;
    commandRunner;
    constructor(store, options = {}) {
        this.store = store;
        this.repoRootDir = resolve(options.repoRootDir ?? process.cwd());
        const configRoot = join(this.repoRootDir, "config");
        const secretManagementService = options.secretManagementService ?? null;
        this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
        this.environmentDeploymentService = new EnvironmentDeploymentService(store, {
            repoRootDir: this.repoRootDir,
            ...(secretManagementService == null ? {} : { secretManagementService }),
            ...(options.artifactStoreOptions ? { artifactStoreOptions: options.artifactStoreOptions } : {}),
        });
        this.configService = new ConfigGovernanceService({
            configRoot,
            sandboxPolicy: createWorkspaceWritePolicy(configRoot),
        });
        this.secretProvider = options.secretProvider ?? new EnvSecretProvider();
        this.secretManagementService = secretManagementService;
        this.commandRunner = options.commandRunner ?? new LocalDeploymentCommandRunner();
    }
    /**
     * Builds a deployment execution report without executing commands.
     * Useful for previewing what a deployment would do.
     */
    async buildReport(input) {
        return (await this.buildReportArtifacts(input)).report;
    }
    /**
     * Internal method that builds the full deployment report with artifacts.
     * Validates environment readiness and bundle availability.
     */
    async buildReportArtifacts(input) {
        const generatedAt = input.generatedAt ?? nowIso();
        const executionId = newId("deployment_execution");
        // Verify task exists if taskId is provided
        const persistedTaskId = input.taskId != null && this.store.task.getTask(input.taskId) != null ? input.taskId : null;
        // Build environment deployment matrix to check readiness
        const matrix = await this.environmentDeploymentService.buildReport({
            targetEnvironment: input.environment,
            version: input.version,
            commitSha: input.commitSha,
            rolloutStrategy: input.rolloutStrategy,
            generatedAt,
            ...(input.taskId ? { taskId: input.taskId } : {}),
        });
        // Require target release bundle to exist
        if (matrix.targetReleaseBundle == null) {
            throw new StorageError(`deployment_execution.target_bundle_missing:${input.environment}`, `deployment_execution.target_bundle_missing:${input.environment}`, {
                statusCode: 404,
                retryable: false,
                details: { environment: input.environment },
            });
        }
        const bundle = matrix.targetReleaseBundle;
        const configBundle = this.configService.loadBundle(input.environment);
        // Resolve secret metadata for registry and deployment credentials
        // Direct resolution if no secret management service, describe-based otherwise
        let registrySecret = this.secretManagementService == null
            ? await this.buildDirectSecretMetadata(bundle.registryCredentialRef)
            : await this.buildDescribedSecretMetadata(bundle.registryCredentialRef);
        let deploymentSecret = this.secretManagementService == null
            ? await this.buildDirectSecretMetadata(bundle.deploymentCredentialRef)
            : await this.buildDescribedSecretMetadata(bundle.deploymentCredentialRef);
        // Build GitHub Actions workflow command arguments
        const publishArgs = [
            "workflow",
            "run",
            bundle.publishWorkflowPath,
            "-f",
            `environment=${bundle.environment}`,
            "-f",
            `image_tag=${bundle.imageTag}`,
            "-f",
            `image_repository=${bundle.imageRepository}`,
            "-f",
            `registry_secret_ref=${bundle.registryCredentialRef}`,
        ];
        const deployArgs = [
            "workflow",
            "run",
            bundle.deployWorkflowPath,
            "-f",
            `environment=${bundle.environment}`,
            "-f",
            `image_tag=${bundle.imageTag}`,
            "-f",
            `rollout_strategy=${bundle.rolloutStrategy}`,
            "-f",
            `deployment_secret_ref=${bundle.deploymentCredentialRef}`,
            "-f",
            `config_bundle_ref=${bundle.configBundleRef}`,
        ];
        const commandResults = [];
        let publishWorkflowRunId = null;
        let publishWorkflowRunUrl = null;
        let deployWorkflowRunId = null;
        let deployWorkflowRunUrl = null;
        // Execute commands if in execute mode
        if (input.execute === true) {
            let registryLease = null;
            let deploymentLease = null;
            let publishExitCode = null;
            let deployExitCode = null;
            try {
                // Issue secret lease for registry credential if management service is available
                if (this.secretManagementService != null) {
                    registryLease = await this.issueSecretLease({
                        executionId,
                        taskId: persistedTaskId,
                        environment: input.environment,
                        version: bundle.version,
                        commitSha: bundle.commitSha,
                        rolloutStrategy: bundle.rolloutStrategy,
                        releaseBundleId: bundle.bundleId,
                        secretRef: bundle.registryCredentialRef,
                        grantedTo: `deploy:${input.environment}:publish`,
                        usagePurpose: "publish_image",
                    });
                    registrySecret = this.applyLeaseToMetadata(registryLease.lease, registrySecret);
                }
                // Execute publish workflow
                const publishResult = this.commandRunner.run({
                    step: "publish",
                    command: "gh",
                    args: publishArgs,
                    cwd: this.repoRootDir,
                });
                commandResults.push(publishResult);
                publishExitCode = publishResult.exitCode;
                // Extract workflow run ID and URL from output
                ({
                    runId: publishWorkflowRunId,
                    runUrl: publishWorkflowRunUrl,
                } = extractWorkflowDispatchReceipt([publishResult.stdout, publishResult.stderr].filter(Boolean).join("\n")));
                // Fail fast if publish fails
                if (publishResult.exitCode !== 0) {
                    throw new ToolExecutionError(`deployment_execution.publish_failed:${publishResult.exitCode}`, `deployment_execution.publish_failed:${publishResult.exitCode}`, {
                        retryable: false,
                        details: {
                            exitCode: publishResult.exitCode,
                            stdout: publishResult.stdout,
                            stderr: publishResult.stderr,
                        },
                    });
                }
                // Issue secret lease for deployment credential
                if (this.secretManagementService != null) {
                    deploymentLease = await this.issueSecretLease({
                        executionId,
                        taskId: persistedTaskId,
                        environment: input.environment,
                        version: bundle.version,
                        commitSha: bundle.commitSha,
                        rolloutStrategy: bundle.rolloutStrategy,
                        releaseBundleId: bundle.bundleId,
                        secretRef: bundle.deploymentCredentialRef,
                        grantedTo: `deploy:${input.environment}:deploy`,
                        usagePurpose: "deploy_environment",
                    });
                    deploymentSecret = this.applyLeaseToMetadata(deploymentLease.lease, deploymentSecret);
                }
                // Execute deploy workflow
                const deployResult = this.commandRunner.run({
                    step: "deploy",
                    command: "gh",
                    args: deployArgs,
                    cwd: this.repoRootDir,
                });
                commandResults.push(deployResult);
                deployExitCode = deployResult.exitCode;
                // Extract workflow run ID and URL from output
                ({
                    runId: deployWorkflowRunId,
                    runUrl: deployWorkflowRunUrl,
                } = extractWorkflowDispatchReceipt([deployResult.stdout, deployResult.stderr].filter(Boolean).join("\n")));
                // Fail fast if deploy fails
                if (deployResult.exitCode !== 0) {
                    throw new ToolExecutionError(`deployment_execution.deploy_failed:${deployResult.exitCode}`, `deployment_execution.deploy_failed:${deployResult.exitCode}`, {
                        retryable: false,
                        details: {
                            exitCode: deployResult.exitCode,
                            stdout: deployResult.stdout,
                            stderr: deployResult.stderr,
                        },
                    });
                }
            }
            finally {
                // Always revoke leases with reason based on execution outcome
                if (registryLease != null) {
                    const revoked = await this.revokeSecretLease(registryLease.lease.leaseId, publishExitCode == null || publishExitCode !== 0 ? "publish_failed" : "publish_complete");
                    registrySecret = this.applyLeaseToMetadata(revoked, registrySecret);
                }
                if (deploymentLease != null) {
                    const revoked = await this.revokeSecretLease(deploymentLease.lease.leaseId, deployExitCode == null || deployExitCode !== 0 ? "deploy_failed" : "deploy_complete");
                    deploymentSecret = this.applyLeaseToMetadata(revoked, deploymentSecret);
                }
            }
        }
        return {
            report: {
                executionId,
                releaseBundleId: bundle.bundleId,
                generatedAt,
                environment: input.environment,
                version: bundle.version,
                commitSha: bundle.commitSha,
                rolloutStrategy: bundle.rolloutStrategy,
                targetEligible: matrix.targetEligible,
                configBundleRef: bundle.configBundleRef,
                configVersionId: configBundle.version.versionId,
                registrySecret,
                deploymentSecret,
                publishWorkflowRunId,
                publishWorkflowRunUrl,
                deployWorkflowRunId,
                deployWorkflowRunUrl,
                publishCommand: `gh ${publishArgs.join(" ")}`,
                deployCommand: `gh ${deployArgs.join(" ")}`,
                executionMode: input.execute === true ? "execute" : "plan",
                commandResults,
            },
            releaseBundle: bundle,
        };
    }
    /**
     * Exports the deployment execution report to artifact storage
     * and persists records to the database.
     */
    async exportReport(input) {
        const { report, releaseBundle } = await this.buildReportArtifacts(input);
        const persistedTaskId = input.taskId != null && this.store.task.getTask(input.taskId) != null ? input.taskId : null;
        const taskId = persistedTaskId ?? "deployment_execution";
        // Write JSON artifact for programmatic consumption
        const jsonArtifact = this.artifactStore.writeJsonArtifact({
            taskId,
            executionId: null,
            stepId: null,
            kind: "deployment_execution_report",
            fileName: `deployment-execution-${report.environment}.json`,
            content: report,
        }).ref;
        // Write markdown artifact for human review
        const markdownArtifact = this.artifactStore.writeTextArtifact({
            taskId,
            executionId: null,
            stepId: null,
            kind: "deployment_execution_report_markdown",
            fileName: `deployment-execution-${report.environment}.md`,
            content: buildMarkdown(report),
            mimeType: "text/markdown",
        }).ref;
        // Persist release bundle record if not already stored
        if (releaseBundle != null && this.store.release.getReleaseBundleRecord(releaseBundle.bundleId) == null) {
            const releaseRecord = {
                bundleId: releaseBundle.bundleId,
                environment: releaseBundle.environment,
                version: releaseBundle.version,
                commitSha: releaseBundle.commitSha,
                imageTag: releaseBundle.imageTag,
                imageRef: releaseBundle.imageRef,
                rolloutStrategy: releaseBundle.rolloutStrategy,
                deploymentNamespace: releaseBundle.deploymentNamespace,
                clusterName: releaseBundle.clusterName,
                configPath: releaseBundle.configPath,
                configBundleRef: releaseBundle.configBundleRef,
                registryCredentialRef: releaseBundle.registryCredentialRef,
                deploymentCredentialRef: releaseBundle.deploymentCredentialRef,
                publishWorkflowPath: releaseBundle.publishWorkflowPath,
                deployWorkflowPath: releaseBundle.deployWorkflowPath,
                requiredReadinessChecksJson: JSON.stringify(releaseBundle.requiredReadinessChecks),
                recommendedCommandsJson: JSON.stringify(releaseBundle.recommendedCommands),
                taskId: persistedTaskId,
                jsonArtifactUri: null,
                markdownArtifactUri: null,
                generatedAt: releaseBundle.generatedAt,
                exportedAt: nowIso(),
            };
            this.store.release.insertReleaseBundleRecord(releaseRecord);
        }
        // Persist deployment execution report record
        const executionRecord = {
            executionId: report.executionId,
            environment: report.environment,
            version: report.version,
            commitSha: report.commitSha,
            rolloutStrategy: report.rolloutStrategy,
            targetEligible: report.targetEligible ? 1 : 0,
            configBundleRef: report.configBundleRef,
            configVersionId: report.configVersionId,
            registrySecretRef: report.registrySecret.secretRef,
            registrySecretProviderKind: report.registrySecret.providerKind,
            registrySecretResolved: report.registrySecret.resolved ? 1 : 0,
            deploymentSecretRef: report.deploymentSecret.secretRef,
            deploymentSecretProviderKind: report.deploymentSecret.providerKind,
            deploymentSecretResolved: report.deploymentSecret.resolved ? 1 : 0,
            publishWorkflowRunId: report.publishWorkflowRunId,
            publishWorkflowRunUrl: report.publishWorkflowRunUrl,
            deployWorkflowRunId: report.deployWorkflowRunId,
            deployWorkflowRunUrl: report.deployWorkflowRunUrl,
            executionMode: report.executionMode,
            publishCommand: report.publishCommand,
            deployCommand: report.deployCommand,
            commandResultsJson: JSON.stringify(report.commandResults),
            releaseBundleId: report.releaseBundleId,
            taskId: persistedTaskId,
            jsonArtifactUri: jsonArtifact.uri,
            markdownArtifactUri: markdownArtifact.uri,
            generatedAt: report.generatedAt,
            exportedAt: nowIso(),
        };
        this.store.release.insertDeploymentExecutionReportRecord(executionRecord);
        // Persist environment promotion history record
        const promotionRecord = {
            promotionId: newId("environment_promotion"),
            sourceEnvironment: this.resolveSourceEnvironment(report.environment),
            targetEnvironment: report.environment,
            version: report.version,
            commitSha: report.commitSha,
            rolloutStrategy: report.rolloutStrategy,
            decisionType: report.executionMode,
            decisionStatus: report.executionMode === "execute" ? "executed" : "planned",
            releaseBundleId: report.releaseBundleId,
            deploymentExecutionId: report.executionId,
            reasonCode: report.executionMode === "execute" ? "promotion_executed" : "promotion_planned",
            actor: "deployment_execution_service",
            metadataJson: JSON.stringify({
                targetEligible: report.targetEligible,
                configVersionId: report.configVersionId,
                registrySecretResolved: report.registrySecret.resolved,
                deploymentSecretResolved: report.deploymentSecret.resolved,
                registrySecretLeaseId: report.registrySecret.leaseId,
                deploymentSecretLeaseId: report.deploymentSecret.leaseId,
                publishWorkflowRunId: report.publishWorkflowRunId,
                deployWorkflowRunId: report.deployWorkflowRunId,
            }),
            recordedAt: nowIso(),
        };
        this.store.release.insertEnvironmentPromotionHistoryRecord(promotionRecord);
        return {
            report,
            jsonArtifact,
            markdownArtifact,
        };
    }
    /**
     * Resolves the source environment for a promotion (the environment before this one).
     */
    resolveSourceEnvironment(targetEnvironment) {
        const index = ENVIRONMENT_ORDER.indexOf(targetEnvironment);
        if (index <= 0) {
            return null;
        }
        return ENVIRONMENT_ORDER[index - 1] ?? null;
    }
    /**
     * Builds secret metadata using direct environment variable access.
     * Used when no secret management service is configured.
     */
    async buildDirectSecretMetadata(secretRef) {
        return {
            ...await this.secretProvider.requireSecret(secretRef),
            providerKind: "environment",
            registryStatus: "active",
            lastRotatedAt: null,
            nextRotationDueAt: null,
            auditId: null,
            accessMode: "direct_env",
            leaseId: null,
            leaseStatus: null,
            leaseExpiresAt: null,
            revokedAt: null,
        };
    }
    /**
     * Builds secret metadata using the secret management service describe API.
     * Provides more detailed metadata including rotation status.
     */
    async buildDescribedSecretMetadata(secretRef) {
        if (this.secretManagementService == null) {
            throw new ValidationError("deployment_execution.secret_management_unavailable", "deployment_execution.secret_management_unavailable", {
                retryable: false,
                details: { secretRef },
            });
        }
        const described = await this.secretManagementService.describeSecret(secretRef);
        return {
            ...described.metadata,
            accessMode: "describe",
            leaseId: null,
            leaseStatus: null,
            leaseExpiresAt: null,
            revokedAt: null,
        };
    }
    /**
     * Issues a secret lease for a deployment operation.
     * The lease is used to track who accessed the secret and for what purpose.
     */
    async issueSecretLease(input) {
        if (this.secretManagementService == null) {
            throw new ValidationError("deployment_execution.secret_management_unavailable", "deployment_execution.secret_management_unavailable", {
                retryable: false,
                details: { secretRef: input.secretRef },
            });
        }
        const issued = await this.secretManagementService.issueSecretLease({
            secretRef: input.secretRef,
            requestedBy: "deployment_execution_service",
            grantedTo: input.grantedTo,
            usagePurpose: input.usagePurpose,
            ...(input.taskId == null ? {} : { taskId: input.taskId }),
            metadata: {
                deploymentExecutionId: input.executionId,
                environment: input.environment,
                version: input.version,
                commitSha: input.commitSha,
                rolloutStrategy: input.rolloutStrategy,
                releaseBundleId: input.releaseBundleId,
            },
        });
        return {
            lease: issued.lease,
            usage: input.usagePurpose,
        };
    }
    /**
     * Revokes a previously issued secret lease.
     */
    async revokeSecretLease(leaseId, reasonCode) {
        if (this.secretManagementService == null) {
            throw new ValidationError("deployment_execution.secret_management_unavailable", "deployment_execution.secret_management_unavailable", {
                retryable: false,
                details: { leaseId, reasonCode },
            });
        }
        return this.secretManagementService.revokeSecretLease({
            leaseId,
            revokedBy: "deployment_execution_service",
            reasonCode,
        });
    }
    /**
     * Updates secret metadata to include lease information.
     */
    applyLeaseToMetadata(lease, metadata) {
        return {
            ...metadata,
            accessMode: "lease",
            leaseId: lease.leaseId,
            leaseStatus: lease.status,
            leaseExpiresAt: lease.expiresAt,
            revokedAt: lease.revokedAt,
        };
    }
}
//# sourceMappingURL=deployment-execution-service.js.map