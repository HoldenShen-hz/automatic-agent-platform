import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { RuntimeRecoveryReplayService } from "../recovery/runtime-recovery-replay-service-root.js";

export interface ReplayWorkerOptions {
  readonly replayService: Pick<RuntimeRecoveryReplayService, "buildTaskReplayReport">;
  readonly listTaskIds: () => readonly string[] | Promise<readonly string[]>;
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly now?: () => string;
}

export class ReplayWorker implements RecoveryWorker {
  private readonly cadence: RecoveryCadence;
  private readonly now: () => string;

  public constructor(private readonly options: ReplayWorkerOptions) {
    this.cadence = buildRecoveryCadence({
      intervalMs: options.cadence?.intervalMs ?? 300_000,
      maxConcurrent: options.cadence?.maxConcurrent ?? 1,
      priority: options.cadence?.priority ?? "normal",
    });
    this.now = options.now ?? nowIso;
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
      const taskIds = [...await this.options.listTaskIds()];
      const reports = taskIds.map((taskId) => this.options.replayService.buildTaskReplayReport(taskId, startedAt));
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
}
