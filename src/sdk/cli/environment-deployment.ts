/**
 * Environment Deployment CLI
 *
 * This module provides a command-line interface for environment deployment operations
 * including listing available configuration bundles, building deployment reports, and
 * exporting deployment configurations. It supports multiple deployment environments
 * (dev, test, staging, pre-prod, prod) with optional artifact store integration.
 *
 * Environment Variables (via loadEnvironmentDeploymentCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENVIRONMENT_DEPLOYMENT_ACTION: Action to perform - list-bundles, build, export
 *   - AA_REPO_ROOT_DIR: Root directory of the repository
 *   - AA_TARGET_ENVIRONMENT: Target environment name
 *   - AA_VERSION: Deployment version string
 *   - AA_COMMIT_SHA: Git commit SHA
 *   - AA_ROLLOUT_STRATEGY: Deployment rollout strategy
 *   - AA_ARTIFACT_ROOT: Optional root directory for artifact storage
 *   - AA_GENERATED_AT: Optional generation timestamp
 *   - AA_TASK_ID: Optional task identifier
 *
 * Actions:
 *   - list-bundles: List available environment configuration bundles
 *   - build: Build deployment report for target environment
 *   - export: Export deployment configuration with evidence
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for deployment architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for deployment terminology
 */

import { dirname, join } from "node:path";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadEnvironmentDeploymentCliEnv } from "../../platform/control-plane/config-center/operations-cli-env.js";
import { ConfigGovernanceService } from "../../platform/control-plane/config-center/config-governance-service.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { EnvironmentDeploymentService } from "../../platform/control-plane/incident-control/environment-deployment-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import { SecretManagementService } from "../../platform/control-plane/iam/secret-management-service.js";

const envConfig = loadEnvironmentDeploymentCliEnv();
const action = envConfig.action;
const repoRootDir = envConfig.repoRootDir;

// Dispatch based on action: list-bundles returns configs, build/export require database
if (action === "list-bundles") {
  // List available environment configuration bundles from the config governance service
  const configRoot = join(repoRootDir, "config");
  const governance = new ConfigGovernanceService({
    configRoot,
    sandboxPolicy: createWorkspaceWritePolicy(configRoot),
  });
  const result = {
    // Load configuration bundles for all standard environments
    environments: ["dev", "test", "staging", "pre-prod", "prod"].map((environment) => governance.loadBundle(environment)),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  // Build or export deployment report - requires database access
  const dbPath = envConfig.dbPath ?? (() => { throw new ValidationError("missing_env:AA_DB_PATH", "missing_env:AA_DB_PATH"); })();
  const result = await withCliStorageAsync(async (storage) => {
    const secretManagementService = new SecretManagementService(storage.sql, storage.store);
    const artifactRoot = envConfig.artifactRoot;

    const service = artifactRoot == null || artifactRoot.length === 0
      ? new EnvironmentDeploymentService(storage.store, {
          repoRootDir,
          secretManagementService,
        })
      : new EnvironmentDeploymentService(storage.store, {
          repoRootDir,
          secretManagementService,
          artifactStoreOptions: {
            rootDir: artifactRoot,
            sandboxPolicy: createWorkspaceWritePolicy(dirname(artifactRoot)),
          },
        });

    const input = {
      ...(envConfig.targetEnvironment ? { targetEnvironment: envConfig.targetEnvironment } : {}),
      ...(envConfig.version ? { version: envConfig.version } : {}),
      ...(envConfig.commitSha ? { commitSha: envConfig.commitSha } : {}),
      ...(envConfig.rolloutStrategy ? { rolloutStrategy: envConfig.rolloutStrategy } : {}),
      ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
      ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
    };

    return action === "export"
      ? await service.exportReport(input)
      : await service.buildReport(input);
  }, { dbPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
