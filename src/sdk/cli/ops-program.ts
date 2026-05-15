/**
 * Operations Program CLI
 *
 * This module provides the command-line entry point for the Operations Program service.
 * It runs operational diagnostics, health checks, and governance reporting for the
 * Automatic Agent system. It orchestrates multiple services including health monitoring,
 * diagnostics, doctor checks, and observability retention management.
 *
 * Environment Variables (via loadOpsProgramCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENVIRONMENT: The environment name (development, staging, production)
 *   - AA_OPS_PROGRAM_ACTION: Action to perform (summary, export)
 *   - AA_OPS_PROGRAM_ARTIFACT_ROOT: Root directory for artifact storage
 *
 * Actions:
 *   - summary: Build and return an operational report
 *   - export: Export the operational report
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import { withCliStorage } from "./authoritative-storage.js";
import { bootstrapGovernanceServicesWithMetrics } from "./governance-bootstrap.js";
import { loadOpsProgramCliEnv } from "../../platform/five-plane-control-plane/config-center/operations-cli-env.js";
import { createWorkspaceWritePolicy } from "../../platform/five-plane-control-plane/iam/sandbox-policy.js";
import { IndustrialOpsProgramService, type IndustrialOpsProgramInput } from "../../platform/five-plane-control-plane/incident-control/industrial-ops-program-service.js";
import { OperationsGovernanceService } from "../../platform/five-plane-control-plane/incident-control/operations-governance-service.js";
import type { EnvironmentName } from "../../platform/contracts/types/domain.js";

/**
 * Main entry point for the operations program CLI.
 * Initializes storage, creates governance services, builds the operational report,
 * and outputs it as JSON to stdout.
 */
function main(): void {
  const envConfig = loadOpsProgramCliEnv();
  const dbPath = envConfig.dbPath;

  const result = withCliStorage((storage) => {
    const { metrics, doctor, diagnostics, workspaceRoot } = bootstrapGovernanceServicesWithMetrics({
      storage,
      dbPath,
    });

    const governance = new OperationsGovernanceService(storage.sql, metrics, doctor, diagnostics);
    const artifactRoot = envConfig.artifactRoot;

    const service = artifactRoot
      ? new IndustrialOpsProgramService(governance, {
        artifactStoreOptions: {
          rootDir: artifactRoot,
          sandboxPolicy: createWorkspaceWritePolicy(workspaceRoot),
        },
      })
      : new IndustrialOpsProgramService(governance);

    const input: IndustrialOpsProgramInput = {
      environment: (envConfig.environment ?? "dev") as EnvironmentName,
      ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
      ...(envConfig.shiftOwner ? { shiftOwner: envConfig.shiftOwner } : {}),
    };

    return envConfig.action === "export" ? service.exportReport(input) : service.buildReport(input);
  }, { dbPath });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
