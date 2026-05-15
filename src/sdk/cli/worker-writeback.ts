/**
 * Worker Writeback CLI Tool
 *
 * This module provides a command-line interface for workers to record execution
 * results back to the runtime. It handles terminal status updates, output capture,
 * and fencing token validation.
 *
 * Usage: npm run worker-writeback
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution writeback
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md} - State transitions
 * @see {@link docs_zh/contracts/task_lease_and_fencing_contract.md} - Lease and fencing
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
import { loadWorkerWritebackCliEnv } from "../../platform/five-plane-control-plane/config-center/runtime-ops-env.js";
import { ExecutionWorkerWritebackService } from "../../platform/five-plane-execution/worker-pool/execution-worker-writeback-service.js";
import { withCliStorage } from "./authoritative-storage.js";

/**
 * Main entry point for the worker writeback CLI.
 *
 * Loads worker writeback configuration from environment variables, initializes
 * the database and writeback service, then records the execution writeback
 * (terminal status, output, and resource metrics). Outputs the writeback
 * result as formatted JSON and ensures the database connection is properly
 * closed before exiting.
 */
function main(): void {
  const envConfig = loadWorkerWritebackCliEnv();
  const output = withCliStorage((storage) => {
    const writeback = new ExecutionWorkerWritebackService(storage.sql, storage.store);
    return writeback.recordWriteback({
      executionId: envConfig.executionId,
      workerId: envConfig.workerId,
      leaseId: envConfig.leaseId,
      fencingToken: envConfig.fencingToken,
      ...(envConfig.runtimeInstanceId !== undefined ? { runtimeInstanceId: envConfig.runtimeInstanceId } : {}),
      ...(envConfig.restartedFromRuntimeInstanceId !== undefined
        ? { restartedFromRuntimeInstanceId: envConfig.restartedFromRuntimeInstanceId }
        : {}),
      terminalStatus: envConfig.terminalStatus,
      ...(envConfig.lastToolName !== undefined ? { lastToolName: envConfig.lastToolName } : {}),
      ...(envConfig.toolCallCount !== undefined ? { toolCallCount: envConfig.toolCallCount } : {}),
      taskOutputJson: envConfig.taskOutputJson,
      outputsJson: envConfig.outputsJson,
      reasonCode: envConfig.reasonCode,
      progressMessage: envConfig.progressMessage,
      ...(envConfig.cpuPct !== undefined ? { cpuPct: envConfig.cpuPct } : {}),
      ...(envConfig.memoryMb !== undefined ? { memoryMb: envConfig.memoryMb } : {}),
      ...(envConfig.toolBacklogCount !== undefined ? { toolBacklogCount: envConfig.toolBacklogCount } : {}),
      ...(envConfig.currentStepId !== undefined ? { currentStepId: envConfig.currentStepId } : {}),
      ...(envConfig.lastProgressAt !== undefined ? { lastProgressAt: envConfig.lastProgressAt } : {}),
      ...(envConfig.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: envConfig.workspaceSyncStatus } : {}),
      ...(envConfig.workspaceSyncCheckedAt !== undefined
        ? { workspaceSyncCheckedAt: envConfig.workspaceSyncCheckedAt }
        : {}),
      ...(envConfig.remoteLogs !== undefined ? { remoteLogs: envConfig.remoteLogs } : {}),
      ...(envConfig.occurredAt ? { occurredAt: envConfig.occurredAt } : {}),
    });
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
