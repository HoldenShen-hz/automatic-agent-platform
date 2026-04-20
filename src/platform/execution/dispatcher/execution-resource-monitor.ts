/**
 * @fileoverview Execution Resource Monitor - Scans active executions for resource ceiling violations.
 *
 * Monitors all active executions by querying the store for execution activity,
 * gathering resource usage from worker snapshots and agent execution records,
 * and evaluating against the resource ceiling guard.
 *
 * Use detect() to find all executions currently exceeding resource limits.
 *
 * @see Resource Ceiling Guard: execution-resource-ceiling-guard.ts
 */

import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../contracts/types/ids.js";
import {
  ExecutionResourceCeilingGuard,
  type ExecutionResourceCeilingFinding,
} from "./execution-resource-ceiling-guard.js";

/** Options for the resource monitor scan. */
export interface ExecutionResourceMonitorOptions {
  now?: string;
}

/**
 * Monitors active executions for resource ceiling violations.
 *
 * Scans all active execution activity in the store, retrieves associated
 * execution and agent execution records, gathers resource usage from worker
 * snapshots, and evaluates against the ceiling guard.
 *
 * Returns findings for any executions that have exceeded configured limits.
 */
export class ExecutionResourceMonitor {
  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly guard: ExecutionResourceCeilingGuard = new ExecutionResourceCeilingGuard(),
  ) {}

  /**
   * Detects all active executions that are exceeding resource ceilings.
   *
   * Iterates through all active execution activity, builds resource usage
   * samples from execution and worker data, and returns ceiling violations.
   */
  public detect(options: ExecutionResourceMonitorOptions = {}): ExecutionResourceCeilingFinding[] {
    const observedAt = options.now ?? nowIso();

    return this.store.operations.listActiveExecutionActivity().flatMap((activity) => {
      const execution = this.store.dispatch.getExecution(activity.executionId);
      if (!execution) {
        return [];
      }

      const agentExecution = this.store.worker.getAgentExecutionRecord(activity.executionId);
      const workerSnapshot = this.store.worker.getWorkerSnapshot(agentExecution?.agentId ?? execution.agentId);

      return this.guard.evaluate({
        executionId: execution.id,
        taskId: execution.taskId,
        agentId: agentExecution?.agentId ?? execution.agentId,
        status: execution.status,
        runtimeInstanceId: agentExecution?.runtimeInstanceId ?? workerSnapshot?.runtimeInstanceId ?? null,
        currentStepId: agentExecution?.currentStepId ?? workerSnapshot?.currentStepId ?? null,
        toolCallCount: agentExecution?.toolCallCount ?? 0,
        memoryMb: workerSnapshot?.memoryMb ?? null,
        startedAt: agentExecution?.startedAt ?? execution.startedAt ?? execution.createdAt,
        now: observedAt,
      });
    });
  }
}
