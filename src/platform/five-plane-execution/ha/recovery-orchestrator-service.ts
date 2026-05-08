import { nowIso } from "../../contracts/types/ids.js";
import type { RecoveryReport, RecoveryWorker } from "../../contracts/types/recovery-cadence.js";

export interface RecoveryOrchestratorCycleReport {
  readonly orchestratorId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly workerReports: readonly RecoveryReport[];
}

export class RecoveryOrchestratorService {
  public constructor(
    private readonly workers: readonly RecoveryWorker[],
    private readonly orchestratorId: string = "recovery-orchestrator",
  ) {}

  public listWorkers(): readonly RecoveryWorker[] {
    return this.workers;
  }

  public async runCycle(): Promise<RecoveryOrchestratorCycleReport> {
    const startedAt = nowIso();
    const startedAtMs = Date.parse(startedAt);
    const orderedWorkers = [...this.workers].sort(compareRecoveryWorkers);
    const workerReports: RecoveryReport[] = [];
    for (const worker of orderedWorkers) {
      try {
        workerReports.push(await worker.runRecoveryCycle());
      } catch (error) {
        const completedAt = nowIso();
        workerReports.push({
          workerId: worker.getWorkerId(),
          workerType: "recovery_worker",
          startedAt,
          completedAt,
          durationMs: Math.max(0, Date.parse(completedAt) - startedAtMs),
          itemsProcessed: 0,
          itemsRecovered: 0,
          errors: [
            {
              code: "recovery_worker.run_failed",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        });
      }
    }
    const completedAt = nowIso();
    return {
      orchestratorId: this.orchestratorId,
      startedAt,
      completedAt,
      durationMs: Math.max(0, Date.parse(completedAt) - startedAtMs),
      workerReports,
    };
  }
}

function compareRecoveryWorkers(left: RecoveryWorker, right: RecoveryWorker): number {
  const priorityOrder = ["critical", "high", "normal", "low"];
  const leftCadence = left.getRecoveryCadence();
  const rightCadence = right.getRecoveryCadence();
  return (
    priorityOrder.indexOf(leftCadence.priority) - priorityOrder.indexOf(rightCadence.priority)
    || leftCadence.intervalMs - rightCadence.intervalMs
    || left.getWorkerId().localeCompare(right.getWorkerId())
  );
}
