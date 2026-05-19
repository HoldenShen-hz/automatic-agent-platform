/**
 * Release Pipeline Service
 */

export * from "./release-pipeline-support.js";

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { PolicyDeniedError, StorageError, ToolExecutionError, ValidationError } from "../../contracts/errors.js";
import { SecretManagementService } from "../iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, EnvironmentName, ReleaseBundleRecord, ReleaseExecutionReportRecord, SecretLeaseRecord } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  DEFAULT_CONFIG_ROOT,
  DEFAULT_REPO_ROOT,
  LocalReleasePipelineCommandRunner,
  ROTATION_GUARDED_ENVIRONMENTS,
  buildExecutionMarkdown,
  buildMarkdown,
  extractWorkflowDispatchReceipt,
  sanitizeConfigBundleRef,
  sanitizeCommitSha,
  sanitizeImageRepository,
  sanitizeRegistry,
  sanitizeSecretRef,
  sanitizeVersion,
  type ReleaseEnvironmentConfig,
  type ReleasePipelineBundle,
  type ReleasePipelineExecutionExportResult,
  type ReleasePipelineExecutionReport,
  type ReleasePipelineExportResult,
  type ReleasePipelineInput,
  type ReleasePipelineSecretMetadata,
  type ReleasePipelineServiceOptions,
  type ReleasePipelineCommandResult,
  type ReleasePipelineCommandRunner,
} from "./release-pipeline-support.js";

export class ReleasePipelineService {
  private readonly repoRootDir: string;
  private readonly configRootDir: string;
  private readonly artifactStore: ArtifactStore;
  private readonly secretManagementService: SecretManagementService | null;
  private readonly store: AuthoritativeTaskStore | null;
  private readonly commandRunner: ReleasePipelineCommandRunner;
  private environmentConfigCache: { cacheKey: string; configs: ReleaseEnvironmentConfig[] } | null = null;

  public constructor(options: ReleasePipelineServiceOptions = {}) {
    this.repoRootDir = resolve(options.repoRootDir ?? DEFAULT_REPO_ROOT);
    this.configRootDir = resolve(options.configRootDir ?? join(this.repoRootDir, "config", "environments"));
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
    this.secretManagementService = options.secretManagementService ?? null;
    this.store = options.store ?? null;
    this.commandRunner = options.commandRunner ?? new LocalReleasePipelineCommandRunner();
  }

  /**
   * Lists all environment configurations from the config directory.
   * Each JSON file in the config root represents one environment.
   */
  public listEnvironmentConfigs(): ReleaseEnvironmentConfig[] {
    if (!existsSync(this.configRootDir)) {
      const code = `release.config_root_missing:${this.configRootDir}`;
      throw new StorageError(code, code, {
        statusCode: 404,
        retryable: false,
        details: { configRootDir: this.configRootDir },
      });
    }

    const entries = readdirSync(this.configRootDir)
      .filter((entry) => entry.endsWith(".json"))
      .sort();
    const cacheKey = entries
      .map((entry) => {
        const path = join(this.configRootDir, entry);
        const stat = statSync(path);
        return `${entry}:${stat.mtimeMs}:${stat.size}`;
      })
      .join("|");
    if (this.environmentConfigCache?.cacheKey === cacheKey) {
      return this.environmentConfigCache.configs.map((config) => ({ ...config }));
    }
    const configs = entries.map((entry) => {
      const path = join(this.configRootDir, entry);
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      return this.validateEnvironmentConfig(path, parsed);
    });
    this.environmentConfigCache = { cacheKey, configs };
    return configs.map((config) => ({ ...config }));
  }

  /**
   * Builds a release bundle for the specified environment and version.
   * Validates all inputs, checks workflow files exist, and ensures secrets are ready.
   * The bundle can be exported to artifact storage or executed directly.
   */
  public async buildBundle(input: ReleasePipelineInput): Promise<ReleasePipelineBundle> {
    const config = this.requireEnvironmentConfig(input.environment);
    const version = sanitizeVersion(input.version);
    const commitSha = sanitizeCommitSha(input.commitSha);
    const registry = sanitizeRegistry(input.registry ?? config.registry);
    const imageRepository = sanitizeImageRepository(input.imageRepository ?? config.imageRepository);

    // Validate rollout strategy is allowed for this environment
    if (!config.allowedRolloutStrategies.includes(input.rolloutStrategy)) {
      const code = `release.rollout_not_allowed:${config.environment}:${input.rolloutStrategy}`;
      throw new PolicyDeniedError(code, code, {
        retryable: false,
        details: {
          environment: config.environment,
          rolloutStrategy: input.rolloutStrategy,
          allowedRolloutStrategies: config.allowedRolloutStrategies,
        },
      });
    }

    // Verify config path exists
    const configPath = resolve(this.repoRootDir, config.configPath);
    if (!existsSync(configPath)) {
      const code = `release.config_path_missing:${config.configPath}`;
      throw new StorageError(code, code, {
        statusCode: 404,
        retryable: false,
        details: { configPath: config.configPath },
      });
    }

    // Verify workflow files exist
    const publishWorkflowPath = resolve(this.repoRootDir, config.publishWorkflowPath);
    const deployWorkflowPath = resolve(this.repoRootDir, config.deployWorkflowPath);
    if (!existsSync(publishWorkflowPath)) {
      const code = `release.workflow_missing:${config.publishWorkflowPath}`;
      throw new StorageError(code, code, {
        statusCode: 404,
        retryable: false,
        details: { workflowPath: config.publishWorkflowPath },
      });
    }
    if (!existsSync(deployWorkflowPath)) {
      const code = `release.workflow_missing:${config.deployWorkflowPath}`;
      throw new StorageError(code, code, {
        statusCode: 404,
        retryable: false,
        details: { workflowPath: config.deployWorkflowPath },
      });
    }

    // Construct image reference
    const imageTag = `${version}-${commitSha.slice(0, 12)}`;
    const imageRef = `${registry}/${imageRepository}:${imageTag}`;
    const configBundleRef = sanitizeConfigBundleRef(config.configBundleRef);
    const registryCredentialRef = sanitizeSecretRef(
      config.registryCredentialRef,
      "release.invalid_registry_credential_ref",
    );
    const deploymentCredentialRef = sanitizeSecretRef(
      config.deploymentCredentialRef,
      "release.invalid_deployment_credential_ref",
    );

    // Verify secrets are ready for rotation-guarded environments
    if (this.secretManagementService != null) {
      await this.assertManagedSecretReady(config.environment, registryCredentialRef, "registry");
      await this.assertManagedSecretReady(config.environment, deploymentCredentialRef, "deployment");
    }

    return {
      bundleId: newId("release_bundle"),
      generatedAt: input.generatedAt ?? nowIso(),
      environment: config.environment,
      version,
      commitSha,
      imageTag,
      imageRef,
      imageRepository,
      rolloutStrategy: input.rolloutStrategy,
      deploymentNamespace: config.deploymentNamespace,
      clusterName: config.clusterName,
      configPath: config.configPath,
      configBundleRef,
      registryCredentialRef,
      deploymentCredentialRef,
      publishWorkflowPath: config.publishWorkflowPath,
      deployWorkflowPath: config.deployWorkflowPath,
      requiredReadinessChecks: [
        "stable_release_gate",
        "environment_readiness_registry",
        "stable_release_checklist",
        "stable_validation_baseline",
        "secret_injection_plan",
      ],
      recommendedCommands: [
        `docker build -t ${imageRef} .`,
        `gh workflow run ${config.publishWorkflowPath} -f environment=${config.environment} -f image_tag=${imageTag} -f image_repository=${imageRepository} -f registry_secret_ref=${registryCredentialRef}`,
        `gh workflow run ${config.deployWorkflowPath} -f environment=${config.environment} -f image_tag=${imageTag} -f rollout_strategy=${input.rolloutStrategy} -f deployment_secret_ref=${deploymentCredentialRef} -f config_bundle_ref=${configBundleRef}`,
      ],
    };
  }

  /**
   * Exports a release bundle to artifact storage as both JSON and markdown.
   */
  public async exportBundle(input: ReleasePipelineInput): Promise<ReleasePipelineExportResult> {
    const bundle = await this.buildBundle(input);
    const persistedTaskId = input.taskId != null && this.store?.getTask(input.taskId) != null ? input.taskId : null;
    const { jsonArtifact, markdownArtifact } = this.persistBundle(bundle, persistedTaskId);

    return {
      bundle,
      jsonArtifact,
      markdownArtifact,
    };
  }

  /**
   * Executes the full release pipeline: builds the Docker image, publishes via workflow,
   * and exports the bundle and execution report to artifact storage.
   *
   * Requires secret management service to be configured for secret lease handling.
   */
  public async executeAndExport(input: ReleasePipelineInput): Promise<ReleasePipelineExecutionExportResult> {
    if (this.secretManagementService == null) {
      throw new ValidationError("release.secret_management_required_for_execute", "release.secret_management_required_for_execute", {
        retryable: false,
      });
    }

    const bundle = await this.buildBundle(input);
    const persistedTaskId = input.taskId != null && this.store?.getTask(input.taskId) != null ? input.taskId : null;

    // Persist bundle artifacts
    const { jsonArtifact: bundleJsonArtifact, markdownArtifact: bundleMarkdownArtifact } = this.persistBundle(
      bundle,
      persistedTaskId,
    );

    // Execute the pipeline
    const report = await this.executeBundle(bundle, persistedTaskId);

    // Persist execution report artifacts
    const taskId = persistedTaskId ?? "release_pipeline";
    const reportJsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      executionId: report.executionId,
      stepId: null,
      kind: "release_pipeline_execution_report",
      fileName: `release-pipeline-execution-${bundle.environment}.json`,
      content: report,
    }).ref;
    const reportMarkdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      executionId: report.executionId,
      stepId: null,
      kind: "release_pipeline_execution_report_markdown",
      fileName: `release-pipeline-execution-${bundle.environment}.md`,
      content: buildExecutionMarkdown(report),
      mimeType: "text/markdown",
    }).ref;

    // Persist execution report record
    this.persistExecutionReport(report, persistedTaskId, reportJsonArtifact.uri, reportMarkdownArtifact.uri);

    return {
      bundle,
      report,
      bundleJsonArtifact,
      bundleMarkdownArtifact,
      reportJsonArtifact,
      reportMarkdownArtifact,
    };
  }

  /**
   * Persists an execution report record to the store if available.
   */
  private persistExecutionReport(
    report: ReleasePipelineExecutionReport,
    persistedTaskId: string | null,
    jsonArtifactUri: string,
    markdownArtifactUri: string,
  ): void {
    if (this.store == null) {
      return;
    }
    const record: ReleaseExecutionReportRecord = {
      executionId: report.executionId,
      bundleId: report.bundleId,
      environment: report.environment,
      version: report.version,
      commitSha: report.commitSha,
      rolloutStrategy: report.rolloutStrategy,
      imageRef: report.imageRef,
      imageRepository: report.imageRepository,
      registrySecretRef: report.registrySecret.secretRef,
      registrySecretProviderKind: report.registrySecret.providerKind,
      registrySecretResolved: report.registrySecret.resolved ? 1 : 0,
      registrySecretAccessMode: report.registrySecret.accessMode,
      registryLeaseId: report.registrySecret.leaseId,
      registryLeaseStatus: report.registrySecret.leaseStatus,
      registryLeaseExpiresAt: report.registrySecret.leaseExpiresAt,
      registryLeaseRevokedAt: report.registrySecret.revokedAt,
      publishWorkflowRunId: report.publishWorkflowRunId,
      publishWorkflowRunUrl: report.publishWorkflowRunUrl,
      buildCommand: report.buildCommand,
      publishCommand: report.publishCommand,
      commandResultsJson: JSON.stringify(report.commandResults),
      taskId: persistedTaskId,
      jsonArtifactUri,
      markdownArtifactUri,
      generatedAt: report.generatedAt,
      exportedAt: nowIso(),
    };
    this.store.release.insertReleaseExecutionReportRecord(record);
  }

  /**
   * Retrieves the environment config, throwing if not found.
   */
  private requireEnvironmentConfig(environment: EnvironmentName): ReleaseEnvironmentConfig {
    const config = this.listEnvironmentConfigs().find((item) => item.environment === environment);
    if (!config) {
      const code = `release.environment_not_found:${environment}`;
      throw new StorageError(code, code, {
        statusCode: 404,
        retryable: false,
        details: { environment },
      });
    }
    return config;
  }

  /**
   * Asserts that a managed secret is ready for use.
   * For rotation-guarded environments, also checks that rotation is not due.
   */
  private async assertManagedSecretReady(
    environment: EnvironmentName,
    secretRef: string,
    usage: "registry" | "deployment",
  ): Promise<void> {
    if (this.secretManagementService == null) {
      return;
    }

    const description = await this.secretManagementService.describeSecret(secretRef);

    // Block if secret is currently rotating
    if (description.registry.status === "rotating") {
      const code = `release.secret_rotating:${environment}:${usage}:${secretRef}`;
      throw new PolicyDeniedError(code, code, {
        retryable: false,
        details: { environment, usage, secretRef },
      });
    }

    // For protected environments, block if rotation is due
    if (
      ROTATION_GUARDED_ENVIRONMENTS.has(environment) &&
      description.registry.nextRotationDueAt != null &&
      new Date(description.registry.nextRotationDueAt).getTime() <= Date.now()
    ) {
      const code = `release.secret_rotation_due:${environment}:${usage}:${secretRef}`;
      throw new PolicyDeniedError(code, code, {
        retryable: false,
        details: { environment, usage, secretRef, nextRotationDueAt: description.registry.nextRotationDueAt },
      });
    }
  }

  /**
   * Persists a bundle to artifact storage and optionally to the database.
   */
  private persistBundle(
    bundle: ReleasePipelineBundle,
    persistedTaskId: string | null,
  ): { jsonArtifact: ArtifactRef; markdownArtifact: ArtifactRef } {
    const taskId = persistedTaskId ?? "release_pipeline";

    // Write JSON artifact for programmatic consumption
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "release_pipeline_bundle",
      fileName: `release-pipeline-${bundle.environment}.json`,
      content: bundle,
    }).ref;

    // Write markdown artifact for human review
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "release_pipeline_bundle_markdown",
      fileName: `release-pipeline-${bundle.environment}.md`,
      content: buildMarkdown(bundle),
      mimeType: "text/markdown",
    }).ref;

    // Persist bundle record to database if store is available
    if (this.store != null) {
      const record: ReleaseBundleRecord = {
        bundleId: bundle.bundleId,
        environment: bundle.environment,
        version: bundle.version,
        commitSha: bundle.commitSha,
        imageTag: bundle.imageTag,
        imageRef: bundle.imageRef,
        rolloutStrategy: bundle.rolloutStrategy,
        deploymentNamespace: bundle.deploymentNamespace,
        clusterName: bundle.clusterName,
        configPath: bundle.configPath,
        configBundleRef: bundle.configBundleRef,
        registryCredentialRef: bundle.registryCredentialRef,
        deploymentCredentialRef: bundle.deploymentCredentialRef,
        publishWorkflowPath: bundle.publishWorkflowPath,
        deployWorkflowPath: bundle.deployWorkflowPath,
        requiredReadinessChecksJson: JSON.stringify(bundle.requiredReadinessChecks),
        recommendedCommandsJson: JSON.stringify(bundle.recommendedCommands),
        taskId: persistedTaskId,
        jsonArtifactUri: jsonArtifact.uri,
        markdownArtifactUri: markdownArtifact.uri,
        generatedAt: bundle.generatedAt,
        exportedAt: nowIso(),
      };
      this.store.release.insertReleaseBundleRecord(record);
    }

    return {
      jsonArtifact,
      markdownArtifact,
    };
  }

  /**
   * Executes the release pipeline: builds Docker image and triggers publish workflow.
   * Manages secret leases for the registry credential during execution.
   */
  private async executeBundle(bundle: ReleasePipelineBundle, persistedTaskId: string | null): Promise<ReleasePipelineExecutionReport> {
    if (this.secretManagementService == null) {
      throw new ValidationError("release.secret_management_required_for_execute", "release.secret_management_required_for_execute", {
        retryable: false,
      });
    }

    const executionId = newId("release_execution");

    // Get secret metadata with lease tracking
    const registrySecret = await this.buildDescribedSecretMetadata(bundle.registryCredentialRef);

    // Build command arguments
    const buildArgs = ["build", "-t", bundle.imageRef, "."];
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

    const commandResults: ReleasePipelineCommandResult[] = [];
    let registryLease: SecretLeaseRecord | null = null;
    let buildExitCode: number | null = null;
    let publishExitCode: number | null = null;
    let registrySecretWithLease = registrySecret;
    let publishWorkflowRunId: string | null = null;
    let publishWorkflowRunUrl: string | null = null;

    try {
      // Execute Docker build
      const buildResult = await this.commandRunner.run({
        step: "build_image",
        command: "docker",
        args: buildArgs,
        cwd: this.repoRootDir,
      });
      commandResults.push(buildResult);
      buildExitCode = buildResult.exitCode;

      // Fail fast if build fails
      if (buildResult.exitCode !== 0) {
        const code = `release.build_failed:${buildResult.exitCode}`;
        throw new ToolExecutionError(code, code, {
          retryable: false,
          details: {
            exitCode: buildResult.exitCode,
            command: buildResult.command,
            args: buildResult.args,
            stdout: buildResult.stdout,
            stderr: buildResult.stderr,
          },
        });
      }

      // Issue secret lease for registry access during publish
      registryLease = await this.issueRegistryLease({
        executionId,
        taskId: persistedTaskId,
        bundle,
      });
      registrySecretWithLease = this.applyLeaseToMetadata(registryLease, registrySecretWithLease);

      // Execute GitHub Actions workflow for publishing
      const publishResult = await this.commandRunner.run({
        step: "publish_workflow",
        command: "gh",
        args: publishArgs,
        cwd: this.repoRootDir,
      });
      commandResults.push(publishResult);
      publishExitCode = publishResult.exitCode;

      // Extract workflow run information from command output
      ({
        runId: publishWorkflowRunId,
        runUrl: publishWorkflowRunUrl,
      } = extractWorkflowDispatchReceipt([publishResult.stdout, publishResult.stderr].filter(Boolean).join("\n")));

      // Fail fast if publish fails
      if (publishResult.exitCode !== 0) {
        const code = `release.publish_failed:${publishResult.exitCode}`;
        throw new ToolExecutionError(code, code, {
          retryable: false,
          details: {
            exitCode: publishResult.exitCode,
            command: publishResult.command,
            args: publishResult.args,
            stdout: publishResult.stdout,
            stderr: publishResult.stderr,
          },
        });
      }
    } finally {
      // Always revoke the secret lease when done, whether success or failure
      if (registryLease != null) {
        const revoked = await this.secretManagementService.revokeSecretLease({
          leaseId: registryLease.leaseId,
          revokedBy: "release_pipeline_service",
          reasonCode:
            buildExitCode == null || buildExitCode !== 0
              ? "build_failed"
              : publishExitCode == null || publishExitCode !== 0
                ? "publish_failed"
                : "publish_complete",
        });
        registrySecretWithLease = this.applyLeaseToMetadata(revoked, registrySecretWithLease);
      }
    }

    return {
      executionId,
      bundleId: bundle.bundleId,
      generatedAt: nowIso(),
      environment: bundle.environment,
      version: bundle.version,
      commitSha: bundle.commitSha,
      rolloutStrategy: bundle.rolloutStrategy,
      imageRef: bundle.imageRef,
      imageRepository: bundle.imageRepository,
      registrySecret: registrySecretWithLease,
      publishWorkflowRunId,
      publishWorkflowRunUrl,
      buildCommand: `docker ${buildArgs.join(" ")}`,
      publishCommand: `gh ${publishArgs.join(" ")}`,
      executionMode: "execute",
      commandResults,
    };
  }

  /**
   * Gets secret metadata by describing it through the secret management service.
   */
  private async buildDescribedSecretMetadata(secretRef: string): Promise<ReleasePipelineSecretMetadata> {
    if (this.secretManagementService == null) {
      throw new ValidationError("release.secret_management_required_for_execute", "release.secret_management_required_for_execute", {
        retryable: false,
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
   * Issues a secret lease for registry access during publish workflow execution.
   */
  private async issueRegistryLease(input: {
    executionId: string;
    taskId: string | null;
    bundle: ReleasePipelineBundle;
  }): Promise<SecretLeaseRecord> {
    if (this.secretManagementService == null) {
      throw new ValidationError("release.secret_management_required_for_execute", "release.secret_management_required_for_execute", {
        retryable: false,
      });
    }
    const issued = await this.secretManagementService.issueSecretLease({
      secretRef: input.bundle.registryCredentialRef,
      requestedBy: "release_pipeline_service",
      grantedTo: `release:${input.bundle.environment}:publish`,
      usagePurpose: "publish_image",
      ...(input.taskId == null ? {} : { taskId: input.taskId }),
      metadata: {
        releaseExecutionId: input.executionId,
        releaseBundleId: input.bundle.bundleId,
        environment: input.bundle.environment,
        version: input.bundle.version,
        commitSha: input.bundle.commitSha,
        rolloutStrategy: input.bundle.rolloutStrategy,
      },
    });
    return issued.lease;
  }

  /**
   * Updates secret metadata with lease information.
   */
  private applyLeaseToMetadata(
    lease: SecretLeaseRecord,
    metadata: ReleasePipelineSecretMetadata,
  ): ReleasePipelineSecretMetadata {
    return {
      ...metadata,
      accessMode: "lease",
      leaseId: lease.leaseId,
      leaseStatus: lease.status,
      leaseExpiresAt: lease.expiresAt,
      revokedAt: lease.revokedAt,
    };
  }

  private validateEnvironmentConfig(path: string, parsed: unknown): ReleaseEnvironmentConfig {
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ValidationError("release.invalid_environment_config", "release.invalid_environment_config", {
        details: { path },
      });
    }
    const config = parsed as Partial<ReleaseEnvironmentConfig>;
    const requiredFields: Array<keyof ReleaseEnvironmentConfig> = [
      "environment",
      "registry",
      "imageRepository",
      "deploymentNamespace",
      "configPath",
      "configBundleRef",
      "registryCredentialRef",
      "deploymentCredentialRef",
      "deployWorkflowPath",
      "publishWorkflowPath",
      "clusterName",
      "allowedRolloutStrategies",
    ];
    for (const field of requiredFields) {
      const value = config[field];
      if (value == null || (typeof value === "string" && value.trim().length === 0)) {
        throw new ValidationError("release.invalid_environment_config", "release.invalid_environment_config", {
          details: { path, field },
        });
      }
    }
    if (!Array.isArray(config.allowedRolloutStrategies) || config.allowedRolloutStrategies.length === 0) {
      throw new ValidationError("release.invalid_environment_config", "release.invalid_environment_config", {
        details: { path, field: "allowedRolloutStrategies" },
      });
    }
    return config as ReleaseEnvironmentConfig;
  }
}
