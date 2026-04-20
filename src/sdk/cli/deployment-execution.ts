/**
 * Deployment Execution CLI
 *
 * This module provides a command-line interface for managing deployment workflows,
 * including publish, promote, and rollback operations. It supports both real execution
 * (via GitHub Actions) and simulation modes for testing.
 *
 * Environment Variables (via loadDeploymentExecutionCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_DEPLOYMENT_EXECUTION_ACTION: Action to perform - "build_report" (default) or "export"
 *   - AA_DEPLOYMENT_ENVIRONMENT: Target environment (dev, staging, prod)
 *   - AA_DEPLOYMENT_VERSION: Version identifier to deploy
 *   - AA_DEPLOYMENT_COMMIT_SHA: Git commit SHA to deploy
 *   - AA_DEPLOYMENT_ROLLOUT_STRATEGY: Strategy for rollout (rolling, canary, blue_green)
 *   - AA_DEPLOYMENT_REPO_ROOT_DIR: Repository root directory
 *   - AA_DEPLOYMENT_ARTIFACT_ROOT: Root directory for artifact storage
 *   - AA_DEPLOYMENT_RUNNER_MODE: "execute" for real execution, "simulate" for mock responses
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for deployment architecture
 * @see {@link docs_zh/contracts/release_rollout_and_rollback_contract.md} for deployment contracts
 */

import { dirname } from "node:path";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadDeploymentExecutionCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { DeploymentExecutionService, type DeploymentCommandRequest, type DeploymentCommandResult } from "../../platform/control-plane/incident-control/deployment-execution-service.js";
import { EnvSecretProvider } from "../../platform/control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../platform/control-plane/iam/secret-management-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

/**
 * Simulated deployment command runner for testing without actual GitHub Actions.
 *
 * In simulation mode, this returns mock workflow dispatch URLs instead of
 * calling real GitHub Actions APIs, allowing testing of deployment logic.
 */
class SimulatedDeploymentCommandRunner {
  public run(request: DeploymentCommandRequest): DeploymentCommandResult {
    // Generate a fake run ID based on the deployment step
    const runId = request.step === "publish" ? "710000001" : "710000002";
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

const envConfig = loadDeploymentExecutionCliEnv();
const result = await withCliStorageAsync(async (storage) => {
  const secretManagementService = new SecretManagementService(storage.sql, storage.store);
  const service = new DeploymentExecutionService(storage.store, {
    repoRootDir: envConfig.repoRootDir,
    artifactStoreOptions: {
      rootDir: envConfig.artifactRoot,
      sandboxPolicy: createWorkspaceWritePolicy(dirname(envConfig.artifactRoot)),
    },
    secretProvider: new EnvSecretProvider(),
    secretManagementService,
    ...(envConfig.runnerMode === "simulate" ? { commandRunner: new SimulatedDeploymentCommandRunner() } : {}),
  });

  const input = {
    environment: envConfig.environment,
    version: envConfig.version,
    commitSha: envConfig.commitSha,
    rolloutStrategy: envConfig.rolloutStrategy,
    ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
    ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
    ...(envConfig.execute ? { execute: true } : {}),
  };

  return envConfig.action === "export"
    ? await service.exportReport(input)
    : await service.buildReport(input);
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
