/**
 * Enterprise Governance CLI
 *
 * This module provides a command-line interface for enterprise governance oversight,
 * including dependency manifest tracking, health monitoring, diagnostics, and
 * operational status reporting across enterprise deployments.
 *
 * Environment Variables (via loadEnterpriseGovernanceCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENTERPRISE_GOVERNANCE_ACTION: Action to perform - "build_report" (default) or "export"
 *   - AA_ENVIRONMENT: Target environment (dev, staging, prod)
 *   - AA_ARTIFACT_ROOT: Optional root directory for artifact storage
 *   - AA_TASK_ID: Optional task identifier for report filtering
 *   - AA_SHIFT_OWNER: Optional shift owner for operations
 *   - AA_DEPENDENCY_MANIFEST_PATH: Optional path to dependency manifest
 *   - AA_DEPENDENCY_LOCKFILE_PATH: Optional path to dependency lockfile
 *
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for governance architecture
 * @see {@link docs_zh/contracts/enterprise_governance_contract.md} for governance contracts
 */

import { withCliStorage } from "./authoritative-storage.js";
import { bootstrapGovernanceServicesWithMetrics } from "./governance-bootstrap.js";
import { loadEnterpriseGovernanceCliEnv } from "../../platform/control-plane/config-center/operations-cli-env.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import { EnterpriseGovernanceService } from "../../platform/control-plane/incident-control/enterprise-governance-service.js";
import { OperationsGovernanceService } from "../../platform/control-plane/incident-control/operations-governance-service.js";

/**
 * Main entry point for the enterprise governance CLI.
 * Initializes storage, creates governance services, builds the enterprise governance report,
 * and outputs it as JSON. Supports optional artifact store for report export.
 */
function main(): void {
  const envConfig = loadEnterpriseGovernanceCliEnv();
  const dbPath = envConfig.dbPath;

  const result = withCliStorage((storage) => {
    const { metrics, doctor, diagnostics, workspaceRoot } = bootstrapGovernanceServicesWithMetrics({
      storage,
      dbPath,
    });

    // Initialize operations governance with metrics and diagnostics
    const governance = new OperationsGovernanceService(storage.sql, metrics, doctor, diagnostics);

    // Initialize enterprise governance service with optional artifact store
    // Note: workspaceRoot is derived inside bootstrapGovernanceServicesWithMetrics
    const service = envConfig.artifactRoot
      ? new EnterpriseGovernanceService(governance, storage.store, {
        artifactStoreOptions: {
          rootDir: envConfig.artifactRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspaceRoot),
        },
      })
      : new EnterpriseGovernanceService(governance, storage.store);

    // Build governance report input with optional filtering parameters
    const input = {
      environment: envConfig.environment,
      ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
      ...(envConfig.shiftOwner ? { shiftOwner: envConfig.shiftOwner } : {}),
      ...(envConfig.dependencyManifestPath ? { dependencyManifestPath: envConfig.dependencyManifestPath } : {}),
      ...(envConfig.dependencyLockfilePath ? { dependencyLockfilePath: envConfig.dependencyLockfilePath } : {}),
    };

    return envConfig.action === "export" ? service.exportReport(input) : service.buildReport(input);
  }, { dbPath });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
