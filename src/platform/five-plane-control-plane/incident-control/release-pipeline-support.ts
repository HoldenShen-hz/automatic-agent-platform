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

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type ArtifactStoreOptions } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { ValidationError } from "../../contracts/errors.js";
export { extractWorkflowDispatchReceipt } from "./workflow-dispatch-receipt.js";
import { SecretManagementService, type ManagedSecretMetadata } from "../iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type {
  ArtifactRef,
  EnvironmentName,
  SecretLeaseStatus,
} from "../../contracts/types/domain.js";

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
  timeoutMs?: number;
}

/**
 * Interface for running release pipeline commands.
 * Allows mocking or alternative command execution strategies.
 */
export interface ReleasePipelineCommandRunner {
  run(request: ReleasePipelineCommandRequest): Promise<ReleasePipelineCommandResult>;
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

function resolveDefaultRepoRoot(): string {
  const startDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    join(process.cwd(), ".."),
    join(startDir, "../../../../.."),
    join(startDir, "../../../../../.."),
  ];
  return candidates.find((candidate) => existsSync(join(candidate, "config", "environments"))) ?? candidates[0]!;
}

export const DEFAULT_REPO_ROOT = resolveDefaultRepoRoot();
export const DEFAULT_CONFIG_ROOT = join(DEFAULT_REPO_ROOT, "config", "environments");
const MAX_CAPTURED_COMMAND_OUTPUT_BYTES = 64 * 1024;
const ALLOWED_RELEASE_PIPELINE_COMMANDS: Readonly<Record<ReleasePipelineCommandRequest["step"], readonly string[]>> = {
  build_image: ["docker"],
  publish_workflow: ["gh"],
};

// Environments where secret rotation must be completed before deployment
export const ROTATION_GUARDED_ENVIRONMENTS = new Set<EnvironmentName>(["staging", "pre-prod", "prod"]);

/**
 * Default command runner that executes commands locally via spawn.
 * Captures stdout/stderr and timing information for reporting.
 */
export class LocalReleasePipelineCommandRunner implements ReleasePipelineCommandRunner {
  public async run(request: ReleasePipelineCommandRequest): Promise<ReleasePipelineCommandResult> {
    assertAllowedReleasePipelineCommand(request);
    const startedAt = Date.now();
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: ["ignore", "pipe", "pipe"] as const,
    });
    const stdout = createBoundedOutputBuffer();
    const stderr = createBoundedOutputBuffer();
    child.stdout?.on("data", (chunk) => { stdout.push(chunk); });
    child.stderr?.on("data", (chunk) => { stderr.push(chunk); });

    const timeoutMs = request.timeoutMs ?? 5 * 60 * 1000;
    let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    timeoutHandle.unref?.();

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    }).finally(() => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    });
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      durationMs: Date.now() - startedAt,
    };
  }
}

function assertAllowedReleasePipelineCommand(request: ReleasePipelineCommandRequest): void {
  const allowedCommands = ALLOWED_RELEASE_PIPELINE_COMMANDS[request.step];
  if (allowedCommands.includes(request.command)) {
    return;
  }
  throw new ValidationError(
    `release.command_not_allowed:${request.step}:${request.command}`,
    `release.command_not_allowed:${request.step}:${request.command}`,
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

function createBoundedOutputBuffer(maxBytes = MAX_CAPTURED_COMMAND_OUTPUT_BYTES): {
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
 * Validates and normalizes a semantic version string.
 * Accepts versions with or without 'v' prefix.
 * Throws ValidationError if the version format is invalid.
 */
export function sanitizeVersion(version: string): string {
  const normalized = version.trim();
  if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(normalized)) {
    const code = `release.invalid_version:${version}`;
    throw new ValidationError(code, code, {
      retryable: false,
      details: { version },
    });
  }
  return normalized.startsWith("v") ? normalized : `v${normalized}`;
}

/**
 * Validates and normalizes a git commit SHA.
 * Must be 7-40 hex characters.
 */
export function sanitizeCommitSha(commitSha: string): string {
  const normalized = commitSha.trim();
  if (!/^[a-f0-9]{7,40}$/i.test(normalized)) {
    const code = `release.invalid_commit_sha:${commitSha}`;
    throw new ValidationError(code, code, {
      retryable: false,
      details: { commitSha },
    });
  }
  return normalized.toLowerCase();
}

/**
 * Validates and normalizes a container registry URL.
 */
export function sanitizeRegistry(registry: string): string {
  const normalized = registry.trim().replace(/\/+$/, "");
  if (!/^[a-z0-9.-]+(?:\/[a-z0-9._/-]+)?$/i.test(normalized)) {
    const code = `release.invalid_registry:${registry}`;
    throw new ValidationError(code, code, {
      retryable: false,
      details: { registry },
    });
  }
  return normalized;
}

/**
 * Validates and normalizes an image repository path.
 */
export function sanitizeImageRepository(imageRepository: string): string {
  const normalized = imageRepository.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!/^[a-z0-9._/-]+$/i.test(normalized)) {
    const code = `release.invalid_image_repository:${imageRepository}`;
    throw new ValidationError(code, code, {
      retryable: false,
      details: { imageRepository },
    });
  }
  return normalized;
}

/**
 * Validates a secret reference URI format.
 */
export function sanitizeSecretRef(secretRef: string, code: string): string {
  const normalized = secretRef.trim();
  if (!/^secret:\/\/[a-z0-9._/-]+$/i.test(normalized)) {
    const detailedCode = `${code}:${secretRef}`;
    throw new ValidationError(detailedCode, detailedCode, {
      retryable: false,
      details: { secretRef },
    });
  }
  return normalized;
}

/**
 * Validates a config bundle reference URI format.
 */
export function sanitizeConfigBundleRef(configBundleRef: string): string {
  const normalized = configBundleRef.trim();
  if (!/^config-bundle:\/\/[a-z0-9._/-]+$/i.test(normalized)) {
    const code = `release.invalid_config_bundle_ref:${configBundleRef}`;
    throw new ValidationError(code, code, {
      retryable: false,
      details: { configBundleRef },
    });
  }
  return normalized;
}

/**
 * Builds a markdown representation of a release bundle for human review.
 */
export function buildMarkdown(bundle: ReleasePipelineBundle): string {
  return [
    "# Release Pipeline Bundle",
    "",
    `- Bundle ID: \`${bundle.bundleId}\``,
    `- Environment: \`${bundle.environment}\``,
    `- Version: \`${bundle.version}\``,
    `- Commit SHA: \`${bundle.commitSha}\``,
    `- Image Ref: \`${bundle.imageRef}\``,
    `- Rollout Strategy: \`${bundle.rolloutStrategy}\``,
    `- Cluster: \`${bundle.clusterName}\``,
    `- Namespace: \`${bundle.deploymentNamespace}\``,
    `- Config Path: \`${bundle.configPath}\``,
    "",
    "## Required Readiness Checks",
    "",
    ...bundle.requiredReadinessChecks.map((item) => `- \`${item}\``),
    "",
    "## Recommended Commands",
    "",
    ...bundle.recommendedCommands.map((item) => `- \`${item}\``),
  ].join("\n");
}

/**
 * Builds a markdown representation of a release pipeline execution report.
 */
export function buildExecutionMarkdown(report: ReleasePipelineExecutionReport): string {
  return [
    "# Release Pipeline Execution Report",
    "",
    `- Execution ID: \`${report.executionId}\``,
    `- Bundle ID: \`${report.bundleId}\``,
    `- Environment: \`${report.environment}\``,
    `- Version: \`${report.version}\``,
    `- Commit SHA: \`${report.commitSha}\``,
    `- Image Ref: \`${report.imageRef}\``,
    `- Execution Mode: \`${report.executionMode}\``,
    `- Registry Secret Ref: \`${report.registrySecret.secretRef}\``,
    `- Registry Secret Access: \`${report.registrySecret.accessMode}\`${report.registrySecret.leaseId == null ? "" : ` lease=\`${report.registrySecret.leaseId}\``}`,
    `- Publish Workflow Run: \`${report.publishWorkflowRunId ?? "pending"}\`${report.publishWorkflowRunUrl == null ? "" : ` url=\`${report.publishWorkflowRunUrl}\``}`,
    "",
    "## Commands",
    "",
    `- Build: \`${report.buildCommand}\``,
    `- Publish: \`${report.publishCommand}\``,
    "",
    "## Command Results",
    "",
    ...report.commandResults.map(
      (result) => `- \`${result.step}\`: exit=${result.exitCode}, executed=${result.executed}, durationMs=${result.durationMs}`,
    ),
  ].join("\n");
}

/**
 * ReleasePipelineService manages the build, publish, and deploy lifecycle.
 * It constructs release bundles with validated metadata, manages secret leases,
 * and executes GitHub Actions workflows for CI/CD integration.
 */
