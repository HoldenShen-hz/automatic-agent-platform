// Ops Governance CLI Entry Point
// Provides health diagnostics, system reports, and operational governance oversight.
// Operates on a single database and produces structured reports for monitoring and auditing.

import { dirname } from "node:path";

import { withCliStorage } from "./authoritative-storage.js";
import { bootstrapGovernanceServicesWithMetrics } from "./governance-bootstrap.js";
import { loadOpsGovernanceCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import { OperationsGovernanceService, type OperationsGovernanceBuildInput } from "../../platform/control-plane/incident-control/operations-governance-service.js";
import type { EnvironmentName } from "../../platform/contracts/types/domain.js";

/**
 * Main entry point for the ops governance CLI.
 * Initializes storage, creates all required services, builds the governance report,
 * and outputs it as JSON to stdout. The report covers system health, diagnostics,
 * stalled executions, and storage quotas.
 */
function main(): void {
  const envConfig = loadOpsGovernanceCliEnv();
  const result = withCliStorage((storage) => {
    const { metrics, doctor, diagnostics } = bootstrapGovernanceServicesWithMetrics({
      storage,
      dbPath: envConfig.dbPath,
    });

    const service = envConfig.artifactRoot && envConfig.artifactRoot.length > 0
      ? new OperationsGovernanceService(storage.sql, metrics, doctor, diagnostics, {
        artifactStoreOptions: {
          rootDir: envConfig.artifactRoot,
          sandboxPolicy: createWorkspaceWritePolicy(dirname(envConfig.artifactRoot)),
        },
      })
      : new OperationsGovernanceService(storage.sql, metrics, doctor, diagnostics);

    const buildInput: OperationsGovernanceBuildInput = {
      environment: (envConfig.environment ?? "dev") as EnvironmentName,
      ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
      ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
    };

    return envConfig.action === "export"
      ? service.exportReport(buildInput)
      : service.buildReport(buildInput);
  }, { dbPath: envConfig.dbPath });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
