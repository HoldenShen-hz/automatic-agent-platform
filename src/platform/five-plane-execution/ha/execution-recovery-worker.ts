import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoverySuggestedAction,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { RuntimeRecoveryCandidate, RecoveryExecutionResult } from "../recovery/runtime-recovery-service.js";

export interface ExecutionRecoveryWorkerOptions {
  readonly recoveryService: {
    listRecoverableExecutingRuns(now: string, tenantId?: string | null): RuntimeRecoveryCandidate[];
    listStaleRuns(staleBefore: string, tenantId?: string | null): RuntimeRecoveryCandidate[];
    listBlockedRunsAwaitingApproval(tenantId?: string | null): RuntimeRecoveryCandidate[];
    executeRecoveryAction(executionId: string, action: RecoverySuggestedAction, operatorId: string): Promise<RecoveryExecutionResult>;
  };
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly staleThresholdMs?: number;
  readonly tenantId?: string | null;
  readonly now?: () => string;
  /** Operator ID for audit trail when executing recovery actions */
  readonly operatorId?: string;
}

export class ExecutionRecoveryWorker implements RecoveryWorker {
  private readonly cadence: RecoveryCadence;
  private readonly staleThresholdMs: number;
  private readonly now: () => string;
  private readonly operatorId: string;

  public constructor(private readonly options: ExecutionRecoveryWorkerOptions) {
    this.cadence = buildRecoveryCadence({
      intervalMs: options.cadence?.intervalMs ?? 60_000,
      maxConcurrent: options.cadence?.maxConcurrent ?? 1,
      priority: options.cadence?.priority ?? "high",
    });
    this.staleThresholdMs = Math.max(1_000, Math.trunc(options.staleThresholdMs ?? 5 * 60 * 1000));
    this.now = options.now ?? nowIso;
    this.operatorId = options.operatorId ?? "system";
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
    const errors: { code: string; message: string }[] = [];

    try {
      const activeCandidates = this.options.recoveryService.listRecoverableExecutingRuns(startedAt, tenantId);
      const staleCandidates = this.options.recoveryService.listStaleRuns(staleBefore, tenantId);
      const blockedCandidates = this.options.recoveryService.listBlockedRunsAwaitingApproval(tenantId);

      // R29-22 FIX: Actually execute recovery actions for actionable candidates
      // Previously only counted candidates without executing any recovery
      let recoveredCount = 0;

      for (const candidate of activeCandidates) {
        if (candidate.suggestedAction === "resume_same_worker" || candidate.suggestedAction === "retry_new_ticket") {
          try {
            const result = await this.options.recoveryService.executeRecoveryAction(
              candidate.executionId,
              candidate.suggestedAction,
              this.operatorId,
            );
            if (result.success) {
              recoveredCount++;
            } else {
              errors.push({ code: "recovery_execution_failed", message: result.errorMessage });
            }
          } catch (err) {
            errors.push({
              code: "recovery_execution_error",
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // Process stale candidates
      for (const candidate of staleCandidates) {
        if (candidate.suggestedAction === "resume_same_worker" || candidate.suggestedAction === "retry_new_ticket") {
          try {
            const result = await this.options.recoveryService.executeRecoveryAction(
              candidate.executionId,
              candidate.suggestedAction,
              this.operatorId,
            );
            if (result.success) {
              recoveredCount++;
            } else {
              errors.push({ code: "recovery_execution_failed", message: result.errorMessage });
            }
          } catch (err) {
            errors.push({
              code: "recovery_execution_error",
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      return {
        workerId: this.getWorkerId(),
        workerType: "execution_recovery",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: activeCandidates.length + staleCandidates.length + blockedCandidates.length,
        itemsRecovered: recoveredCount,
        errors,
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
