/**
 * Dispatch Reconciliation CLI Tool
 *
 * This module provides a command-line interface for reconciling execution dispatch
 * state. It scans for inconsistencies between dispatch records and actual worker
 * lease state, and optionally repairs them.
 *
 * Usage: npm run dispatch-reconcile
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution
 * @see {@link docs_zh/contracts/task_lease_and_fencing_contract.md} - Lease reconciliation
 * @see {@link docs_zh/contracts/idempotency_and_recovery_matrix_contract.md} - Idempotency and recovery
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
import { withCliStorage } from "./authoritative-storage.js";
import { loadDispatchReconcileCliEnv } from "../../platform/control-plane/config-center/ops-cli-env.js";
import { ExecutionDispatchReconciliationService } from "../../platform/execution/dispatcher/execution-dispatch-reconciliation-service.js";

/**
 * Main entry point for the dispatch reconciliation CLI.
 *
 * Initializes the database and reconciliation service, then either scans for
 * dispatch inconsistencies (default) or repairs them if AA_DISPATCH_RECONCILE_ACTION
 * is set to "repair". Outputs scan results or applied repairs as formatted JSON
 * and ensures the database connection is properly closed.
 */
function main(): void {
  const envConfig = loadDispatchReconcileCliEnv();
  const output = withCliStorage((storage) => {
    const reconcile = new ExecutionDispatchReconciliationService(storage.sql, storage.store);
    return envConfig.action === "repair"
      ? reconcile.repair(envConfig.occurredAt ?? undefined)
      : {
          issues: reconcile.scan(envConfig.occurredAt ?? undefined),
        };
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
