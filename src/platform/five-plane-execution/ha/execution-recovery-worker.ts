import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { RuntimeRecoveryService } from "../recovery/runtime-recovery-service-root.js";

export interface ExecutionRecoveryWorkerOptions {
  readonly recoveryService: Pick<RuntimeRecoveryService, "listBlockedRunsAwaitingApproval" | "listRecoverableExecutingRuns" | "listStaleRuns">;
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly staleThresholdMs?: number;
  readonly tenantId?: string | null;
  readonly now?: () => string;
}

export class ExecutionRecoveryWorker implements RecoveryWorker {
  private readonly cadence: RecoveryCadence;
  private readonly staleThresholdMs: number;
  private readonly now: () => string;

  public constructor(private readonly options: ExecutionRecoveryWorkerOptions) {
    this.cadence = buildRecoveryCadence({
      intervalMs: options.cadence?.intervalMs ?? 60_000,
      maxConcurrent: options.cadence?.maxConcurrent ?? 1,
      priority: options.cadence?.priority ?? "high",
    });
    this.staleThresholdMs = Math.max(1_000, Math.trunc(options.staleThresholdMs ?? 5 * 60 * 1000));
    this.now = options.now ?? nowIso;
  }

  public getWorkerId(): string {
    return this.options.workerId ?? "execution-recovery-worker";
  }

  public getRecoveryCadence(): RecoveryCadence {
    return this.cadence;
  }

  public async runRecoveryCycle(): Promise<RecoveryReport> {
    const startedAt = this.now();
    const startedMs = Date.now();
    const tenantId = this.options.tenantId;
    const staleBefore = new Date(Date.parse(startedAt) - this.staleThresholdMs).toISOString();

    try {
      const activeCandidates = this.options.recoveryService.listRecoverableExecutingRuns(startedAt, tenantId);
      const staleCandidates = this.options.recoveryService.listStaleRuns(staleBefore, tenantId);
      const blockedCandidates = this.options.recoveryService.listBlockedRunsAwaitingApproval(tenantId);
      const actionableCount = activeCandidates.filter((candidate) =>
        candidate.suggestedAction === "resume_same_worker" || candidate.suggestedAction === "retry_new_ticket"
      ).length;

      return {
        workerId: this.getWorkerId(),
        workerType: "execution_recovery",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: activeCandidates.length + staleCandidates.length + blockedCandidates.length,
        itemsRecovered: actionableCount,
        errors: [],
        metadata: {
          activeCandidateCount: activeCandidates.length,
          staleCandidateCount: staleCandidates.length,
          blockedCandidateCount: blockedCandidates.length,
          staleBefore,
        },
      };
    } catch (error) {
      return {
        workerId: this.getWorkerId(),
        workerType: "execution_recovery",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: 0,
        itemsRecovered: 0,
        errors: [{
          code: "execution_recovery.cycle_failed",
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }
}
