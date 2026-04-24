import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { RuntimeRepairService } from "../recovery/runtime-repair-service-root.js";
import type { StartupConsistencyChecker, StartupConsistencyOptions } from "../startup/startup-consistency-checker.js";

export interface WorkflowRepairWorkerOptions {
  readonly checker: Pick<StartupConsistencyChecker, "run">;
  readonly repairService: Pick<RuntimeRepairService, "apply">;
  readonly checkerOptions?: StartupConsistencyOptions;
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly now?: () => string;
}

export class WorkflowRepairWorker implements RecoveryWorker {
  private readonly cadence: RecoveryCadence;
  private readonly now: () => string;

  public constructor(private readonly options: WorkflowRepairWorkerOptions) {
    this.cadence = buildRecoveryCadence({
      intervalMs: options.cadence?.intervalMs ?? 120_000,
      maxConcurrent: options.cadence?.maxConcurrent ?? 1,
      priority: options.cadence?.priority ?? "high",
    });
    this.now = options.now ?? nowIso;
  }

  public getWorkerId(): string {
    return this.options.workerId ?? "workflow-repair-worker";
  }

  public getRecoveryCadence(): RecoveryCadence {
    return this.cadence;
  }

  public async runRecoveryCycle(): Promise<RecoveryReport> {
    const startedAt = this.now();
    const startedMs = Date.now();

    try {
      const report = this.options.checker.run({ ...this.options.checkerOptions, now: startedAt });
      const results = await this.options.repairService.apply(report);
      const recoveredCount = results.filter((result) => result.applied).length;
      const errors = results
        .filter((result) => !result.applied)
        .map((result) => ({
          code: `workflow_repair.${result.action}`,
          message: result.detail,
          details: { targetId: result.targetId },
        }));

      return {
        workerId: this.getWorkerId(),
        workerType: "workflow_repair",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: report.repairActions.length,
        itemsRecovered: recoveredCount,
        errors,
        metadata: {
          status: report.status,
          findingCount: report.findings.length,
        },
      };
    } catch (error) {
      return {
        workerId: this.getWorkerId(),
        workerType: "workflow_repair",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: 0,
        itemsRecovered: 0,
        errors: [{
          code: "workflow_repair.cycle_failed",
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }
}
