import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReportError,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { nowIso } from "../../contracts/types/ids.js";
import type {
  RecoverySuggestedAction,
  RuntimeRecoveryCandidate,
  RuntimeRecoveryService,
} from "../recovery/runtime-recovery-service.js";

export interface ExecutionRecoveryWorkerOptions {
  readonly recoveryService: Pick<RuntimeRecoveryService, "listBlockedRunsAwaitingApproval" | "listRecoverableExecutingRuns" | "listStaleRuns"> & {
    readonly applyRecoveryDecision?: (executionId: string, decidedBy?: string) => Promise<unknown>;
  };
  readonly workerId?: string;
  readonly cadence?: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">;
  readonly staleThresholdMs?: number;
  readonly tenantId?: string | null;
  readonly now?: () => string;
}

class RecoveryCycleMetadata extends Array<unknown> {
  [key: string]: unknown;
  public activeCandidateCount: number;
  public staleCandidateCount: number;
  public blockedCandidateCount: number;
  public actionableCandidateCount: number;
  public staleBefore: string;

  public constructor(input: {
    activeCandidateCount: number;
    staleCandidateCount: number;
    blockedCandidateCount: number;
    actionableCandidateCount: number;
    staleBefore: string;
  }) {
    super();
    this.activeCandidateCount = input.activeCandidateCount;
    this.staleCandidateCount = input.staleCandidateCount;
    this.blockedCandidateCount = input.blockedCandidateCount;
    this.actionableCandidateCount = input.actionableCandidateCount;
    this.staleBefore = input.staleBefore;
  }
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
    const errors: RecoveryReportError[] = [];

    try {
      const activeCandidates = this.options.recoveryService.listRecoverableExecutingRuns(startedAt, tenantId);
      const staleCandidates = this.options.recoveryService.listStaleRuns(staleBefore, tenantId);
      const blockedCandidates = this.options.recoveryService.listBlockedRunsAwaitingApproval(tenantId);
      const actionableCandidates = dedupeCandidatesByExecutionId([
        ...activeCandidates.filter(isAutomaticallyRecoverableCandidate),
        ...staleCandidates.filter(isAutomaticallyRecoverableCandidate),
      ]);
      const recoveredCount = await this.applyRecoveryActions(actionableCandidates, errors);
      const metadata = new RecoveryCycleMetadata({
        activeCandidateCount: activeCandidates.length,
        staleCandidateCount: staleCandidates.length,
        blockedCandidateCount: blockedCandidates.length,
        actionableCandidateCount: actionableCandidates.length,
        staleBefore,
      });

      return {
        workerId: this.getWorkerId(),
        workerType: "execution_recovery",
        startedAt,
        completedAt: this.now(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: activeCandidates.length + staleCandidates.length + blockedCandidates.length,
        itemsRecovered: recoveredCount,
        errors,
        metadata,
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

  private async applyRecoveryActions(
    candidates: readonly RuntimeRecoveryCandidate[],
    errors: RecoveryReportError[],
  ): Promise<number> {
    const applyRecoveryDecision = this.options.recoveryService.applyRecoveryDecision;
    if (candidates.length === 0) {
      return 0;
    }
    if (typeof applyRecoveryDecision !== "function") {
      errors.push({
        code: "execution_recovery.applier_unavailable",
        message: "Recovery worker cannot apply automated recovery actions without an applyRecoveryDecision handler.",
      });
      return 0;
    }

    let recoveredCount = 0;
    for (const candidate of candidates) {
      try {
        await applyRecoveryDecision(candidate.executionId, this.getWorkerId());
        recoveredCount += 1;
      } catch (error) {
        errors.push({
          code: "execution_recovery.apply_failed",
          message: error instanceof Error ? error.message : String(error),
          targetId: candidate.executionId,
        });
      }
    }

    return recoveredCount;
  }
}

function isAutomaticallyRecoverableAction(action: RecoverySuggestedAction): action is "resume_same_worker" | "retry_new_ticket" {
  return action === "resume_same_worker" || action === "retry_new_ticket";
}

function isAutomaticallyRecoverableCandidate(candidate: RuntimeRecoveryCandidate): boolean {
  return isAutomaticallyRecoverableAction(candidate.suggestedAction);
}

function dedupeCandidatesByExecutionId(candidates: readonly RuntimeRecoveryCandidate[]): RuntimeRecoveryCandidate[] {
  const deduped = new Map<string, RuntimeRecoveryCandidate>();
  for (const candidate of candidates) {
    deduped.set(candidate.executionId, candidate);
  }
  return [...deduped.values()];
}
