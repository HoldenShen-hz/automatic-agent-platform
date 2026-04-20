/**
 * Platform Operator CLI
 *
 * This module provides the command-line entry point for the Platform Operator service.
 * It manages platform-level operations including evidence collection, package generation,
 * and status management for the Automatic Agent system.
 *
 * Environment Variables (via loadPlatformOperatorCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENVIRONMENT: The environment name
 *   - AA_PLATFORM_OPERATOR_ACTION: Action to perform (summary, export)
 *   - AA_ARTIFACT_ROOT: Root directory for artifact storage
 *   - AA_EVIDENCE_ROOT_DIR: Root directory for evidence files
 *   - AA_PACKAGE_OUTPUT_DIR: Output directory for generated packages
 *   - AA_TARGET_STATUS: Target status for operations
 *   - AA_GENERATED_AT: Optional generation timestamp
 *
 * Actions:
 *   - summary: Build and return a platform operator report (default)
 *   - export: Export the platform operator report
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import { dirname } from "node:path";

import { withCliStorage } from "./authoritative-storage.js";
import { loadPlatformOperatorCliEnv } from "../../platform/control-plane/config-center/operations-cli-env.js";
import { PlatformOperatorService } from "../../scale-ecosystem/marketplace/platform-operator-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

const envConfig = loadPlatformOperatorCliEnv();
const environment = envConfig.environment;
const action = envConfig.action;
const result = withCliStorage((storage) => {
  const artifactRoot = envConfig.artifactRoot;
  const service = artifactRoot == null || artifactRoot.length === 0
    ? new PlatformOperatorService(storage.sql, storage.store)
    : new PlatformOperatorService(storage.sql, storage.store, {
      artifactStoreOptions: {
        rootDir: artifactRoot,
        sandboxPolicy: createWorkspaceWritePolicy(dirname(artifactRoot)),
      },
    });

  const input = {
    environment,
    evidenceRootDir: envConfig.evidenceRootDir,
    packageOutputDir: envConfig.outputDir,
    targetStatus: envConfig.targetStatus,
    ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
  };

  return action === "export" ? service.exportReport(input) : service.buildReport(input);
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
