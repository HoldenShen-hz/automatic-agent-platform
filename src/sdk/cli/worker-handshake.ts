/**
 * Worker Handshake CLI Tool
 *
 * This module provides a command-line interface for worker-execution lifecycle
 * operations including claiming executions (handshake) and recording heartbeats.
 *
 * Actions:
 *   - claim: Worker claims an execution ticket
 *   - heartbeat: Worker records progress heartbeat
 *
 * Usage:
 *   npm run worker-handshake
 *
 * @see {@link docs_zh/contracts/task_lease_and_fencing_contract.md} - Lease and fencing
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution lifecycle
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md} - State transitions
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
import { loadWorkerHandshakeCliEnv } from "../../platform/five-plane-control-plane/config-center/runtime-ops-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { ExecutionWorkerHandshakeService } from "../../platform/five-plane-execution/worker-pool/execution-worker-handshake-service.js";
import { withCliStorage } from "./authoritative-storage.js";
import { isCliEntryPoint, runCliMain } from "./cli-exit.js";
import { summarizeCliError } from "./cli-file-guards.js";

/**
 * Main entry point for the worker handshake CLI.
 *
 * Loads worker handshake configuration from environment variables, initializes
 * the database and handshake service, then either claims an execution ticket
 * or records a heartbeat based on the configured action. Outputs the operation
 * result as formatted JSON and ensures the database connection is properly
 * closed before exiting.
 */
function main(): void {
  const envConfig = loadWorkerHandshakeCliEnv();
  const ticketId = envConfig.ticketId ?? null;
  const executionId = envConfig.executionId ?? null;

  const output = withCliStorage((storage) => {
    const handshake = new ExecutionWorkerHandshakeService(storage.sql, storage.store);
    switch (envConfig.action) {
      case "claim":
        if (ticketId == null) {
          throw new ValidationError("missing_env:AA_TICKET_ID", "missing_env:AA_TICKET_ID");
        }
        return handshake.claimExecution({
          ticketId,
          workerId: envConfig.workerId,
          leaseId: envConfig.leaseId,
          fencingToken: envConfig.fencingToken,
          ...(envConfig.runtimeInstanceId !== undefined ? { runtimeInstanceId: envConfig.runtimeInstanceId } : {}),
          ...(envConfig.restartedFromRuntimeInstanceId !== undefined
            ? { restartedFromRuntimeInstanceId: envConfig.restartedFromRuntimeInstanceId }
            : {}),
          progressMessage: envConfig.progressMessage,
          ...(envConfig.lastToolName !== undefined ? { lastToolName: envConfig.lastToolName } : {}),
          ...(envConfig.toolCallCount !== undefined ? { toolCallCount: envConfig.toolCallCount } : {}),
          ...(envConfig.cpuPct !== undefined ? { cpuPct: envConfig.cpuPct } : {}),
          ...(envConfig.memoryMb !== undefined ? { memoryMb: envConfig.memoryMb } : {}),
          ...(envConfig.remoteSessionStatus !== undefined ? { remoteSessionStatus: envConfig.remoteSessionStatus } : {}),
          ...(envConfig.lastAcknowledgedStreamOffset !== undefined
            ? { lastAcknowledgedStreamOffset: envConfig.lastAcknowledgedStreamOffset }
            : {}),
          ...(envConfig.streamResumeSuccessRate !== undefined
            ? { streamResumeSuccessRate: envConfig.streamResumeSuccessRate }
            : {}),
          ...(envConfig.credentialRefreshSuccessRate !== undefined
            ? { credentialRefreshSuccessRate: envConfig.credentialRefreshSuccessRate }
            : {}),
          ...(envConfig.sessionConsistencyCheckStatus !== undefined
            ? { sessionConsistencyCheckStatus: envConfig.sessionConsistencyCheckStatus }
            : {}),
          ...(envConfig.sessionConsistencyCheckedAt !== undefined
            ? { sessionConsistencyCheckedAt: envConfig.sessionConsistencyCheckedAt }
            : {}),
          ...(envConfig.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: envConfig.workspaceSyncStatus } : {}),
          ...(envConfig.workspaceSyncCheckedAt !== undefined
            ? { workspaceSyncCheckedAt: envConfig.workspaceSyncCheckedAt }
            : {}),
          ...(envConfig.saturation !== undefined ? { saturation: envConfig.saturation } : {}),
          ...(envConfig.activeLeaseCount !== undefined ? { activeLeaseCount: envConfig.activeLeaseCount } : {}),
          ...(envConfig.meanStartupLatencyMs !== undefined
            ? { meanStartupLatencyMs: envConfig.meanStartupLatencyMs }
            : {}),
          ...(envConfig.sandboxSuccessRate !== undefined ? { sandboxSuccessRate: envConfig.sandboxSuccessRate } : {}),
          ...(envConfig.repoCacheHitRate !== undefined ? { repoCacheHitRate: envConfig.repoCacheHitRate } : {}),
          ...(envConfig.toolBacklogCount !== undefined ? { toolBacklogCount: envConfig.toolBacklogCount } : {}),
          ...(envConfig.currentStepId !== undefined ? { currentStepId: envConfig.currentStepId } : {}),
          ...(envConfig.lastProgressAt !== undefined ? { lastProgressAt: envConfig.lastProgressAt } : {}),
          ...(envConfig.remoteLogs !== undefined ? { remoteLogs: envConfig.remoteLogs } : {}),
          ...(envConfig.occurredAt ? { occurredAt: envConfig.occurredAt } : {}),
        });
      case "heartbeat":
        if (executionId == null) {
          throw new ValidationError("missing_env:AA_EXECUTION_ID", "missing_env:AA_EXECUTION_ID");
        }
        return handshake.recordHeartbeat({
          executionId,
          workerId: envConfig.workerId,
          leaseId: envConfig.leaseId,
          fencingToken: envConfig.fencingToken,
          ttlMs: envConfig.leaseTtlMs,
          ...(envConfig.runtimeInstanceId !== undefined ? { runtimeInstanceId: envConfig.runtimeInstanceId } : {}),
          ...(envConfig.restartedFromRuntimeInstanceId !== undefined
            ? { restartedFromRuntimeInstanceId: envConfig.restartedFromRuntimeInstanceId }
            : {}),
          progressMessage: envConfig.progressMessage,
          ...(envConfig.lastToolName !== undefined ? { lastToolName: envConfig.lastToolName } : {}),
          ...(envConfig.toolCallCount !== undefined ? { toolCallCount: envConfig.toolCallCount } : {}),
          ...(envConfig.cpuPct !== undefined ? { cpuPct: envConfig.cpuPct } : {}),
          ...(envConfig.memoryMb !== undefined ? { memoryMb: envConfig.memoryMb } : {}),
          ...(envConfig.remoteSessionStatus !== undefined ? { remoteSessionStatus: envConfig.remoteSessionStatus } : {}),
          ...(envConfig.lastAcknowledgedStreamOffset !== undefined
            ? { lastAcknowledgedStreamOffset: envConfig.lastAcknowledgedStreamOffset }
            : {}),
          ...(envConfig.streamResumeSuccessRate !== undefined
            ? { streamResumeSuccessRate: envConfig.streamResumeSuccessRate }
            : {}),
          ...(envConfig.credentialRefreshSuccessRate !== undefined
            ? { credentialRefreshSuccessRate: envConfig.credentialRefreshSuccessRate }
            : {}),
          ...(envConfig.sessionConsistencyCheckStatus !== undefined
            ? { sessionConsistencyCheckStatus: envConfig.sessionConsistencyCheckStatus }
            : {}),
          ...(envConfig.sessionConsistencyCheckedAt !== undefined
            ? { sessionConsistencyCheckedAt: envConfig.sessionConsistencyCheckedAt }
            : {}),
          ...(envConfig.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: envConfig.workspaceSyncStatus } : {}),
          ...(envConfig.workspaceSyncCheckedAt !== undefined
            ? { workspaceSyncCheckedAt: envConfig.workspaceSyncCheckedAt }
            : {}),
          ...(envConfig.saturation !== undefined ? { saturation: envConfig.saturation } : {}),
          ...(envConfig.activeLeaseCount !== undefined ? { activeLeaseCount: envConfig.activeLeaseCount } : {}),
          ...(envConfig.meanStartupLatencyMs !== undefined
            ? { meanStartupLatencyMs: envConfig.meanStartupLatencyMs }
            : {}),
          ...(envConfig.sandboxSuccessRate !== undefined ? { sandboxSuccessRate: envConfig.sandboxSuccessRate } : {}),
          ...(envConfig.repoCacheHitRate !== undefined ? { repoCacheHitRate: envConfig.repoCacheHitRate } : {}),
          ...(envConfig.toolBacklogCount !== undefined ? { toolBacklogCount: envConfig.toolBacklogCount } : {}),
          ...(envConfig.currentStepId !== undefined ? { currentStepId: envConfig.currentStepId } : {}),
          ...(envConfig.lastProgressAt !== undefined ? { lastProgressAt: envConfig.lastProgressAt } : {}),
          ...(envConfig.remoteLogs !== undefined ? { remoteLogs: envConfig.remoteLogs } : {}),
          ...(envConfig.occurredAt ? { occurredAt: envConfig.occurredAt } : {}),
        });
      default:
        throw new ValidationError(`unknown_worker_handshake_action:${envConfig.action}`, `unknown_worker_handshake_action:${envConfig.action}`);
    }
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (isCliEntryPoint(import.meta.url)) {
  void runCliMain(main, {
    onError: (error) => {
      process.stderr.write(`${summarizeCliError(error, "worker_handshake.failed")}\n`);
    },
  });
}
