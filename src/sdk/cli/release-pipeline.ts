/**
 * Release Pipeline CLI Tool
 *
 * This module provides a command-line interface for managing release pipelines
 * and deployments. It supports listing environment configurations, building
 * release bundles, exporting bundles, and executing deployments with optional
 * artifact store integration.
 *
 * Usage:
 *   npm run release-pipeline list                    # List environment configs
 *   npm run release-pipeline build                   # Build release bundle
 *   npm run release-pipeline export                   # Export release bundle
 *   npm run release-pipeline execute                 # Execute deployment
 *
 * Environment Variables:
 *   - AA_DB_PATH: Optional database path for persistent storage
 *   - AA_RELEASE_ACTION: "list", "build", "export", or "execute"
 *   - AA_RELEASE_ENVIRONMENT: Target environment name
 *   - AA_RELEASE_VERSION: Release version string
 *   - AA_RELEASE_COMMIT_SHA: Git commit SHA
 *   - AA_RELEASE_ROLLOUT_STRATEGY: "rolling", "canary", or "blue_green"
 *   - AA_Runner_MODE: "simulate" for mock command execution
 *
 * @see {@link docs_zh/operations/} - Operational procedures
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Release pipeline terminology
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */

import { dirname, join } from "node:path";

import { assertCliAuthoritativeStorageExecutable, resolveCliDbPath, withCliStorageAsync } from "./authoritative-storage.js";
import {
  DeploymentExecutionService,
  type DeploymentCommandRequest,
  type DeploymentCommandResult,
} from "../../platform/five-plane-control-plane/incident-control/deployment-execution-service.js";
import {
  ReleasePipelineService,
  type ReleasePipelineCommandRequest,
  type ReleasePipelineCommandResult,
} from "../../platform/five-plane-control-plane/incident-control/release-pipeline-service.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { createWorkspaceWritePolicy } from "../../platform/five-plane-control-plane/iam/sandbox-policy.js";
import { SecretManagementService } from "../../platform/five-plane-control-plane/iam/secret-management-service.js";
import type { EnvironmentName } from "../../platform/contracts/types/domain.js";
import { loadReleasePipelineCliEnv } from "../../platform/five-plane-control-plane/config-center/release-pipeline-env.js";

/**
 * Retrieves a required environment variable value mapped from CLI config.
 *
 * @param name - The name of the environment variable to retrieve
 * @returns The non-empty string value of the environment variable
 * @throws Error if the environment variable is not set or empty
 */
function requiredEnv(name: string): string {
  const envConfig = loadReleasePipelineCliEnv();
  const mapping: Record<string, string | null> = {
    AA_RELEASE_ENVIRONMENT: envConfig.environment,
    AA_RELEASE_VERSION: envConfig.version,
    AA_RELEASE_COMMIT_SHA: envConfig.commitSha,
    AA_RELEASE_ROLLOUT_STRATEGY: envConfig.rolloutStrategy,
  };
  const value = mapping[name];
  if (value == null || value.trim().length === 0) {
    throw new ValidationError(`release.missing_env:${name}`, `release.missing_env:${name}`);
  }
  return value;
}

/**
 * Simulated command runner for release pipeline operations.
 *
 * Returns mock results for release pipeline commands without actually
 * executing them. Used when runner mode is set to "simulate".
 */
class SimulatedReleasePipelineCommandRunner {
  public async run(request: ReleasePipelineCommandRequest): Promise<ReleasePipelineCommandResult> {
    const runId = request.step === "publish_workflow" ? "700000001" : null;
    const stdout = request.step === "publish_workflow"
      ? `Created workflow_dispatch event\nhttps://github.com/automatic-agent/automatic-agent-platform/actions/runs/${runId}`
      : `simulated:${request.step}`;
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode: 0,
      stdout,
      stderr: "",
      durationMs: 1,
    };
  }
}

/**
 * Simulated command runner for deployment operations.
 *
 * Returns mock results for deployment commands without actually
 * executing them. Used when runner mode is set to "simulate".
 */
class SimulatedDeploymentCommandRunner {
  public async run(request: DeploymentCommandRequest): Promise<DeploymentCommandResult> {
    const runId = request.step === "publish" ? "700000002" : "700000003";
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode: 0,
      stdout: `Created workflow_dispatch event\nhttps://github.com/automatic-agent/automatic-agent-platform/actions/runs/${runId}`,
      stderr: "",
      durationMs: 1,
    };
  }
}

const repoRoot = process.cwd();
const envConfig = loadReleasePipelineCliEnv();
const action = envConfig.action;
const dbPath = envConfig.dbPath;
const runnerMode = envConfig.runnerMode;
const triggerDeploy = envConfig.triggerDeploy;
const artifactStoreOptions = {
  rootDir: join(repoRoot, "data", "artifacts"),
  sandboxPolicy: createWorkspaceWritePolicy(dirname(join(repoRoot, "data", "artifacts"))),
};

if (dbPath == null || dbPath.length === 0) {
  assertCliAuthoritativeStorageExecutable(resolveCliDbPath());
  if (action === "execute") {
    throw new ValidationError("release.db_path_required_for_execute", "release.db_path_required_for_execute");
  }
  const service = new ReleasePipelineService({
    repoRootDir: repoRoot,
    artifactStoreOptions,
    ...(runnerMode === "simulate" ? { commandRunner: new SimulatedReleasePipelineCommandRunner() } : {}),
  });

  if (action === "list") {
    process.stdout.write(`${JSON.stringify(service.listEnvironmentConfigs(), null, 2)}\n`);
  } else {
      const input = {
      environment: requiredEnv("AA_RELEASE_ENVIRONMENT") as EnvironmentName,
      version: requiredEnv("AA_RELEASE_VERSION"),
      commitSha: requiredEnv("AA_RELEASE_COMMIT_SHA"),
      rolloutStrategy: requiredEnv("AA_RELEASE_ROLLOUT_STRATEGY") as "rolling" | "canary" | "blue_green",
      ...(envConfig.registry ? { registry: envConfig.registry } : {}),
      ...(envConfig.imageRepository
        ? { imageRepository: envConfig.imageRepository }
        : {}),
      ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
    };

    const result = action === "export"
      ? await service.exportBundle(input)
      : await service.buildBundle(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} else {
  const result = await withCliStorageAsync(async (storage) => {
    const db = storage.sql;
    const store = storage.store;
    const secretManagementService = new SecretManagementService(db, store);
    const service = new ReleasePipelineService({
      repoRootDir: repoRoot,
      artifactStoreOptions,
      secretManagementService,
      store,
      ...(runnerMode === "simulate" ? { commandRunner: new SimulatedReleasePipelineCommandRunner() } : {}),
    });

    if (action === "list") {
      return service.listEnvironmentConfigs();
    }

    const input = {
      environment: requiredEnv("AA_RELEASE_ENVIRONMENT") as EnvironmentName,
      version: requiredEnv("AA_RELEASE_VERSION"),
      commitSha: requiredEnv("AA_RELEASE_COMMIT_SHA"),
      rolloutStrategy: requiredEnv("AA_RELEASE_ROLLOUT_STRATEGY") as "rolling" | "canary" | "blue_green",
      ...(envConfig.registry ? { registry: envConfig.registry } : {}),
      ...(envConfig.imageRepository ? { imageRepository: envConfig.imageRepository } : {}),
      ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
    };

    if (action === "export") {
      return service.exportBundle(input);
    }
    if (action === "execute") {
      const release = await service.executeAndExport(input);
      if (!triggerDeploy) {
        return release;
      }
      const deploymentService = new DeploymentExecutionService(store, {
        repoRootDir: repoRoot,
        artifactStoreOptions,
        secretManagementService,
        ...(runnerMode === "simulate" ? { commandRunner: new SimulatedDeploymentCommandRunner() } : {}),
      });
      const deployment = await deploymentService.exportReport({
        ...input,
        execute: true,
      });
      return { release, deployment };
    }
    return service.buildBundle(input);
  }, { dbPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
