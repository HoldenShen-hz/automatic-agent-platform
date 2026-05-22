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

import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

import { ArtifactStore, type ArtifactStoreOptions } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { ConfigGovernanceService } from "../config-center/config-governance-service.js";
import { StorageError, ToolExecutionError, ValidationError } from "../../contracts/errors.js";
import { EnvSecretProvider } from "../iam/env-secret-provider.js";
import { SecretManagementService, type ManagedSecretMetadata } from "../iam/secret-management-service.js";
import { createWorkspaceWritePolicy } from "../iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type {
  ArtifactRef,
  DeploymentExecutionReportRecord,
  EnvironmentName,
  EnvironmentPromotionHistoryRecord,
  ReleaseBundleRecord,
  SecretLeaseRecord,
  SecretLeaseStatus,
} from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { EnvironmentDeploymentService, type EnvironmentDeploymentBuildInput } from "./environment-deployment-service.js";
import { extractWorkflowDispatchReceipt } from "./workflow-dispatch-receipt.js";

const ENVIRONMENT_ORDER: readonly EnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod"] as const;

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
 * Internal structure for building deployment execution artifacts.
 */
interface DeploymentExecutionBuildArtifacts {
  report: DeploymentExecutionReport;
  releaseBundle: import("./release-pipeline-service.js").ReleasePipelineBundle | null;
}

/**
 * Internal structure tracking an issued secret lease.
 */
interface DeploymentExecutionIssuedLease {
  lease: SecretLeaseRecord;
  usage: "publish_image" | "deploy_environment";
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
  run(request: DeploymentCommandRequest): Promise<DeploymentCommandResult>;
}

const MAX_DEPLOYMENT_COMMAND_OUTPUT_BYTES = 64 * 1024;
const ALLOWED_DEPLOYMENT_COMMANDS: Readonly<Record<DeploymentCommandRequest["step"], readonly string[]>> = {
  publish: ["gh"],
  deploy: ["gh"],
};

/**
 * Default command runner that executes commands locally via spawn.
 */
class LocalDeploymentCommandRunner implements DeploymentCommandRunner {
  public async run(request: DeploymentCommandRequest): Promise<DeploymentCommandResult> {
    assertAllowedDeploymentCommand(request);
    const startedAt = Date.now();
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: ["ignore", "pipe", "pipe"] as const,
    });
    const stdoutBuffer = createBoundedDeploymentOutputBuffer();
    const stderrBuffer = createBoundedDeploymentOutputBuffer();
    child.stdout?.on("data", (chunk) => { stdoutBuffer.push(chunk); });
    child.stderr?.on("data", (chunk) => { stderrBuffer.push(chunk); });
    const exitCodePromise = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new ToolExecutionError(
          "deployment_execution.command_timeout",
          "deployment_execution.command_timeout",
        ));
      }, 300_000);
      timeout.unref?.();
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });
    const exitCode = await exitCodePromise;
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode,
      stdout: stdoutBuffer.toString(),
      stderr: stderrBuffer.toString(),
      durationMs: Date.now() - startedAt,
    };
  }
}

function assertAllowedDeploymentCommand(request: DeploymentCommandRequest): void {
  const allowedCommands = ALLOWED_DEPLOYMENT_COMMANDS[request.step];
  if (allowedCommands.includes(request.command)) {
    return;
  }
  throw new ValidationError(
    `deployment_execution.command_not_allowed:${request.step}:${request.command}`,
    `deployment_execution.command_not_allowed:${request.step}:${request.command}`,
    {
      details: {
        step: request.step,
        command: request.command,
        allowedCommands,
      },
      retryable: false,
    },
  );
}

function createBoundedDeploymentOutputBuffer(maxBytes = MAX_DEPLOYMENT_COMMAND_OUTPUT_BYTES): {
  push(chunk: unknown): void;
  toString(): string;
} {
  let totalBytes = 0;
  let truncated = false;
  const chunks: string[] = [];
  return {
    push(chunk: unknown): void {
      if (truncated) {
        return;
      }
      const value = String(chunk);
      const chunkBytes = Buffer.byteLength(value, "utf8");
      const remaining = maxBytes - totalBytes;
      if (remaining <= 0) {
        truncated = true;
        chunks.push("\n[truncated]\n");
        return;
      }
      if (chunkBytes <= remaining) {
        chunks.push(value);
        totalBytes += chunkBytes;
        return;
      }
      chunks.push(Buffer.from(value, "utf8").subarray(0, remaining).toString("utf8"));
      chunks.push("\n[truncated]\n");
      totalBytes = maxBytes;
      truncated = true;
    },
    toString(): string {
      return chunks.join("");
    },
  };
}

/**
 * Builds a markdown representation of a deployment execution report.
 */
function buildMarkdown(report: DeploymentExecutionReport): string {
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
      ? report.commandResults.map(
          (result) =>
            `- \`${result.step}\`: exit=${result.exitCode}, executed=${result.executed}, durationMs=${result.durationMs}`,
        )
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
  private readonly repoRootDir: string;
  private readonly artifactStore: ArtifactStore;
  private readonly environmentDeploymentService: EnvironmentDeploymentService;
  private readonly configService: ConfigGovernanceService;
  private readonly secretProvider: EnvSecretProvider;
  private readonly secretManagementService: SecretManagementService | null;
  private readonly commandRunner: DeploymentCommandRunner;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    options: DeploymentExecutionServiceOptions = {},
  ) {
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
  public async buildReport(input: DeploymentExecutionInput): Promise<DeploymentExecutionReport> {
    return (await this.buildReportArtifacts(input)).report;
  }

  /**
   * Internal method that builds the full deployment report with artifacts.
   * Validates environment readiness and bundle availability.
   */
  private async buildReportArtifacts(input: DeploymentExecutionInput): Promise<DeploymentExecutionBuildArtifacts> {
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
      throw new StorageError(
        `deployment_execution.target_bundle_missing:${input.environment}`,
        `deployment_execution.target_bundle_missing:${input.environment}`,
        {
          statusCode: 404,
          retryable: false,
          details: { environment: input.environment },
        },
      );
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

    const commandResults: DeploymentCommandResult[] = [];
    let publishWorkflowRunId: string | null = null;
    let publishWorkflowRunUrl: string | null = null;
    let deployWorkflowRunId: string | null = null;
    let deployWorkflowRunUrl: string | null = null;

    // Execute commands if in execute mode
    if (input.execute === true) {
      let registryLease: DeploymentExecutionIssuedLease | null = null;
      let deploymentLease: DeploymentExecutionIssuedLease | null = null;
      let publishExitCode: number | null = null;
      let deployExitCode: number | null = null;

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
        const publishResult = await this.commandRunner.run({
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
        } = extractWorkflowDispatchReceipt(publishResult.stdout));

        // Fail fast if publish fails
        if (publishResult.exitCode !== 0) {
          throw new ToolExecutionError(
            `deployment_execution.publish_failed:${publishResult.exitCode}`,
            `deployment_execution.publish_failed:${publishResult.exitCode}`,
            {
              retryable: false,
              details: {
                exitCode: publishResult.exitCode,
                stdout: publishResult.stdout,
                stderr: publishResult.stderr,
              },
            },
          );
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
        const deployResult = await this.commandRunner.run({
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
        } = extractWorkflowDispatchReceipt(deployResult.stdout));

        // Fail fast if deploy fails
        if (deployResult.exitCode !== 0) {
          throw new ToolExecutionError(
            `deployment_execution.deploy_failed:${deployResult.exitCode}`,
            `deployment_execution.deploy_failed:${deployResult.exitCode}`,
            {
              retryable: false,
              details: {
                exitCode: deployResult.exitCode,
                stdout: deployResult.stdout,
                stderr: deployResult.stderr,
              },
            },
          );
        }
      } finally {
        // Always revoke leases with reason based on execution outcome
        if (registryLease != null) {
          const revoked = await this.revokeSecretLease(
            registryLease.lease.leaseId,
            publishExitCode == null || publishExitCode !== 0 ? "publish_failed" : "publish_complete",
          );
          registrySecret = this.applyLeaseToMetadata(revoked, registrySecret);
        }
        if (deploymentLease != null) {
          const revoked = await this.revokeSecretLease(
            deploymentLease.lease.leaseId,
            deployExitCode == null || deployExitCode !== 0 ? "deploy_failed" : "deploy_complete",
          );
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
  public async exportReport(input: DeploymentExecutionInput): Promise<DeploymentExecutionExportResult> {
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
      const releaseRecord: ReleaseBundleRecord = {
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
    const executionRecord: DeploymentExecutionReportRecord = {
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
    const promotionRecord: EnvironmentPromotionHistoryRecord = {
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
  private resolveSourceEnvironment(targetEnvironment: EnvironmentName): EnvironmentName | null {
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
  private async buildDirectSecretMetadata(secretRef: string): Promise<DeploymentExecutionSecretMetadata> {
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
  private async buildDescribedSecretMetadata(secretRef: string): Promise<DeploymentExecutionSecretMetadata> {
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
  private async issueSecretLease(input: {
    executionId: string;
    taskId: string | null;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    releaseBundleId: string;
    secretRef: string;
    grantedTo: string;
    usagePurpose: "publish_image" | "deploy_environment";
  }): Promise<DeploymentExecutionIssuedLease> {
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
  private async revokeSecretLease(leaseId: string, reasonCode: string): Promise<SecretLeaseRecord> {
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
  private applyLeaseToMetadata(
    lease: SecretLeaseRecord,
    metadata: DeploymentExecutionSecretMetadata,
  ): DeploymentExecutionSecretMetadata {
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
