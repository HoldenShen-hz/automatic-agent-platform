import { nowIso } from "../../contracts/types/ids.js";
import type { RecoveryReport, RecoveryWorker } from "../../contracts/types/recovery-cadence.js";

export interface RecoveryOrchestratorCycleReport {
  readonly orchestratorId: string;
  readonly startedAt: string;
  readonly completedAt: string;
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
    const orderedWorkers = [...this.workers].sort(compareRecoveryWorkers);
    const workerReports: RecoveryReport[] = [];
    for (const worker of orderedWorkers) {
      workerReports.push(await worker.runRecoveryCycle());
    }
    return {
      orchestratorId: this.orchestratorId,
      startedAt,
      completedAt: nowIso(),
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
