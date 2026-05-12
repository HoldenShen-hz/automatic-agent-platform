export type RecoveryWorkerPriority = "critical" | "high" | "normal" | "low";

export interface RecoveryCadence {
  readonly intervalMs: number;
  readonly maxConcurrent: number;
  readonly priority: RecoveryWorkerPriority;
}

export interface RecoveryReportError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly targetId?: string;
}

export interface RecoveryReport {
  readonly workerId: string;
  readonly workerType: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly itemsProcessed: number;
  readonly itemsRecovered: number;
  readonly errors: readonly RecoveryReportError[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RecoveryWorker<TReport extends RecoveryReport = RecoveryReport> {
  getWorkerId(): string;
  getRecoveryCadence(): RecoveryCadence;
  runRecoveryCycle(): Promise<TReport>;
}

export function buildRecoveryCadence(input: Partial<RecoveryCadence> & Pick<RecoveryCadence, "intervalMs">): RecoveryCadence {
  return {
    intervalMs: Math.max(1, Math.trunc(input.intervalMs)),
    maxConcurrent: Math.max(1, Math.trunc(input.maxConcurrent ?? 1)),
    priority: input.priority ?? "normal",
  };
}
