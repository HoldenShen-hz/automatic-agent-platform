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

import { join, resolve } from "node:path";

import { ArtifactStore, type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import { ConfigGovernanceService, type ConfigBundle } from "../config-center/config-governance-service.js";
import { ValidationError } from "../../contracts/errors.js";
import { SecretManagementService } from "../iam/secret-management-service.js";
import { createWorkspaceWritePolicy } from "../iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type {
  ArtifactRef,
  DeploymentBindingRecord,
  DeploymentMode,
  EnvironmentName,
  EnvironmentReadinessComponentType,
  EnvironmentReadinessRecord,
} from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  ReleasePipelineService,
  type ReleaseEnvironmentConfig,
  type ReleasePipelineBundle,
} from "./release-pipeline-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

// Canonical environment names for deployment pipeline
type CanonicalEnvironmentName = "dev" | "test" | "staging" | "pre-prod" | "prod";

function toCanonicalEnvironmentName(environment: EnvironmentName): CanonicalEnvironmentName {
  const raw = environment as string;
  if (raw === "development") {
    return "dev";
  }
  if (raw === "production") {
    return "prod";
  }
  return raw as CanonicalEnvironmentName;
}

// Ordered list of environments in the promotion pipeline
const ENVIRONMENT_ORDER: readonly CanonicalEnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod"] as const;

// Environments that require deployment bindings to be configured
const DEPLOYMENT_BOUNDARY_ENVS = new Set<CanonicalEnvironmentName>(["staging", "pre-prod", "prod"]);

// Default readiness requirements per environment
const DEFAULT_READINESS_REQUIREMENTS: Record<CanonicalEnvironmentName, readonly EnvironmentReadinessComponentType[]> = {
  dev: [],
  test: ["provider", "sandbox"],
  staging: ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store"],
  "pre-prod": ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store"],
  prod: ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store"],
};

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
 * Validates that a string is a valid ISO timestamp.
 * Returns the parsed timestamp as ISO string.
 */
function assertIsoTimestamp(value: string, code: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(code, code, {
      retryable: false,
      details: { value },
    });
  }
  return parsed.toISOString();
}

/**
 * Parses secondary gates from JSON, returning a map of gate names to their enabled status.
 * Secondary gates represent additional readiness checks beyond basic credential status.
 */
function parseSecondaryGates(value: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (typeof entry === "boolean") {
        result[key] = entry;
      }
    }
    return result;
  } catch (err) {
    logger.warn("parseSecondaryGates failed", { error: err });
    return {};
  }
}

/**
 * Returns unique sorted values from an array, filtering out empty strings.
 */
function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) => left.localeCompare(right));
}

/**
 * Builds a markdown representation of an environment deployment report.
 */
function buildMarkdown(report: EnvironmentDeploymentReport): string {
  const lines = [
    "# Environment Deployment Report",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Generated At: \`${report.generatedAt}\``,
    `- Target Environment: \`${report.targetEnvironment ?? "none"}\``,
    `- Highest Ready Environment: \`${report.highestReadyEnvironment ?? "none"}\``,
    `- Target Eligible: \`${report.targetEligible}\``,
    "",
    "## Promotion Path",
    "",
    ...(report.promotionPath.length > 0 ? report.promotionPath.map((item) => `- \`${item}\``) : ["- none"]),
    "",
    "## Environment Matrix",
    "",
  ];

  // Add details for each environment
  for (const entry of report.entries) {
    lines.push(`### ${entry.environment}`);
    lines.push("");
    lines.push(`- Deploy Ready: \`${entry.deployReady}\``);
    lines.push(`- Config Version: \`${entry.configVersionId ?? "missing"}\``);
    lines.push(`- Bindings: \`${entry.deployment.bindingCount}\``);
    lines.push(`- Required Readiness: \`${entry.readiness.requiredComponentTypes.join(",") || "none"}\``);
    lines.push(
      `- Missing Readiness: \`${entry.readiness.missingComponentTypes.join(",") || "none"}\``,
    );
    lines.push(`- Stale Readiness: \`${entry.readiness.staleComponentTypes.join(",") || "none"}\``);
    lines.push(`- Secret Injection Ready: \`${entry.secretInjection.ready}\``);
    lines.push(`- Blockers: \`${entry.blockers.join(",") || "none"}\``);
    lines.push("");
  }

  // Add target release bundle info if available
  if (report.targetReleaseBundle != null) {
    lines.push("## Target Release Bundle");
    lines.push("");
    lines.push(`- Image Ref: \`${report.targetReleaseBundle.imageRef}\``);
    lines.push(`- Rollout Strategy: \`${report.targetReleaseBundle.rolloutStrategy}\``);
    lines.push("");
  }

  lines.push("## Recommended Commands", "");
  lines.push(...report.recommendedCommands.map((command) => `- \`${command}\``));
  return `${lines.join("\n")}\n`;
}

/**
 * EnvironmentDeploymentService builds deployment readiness matrices across all environments.
 * It evaluates configuration validity, readiness component status, secret injection readiness,
 * and identifies blockers that prevent deployment to each environment.
 */
export class EnvironmentDeploymentService {
  private readonly repoRootDir: string;
  private readonly configService: ConfigGovernanceService;
  private readonly releasePipelineService: ReleasePipelineService;
  private readonly artifactStore: ArtifactStore;
  private readonly readinessStaleThresholdMs: number;
  private readonly secretManagementService: SecretManagementService | null;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    options: EnvironmentDeploymentServiceOptions = {},
  ) {
    this.repoRootDir = resolve(options.repoRootDir ?? process.cwd());
    const configRootDir = resolve(options.configRootDir ?? join(this.repoRootDir, "config"));
    this.configService = new ConfigGovernanceService({
      configRoot: configRootDir,
      sandboxPolicy: createWorkspaceWritePolicy(configRootDir),
    });
    this.secretManagementService = options.secretManagementService ?? null;
    this.releasePipelineService = new ReleasePipelineService({
      store,
      repoRootDir: this.repoRootDir,
      configRootDir: join(configRootDir, "environments"),
      ...(this.secretManagementService == null ? {} : { secretManagementService: this.secretManagementService }),
      ...(options.artifactStoreOptions ? { artifactStoreOptions: options.artifactStoreOptions } : {}),
    });
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
    this.readinessStaleThresholdMs = options.readinessStaleThresholdMs ?? 24 * 60 * 60 * 1000;
  }

  /**
   * Builds a comprehensive environment deployment matrix report.
   * Evaluates all environments for deployment readiness and identifies blockers.
   */
  public async buildReport(input: EnvironmentDeploymentBuildInput = {}): Promise<EnvironmentDeploymentReport> {
    const generatedAt = assertIsoTimestamp(input.generatedAt ?? nowIso(), "environment_deployment.invalid_generated_at");

    // Load release configs and readiness records
    const releaseConfigs = new Map(
      this.releasePipelineService.listEnvironmentConfigs().map((item) => [item.environment, item] as const),
    );
    const readinessRecords = this.store.release.listEnvironmentReadinessRecords(undefined, { activeOnly: true, limit: 500 });
    const deploymentBindings = this.store.organization.listDeploymentBindings({ limit: 500 });

    // Build deployment entry for each environment in order
    const entries = await Promise.all(
      ENVIRONMENT_ORDER.map((environment, index) =>
        this.buildEntry({
          environment,
          order: index + 1,
          generatedAt,
          configBundle: this.configService.loadBundle(environment),
          releaseConfig: releaseConfigs.get(environment) ?? null,
          readinessRecords,
          deploymentBindings,
        }),
      ),
    );

    // Determine highest ready environment in the promotion chain
    const highestReadyEnvironment = this.resolveHighestReadyEnvironment(entries);
    const targetEnvironment = input.targetEnvironment ?? null;

    // Build promotion path: all environments up to and including target
    const promotionPath = targetEnvironment == null
      ? []
      : ENVIRONMENT_ORDER.filter((item) => item === targetEnvironment || this.compareEnvironment(item, targetEnvironment) < 0);

    // Find target entry and prerequisite blockers
    const targetEntry = targetEnvironment == null ? null : entries.find((item) => item.environment === targetEnvironment) ?? null;
    const prerequisiteBlockers = targetEnvironment == null ? [] : this.resolvePromotionPrerequisiteBlockers(entries, targetEnvironment);

    // Target is eligible only if ready and no blockers
    const targetEligible = targetEntry != null && targetEntry.deployReady && prerequisiteBlockers.length === 0;

    // Build release bundle for target if all conditions are met
    let targetReleaseBundle: ReleasePipelineBundle | null = null;
    if (targetEnvironment != null && input.version && input.commitSha && input.rolloutStrategy && targetEligible) {
      targetReleaseBundle = await this.releasePipelineService.buildBundle({
        environment: targetEnvironment,
        version: input.version,
        commitSha: input.commitSha,
        rolloutStrategy: input.rolloutStrategy,
        ...(input.taskId ? { taskId: input.taskId } : {}),
        generatedAt,
      });
    }

    // Build final report, adding prerequisite blockers to target entry
    return {
      reportId: newId("environment_deployment_report"),
      generatedAt,
      targetEnvironment,
      highestReadyEnvironment,
      targetEligible,
      promotionPath,
      entries: entries.map((entry) => {
        if (entry.environment !== targetEnvironment || prerequisiteBlockers.length === 0) {
          return entry;
        }
        return {
          ...entry,
          blockers: uniqueSorted([...entry.blockers, ...prerequisiteBlockers]),
          deployReady: false,
        };
      }),
      targetReleaseBundle,
      recommendedCommands: this.buildRecommendedCommands(targetEnvironment, targetReleaseBundle),
    };
  }

  /**
   * Exports the environment deployment report to artifact storage.
   */
  public async exportReport(input: EnvironmentDeploymentBuildInput = {}): Promise<EnvironmentDeploymentExportResult> {
    const report = await this.buildReport(input);
    const taskId = input.taskId ?? "environment_deployment";
    const suffix = report.targetEnvironment ?? "matrix";

    // Write JSON artifact for programmatic consumption
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "environment_deployment_report",
      fileName: `environment-deployment-${suffix}.json`,
      content: report,
    }).ref;

    // Write markdown artifact for human review
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "environment_deployment_report_markdown",
      fileName: `environment-deployment-${suffix}.md`,
      content: buildMarkdown(report),
      mimeType: "text/markdown",
    }).ref;

    return {
      report,
      jsonArtifact,
      markdownArtifact,
    };
  }

  /**
   * Builds a deployment entry for a single environment.
   * Evaluates configuration, readiness, secrets, and identifies blockers.
   */
  private async buildEntry(input: {
    environment: EnvironmentName;
    order: number;
    generatedAt: string;
    configBundle: ConfigBundle;
    releaseConfig: ReleaseEnvironmentConfig | null;
    readinessRecords: EnvironmentReadinessRecord[];
    deploymentBindings: DeploymentBindingRecord[];
  }): Promise<EnvironmentDeploymentEntry> {
    const requiredComponentTypes = [...DEFAULT_READINESS_REQUIREMENTS[toCanonicalEnvironmentName(input.environment)]];
    const scopedReadiness = input.readinessRecords.filter((item) => item.environment === input.environment);
    const missingComponentTypes: EnvironmentReadinessComponentType[] = [];
    const staleComponentTypes: EnvironmentReadinessComponentType[] = [];
    const blockedGateRefs: string[] = [];
    let readyCount = 0;

    // Evaluate each required readiness component
    for (const componentType of requiredComponentTypes) {
      const candidate = scopedReadiness.find((item) => item.componentType === componentType);
      if (candidate == null) {
        missingComponentTypes.push(componentType);
        continue;
      }

      // Parse and evaluate secondary gates
      const secondaryGates = parseSecondaryGates(candidate.secondaryGatesJson);
      const blockedGateKeys = Object.entries(secondaryGates)
        .filter(([, value]) => value !== true)
        .map(([key]) => `${componentType}:${candidate.componentId}:${key}`);

      // Check credential readiness and gate status
      if (candidate.credentialReady !== 1 || blockedGateKeys.length > 0) {
        blockedGateRefs.push(...blockedGateKeys.length > 0 ? blockedGateKeys : [`${componentType}:${candidate.componentId}:credential`]);
        continue;
      }

      // Check if readiness has gone stale
      if (this.isReadinessStale(candidate, input.generatedAt)) {
        staleComponentTypes.push(componentType);
        continue;
      }

      readyCount += 1;
    }

    // Evaluate deployment bindings
    const scopedBindings = input.deploymentBindings.filter((item) => item.environmentId === input.environment);
    const bindingCount = scopedBindings.length;

    // Build blockers list from various checks
    const blockers = [...input.configBundle.issues.map((issue) => `config:${issue}`)];
    blockers.push(...missingComponentTypes.map((item) => `readiness_missing:${item}`));
    blockers.push(...staleComponentTypes.map((item) => `readiness_stale:${item}`));
    blockers.push(...blockedGateRefs.map((item) => `readiness_gate_blocked:${item}`));

    // Deployment boundary environments require bindings
    if (DEPLOYMENT_BOUNDARY_ENVS.has(input.environment) && bindingCount === 0) {
      blockers.push("deployment_binding_missing");
    }

    // Release config is required for deployments
    if (input.releaseConfig == null) {
      blockers.push("release_config_missing");
    }

    // Check secret registration and resolution status
    const registrySecretDescription = input.releaseConfig?.registryCredentialRef != null && this.secretManagementService != null
      ? await this.tryDescribeSecret(input.releaseConfig.registryCredentialRef)
      : null;
    const deploymentSecretDescription = input.releaseConfig?.deploymentCredentialRef != null && this.secretManagementService != null
      ? await this.tryDescribeSecret(input.releaseConfig.deploymentCredentialRef)
      : null;

    const secretInjection = {
      configBundleRef: input.releaseConfig?.configBundleRef ?? null,
      registryCredentialRef: input.releaseConfig?.registryCredentialRef ?? null,
      deploymentCredentialRef: input.releaseConfig?.deploymentCredentialRef ?? null,
      registryCredentialRegistered: registrySecretDescription?.registered ?? this.secretManagementService == null,
      deploymentCredentialRegistered: deploymentSecretDescription?.registered ?? this.secretManagementService == null,
      registryCredentialResolved: registrySecretDescription?.resolved ?? false,
      deploymentCredentialResolved: deploymentSecretDescription?.resolved ?? false,
      ready:
        typeof input.releaseConfig?.configBundleRef === "string" &&
        input.releaseConfig.configBundleRef.trim().length > 0 &&
        typeof input.releaseConfig.registryCredentialRef === "string" &&
        input.releaseConfig.registryCredentialRef.trim().length > 0 &&
        typeof input.releaseConfig.deploymentCredentialRef === "string" &&
        input.releaseConfig.deploymentCredentialRef.trim().length > 0 &&
        (this.secretManagementService == null ||
          ((registrySecretDescription?.registered ?? false) &&
            (deploymentSecretDescription?.registered ?? false))),
    };

    // Add blockers for missing secret references
    if (input.releaseConfig != null) {
      if (secretInjection.configBundleRef == null || secretInjection.configBundleRef.trim().length === 0) {
        blockers.push("config_bundle_ref_missing");
      }
      if (secretInjection.registryCredentialRef == null || secretInjection.registryCredentialRef.trim().length === 0) {
        blockers.push("registry_credential_ref_missing");
      }
      if (secretInjection.deploymentCredentialRef == null || secretInjection.deploymentCredentialRef.trim().length === 0) {
        blockers.push("deployment_credential_ref_missing");
      }
      if (!secretInjection.registryCredentialRegistered) {
        blockers.push("registry_credential_unregistered");
      }
      if (!secretInjection.deploymentCredentialRegistered) {
        blockers.push("deployment_credential_unregistered");
      }
    }

    return {
      environment: input.environment,
      order: input.order,
      configVersionId: input.configBundle.version.versionId,
      configIssueCodes: [...input.configBundle.issues],
      configHighlights: {
        maxConcurrentTasks: this.readNumber(input.configBundle.layers.runtime?.maxConcurrentTasks),
        defaultTaskTimeoutMs: this.readNumber(input.configBundle.layers.runtime?.defaultTaskTimeoutMs),
        defaultStepTimeoutMs: this.readNumber(input.configBundle.layers.runtime?.defaultStepTimeoutMs),
        approvalMode: this.readString(input.configBundle.layers.security?.approvalMode),
        sandboxMode: this.readString(input.configBundle.layers.security?.sandboxMode),
      },
      releaseConfig: input.releaseConfig == null
        ? null
        : {
            clusterName: input.releaseConfig.clusterName,
            deploymentNamespace: input.releaseConfig.deploymentNamespace,
            allowedRolloutStrategies: [...input.releaseConfig.allowedRolloutStrategies],
          },
      readiness: {
        requiredComponentTypes,
        readyCount,
        missingComponentTypes,
        staleComponentTypes,
        blockedGateRefs: uniqueSorted(blockedGateRefs),
      },
      deployment: {
        bindingCount,
        deploymentModes: uniqueSorted(scopedBindings.map((item) => item.deploymentMode)) as DeploymentMode[],
        regions: uniqueSorted(scopedBindings.map((item) => item.region)),
        networkBoundaries: uniqueSorted(scopedBindings.map((item) => item.networkBoundary)),
      },
      secretInjection,
      deployReady: blockers.length === 0,
      blockers: uniqueSorted(blockers),
    };
  }

  /**
   * Finds the highest environment that is deploy-ready.
   * Walks through environments in order until one is not ready.
   */
  private resolveHighestReadyEnvironment(entries: EnvironmentDeploymentEntry[]): EnvironmentName | null {
    let highest: EnvironmentName | null = null;
    for (const environment of ENVIRONMENT_ORDER) {
      const entry = entries.find((item) => item.environment === environment);
      if (entry == null || !entry.deployReady) {
        break;
      }
      highest = environment;
    }
    return highest;
  }

  /**
   * Identifies blockers from prerequisite environments that are not ready.
   * A target cannot be deployed to if any earlier environment in the promotion
   * path is not deploy-ready.
   */
  private resolvePromotionPrerequisiteBlockers(
    entries: EnvironmentDeploymentEntry[],
    targetEnvironment: EnvironmentName,
  ): string[] {
    const blockers: string[] = [];
    for (const environment of ENVIRONMENT_ORDER) {
      if (environment === targetEnvironment) {
        break;
      }
      const entry = entries.find((item) => item.environment === environment);
      if (entry != null && !entry.deployReady) {
        blockers.push(`promotion_prerequisite_not_ready:${environment}`);
      }
    }
    return blockers;
  }

  /**
   * Builds recommended commands for interacting with the deployment.
   */
  private buildRecommendedCommands(
    targetEnvironment: EnvironmentName | null,
    targetReleaseBundle: ReleasePipelineBundle | null,
  ): string[] {
    const commands = [
      "npm run doctor",
      "npm run release-pipeline",
      "npm run environment-deployment",
    ];
    if (targetEnvironment != null) {
      commands.push(`AA_DEPLOYMENT_TARGET_ENVIRONMENT=${targetEnvironment} npm run environment-deployment`);
    }
    if (targetReleaseBundle != null) {
      commands.push(`docker build -t ${targetReleaseBundle.imageRef} .`);
      commands.push(...targetReleaseBundle.recommendedCommands);
    }
    return uniqueSorted(commands);
  }

  /**
   * Determines if a readiness record has gone stale based on time since last verification.
   */
  private isReadinessStale(record: EnvironmentReadinessRecord, generatedAt: string): boolean {
    const generatedTime = Date.parse(generatedAt);
    const lastVerifiedTime = Date.parse(record.lastVerifiedAt);
    if (Number.isNaN(generatedTime) || Number.isNaN(lastVerifiedTime)) {
      return true;
    }
    return generatedTime - lastVerifiedTime > this.readinessStaleThresholdMs;
  }

  /**
   * Safely extracts a finite number from an unknown value.
   */
  private readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  /**
   * Safely extracts a non-empty string from an unknown value.
   */
  private readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  /**
   * Compares two environments by their position in the promotion order.
   */
  private compareEnvironment(left: EnvironmentName, right: EnvironmentName): number {
    return ENVIRONMENT_ORDER.indexOf(left) - ENVIRONMENT_ORDER.indexOf(right);
  }

  /**
   * Attempts to describe a secret, returning null if it doesn't exist.
   * Used to check secret registration status without throwing.
   */
  private async tryDescribeSecret(secretRef: string): Promise<{ registered: boolean; resolved: boolean }> {
    if (this.secretManagementService == null) {
      return {
        registered: true,
        resolved: false,
      };
    }
    try {
      const description = await this.secretManagementService.describeSecret(secretRef);
      return {
        registered: true,
        resolved: description.metadata.resolved,
      };
    } catch (error) {
      // Return not registered for known missing/unavailable error codes
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("secret.registry_not_found:") || message.startsWith("secret.registry_unavailable:")) {
        return {
          registered: false,
          resolved: false,
        };
      }
      throw error;
    }
  }
}
