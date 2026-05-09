import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { RuntimeRecoveryReplayService } from "../recovery/runtime-recovery-replay-service-root.js";
import { ReplayBoundaryGuard, type ReplayOperation, type ReplayMode } from "../recovery/replay-boundary-guard.js";

export interface ReplayWorkerOptions {
  readonly replayService: Pick<RuntimeRecoveryReplayService, "buildTaskReplayReport">;
  readonly listTaskIds: () => readonly string[] | Promise<readonly string[]>;
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly now?: () => string;
  readonly replayPolicy?: ReplaySandboxPolicy;
}

export interface ReplaySandboxPolicy {
  readonly mode: "trace_only" | "isolated_sandbox";
  readonly sandboxId?: string;
  readonly allowRealSideEffects: boolean;
}

export class ReplayWorker implements RecoveryWorker {
  private readonly cadence: RecoveryCadence;
  private readonly now: () => string;
  private readonly replayPolicy: ReplaySandboxPolicy;
  private readonly boundaryGuard: ReplayBoundaryGuard;

  public constructor(private readonly options: ReplayWorkerOptions) {
    this.cadence = buildRecoveryCadence({
      intervalMs: options.cadence?.intervalMs ?? 300_000,
      maxConcurrent: options.cadence?.maxConcurrent ?? 1,
      priority: options.cadence?.priority ?? "normal",
    });
    this.now = options.now ?? nowIso;
    this.replayPolicy = options.replayPolicy ?? {
      mode: "trace_only",
      allowRealSideEffects: false,
    };
    this.boundaryGuard = new ReplayBoundaryGuard();
    this.assertReplayPolicySafe(this.replayPolicy);
  }

  public getWorkerId(): string {
    return this.options.workerId ?? "replay-worker";
  }

  public getRecoveryCadence(): RecoveryCadence {
    return this.cadence;
  }

  public async runRecoveryCycle(): Promise<RecoveryReport> {
    const startedAt = this.now();
    const startedMs = Date.now();

    try {
      this.assertReplayPolicySafe(this.replayPolicy);
      const taskIds = [...await this.options.listTaskIds()];

      // R4-29 (INV-REPLAY-001): Integrate ReplayBoundaryGuard to prevent real side effects during replay
      // Build replay operations from task replay reports
      const replayOperations: ReplayOperation[] = taskIds.map((taskId) => ({
        operationId: `replay:${taskId}`,
        resourceKind: "tool" as const,
        hasRealSideEffect: true, // Assume tools have side effects unless proven otherwise
        tombstoneReplay: false,
      }));

      // Evaluate whether replay operations are safe before proceeding
      const replayMode: ReplayMode = this.replayPolicy.mode === "trace_only" ? "trace_replay" : "reexecution_replay";
      const boundaryDecision = this.boundaryGuard.evaluate(replayMode, replayOperations);

      if (!boundaryDecision.allowed) {
        return {
          workerId: this.getWorkerId(),
          workerType: "replay",
          startedAt,
          completedAt: this.now(),
          durationMs: Date.now() - startedMs,
          itemsProcessed: 0,
          itemsRecovered: 0,
          errors: [{
            code: boundaryDecision.reasonCode,
            message: `Replay blocked: ${boundaryDecision.blockedOperationIds.join(", ")}`,
          }],
        };
      }

      const reports = await Promise.all(taskIds.map((taskId) => this.options.replayService.buildTaskReplayReport(taskId, startedAt)));
      const recoveryActiveCount = reports.filter((report) => report.outcome !== "no_recovery_activity").length;

      return {
        workerId: this.getWorkerId(),
        workerType: "replay",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: taskIds.length,
        itemsRecovered: recoveryActiveCount,
        errors: [],
        metadata: {
          replayedTaskIds: taskIds,
          recoveryActiveCount,
          replayPolicyMode: this.replayPolicy.mode,
          replaySandboxId: this.replayPolicy.sandboxId ?? null,
        },
      };
    } catch (error) {
      return {
        workerId: this.getWorkerId(),
        workerType: "replay",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: 0,
        itemsRecovered: 0,
        errors: [{
          code: "replay.cycle_failed",
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }

  private assertReplayPolicySafe(policy: ReplaySandboxPolicy): void {
    if (policy.allowRealSideEffects) {
      throw new Error("ReplayWorker refuses replay policies that allow real side effects");
    }
    if (policy.mode === "isolated_sandbox" && (policy.sandboxId == null || policy.sandboxId.trim().length === 0)) {
      throw new Error("ReplayWorker requires sandboxId for isolated_sandbox replay");
    }
  }
}
