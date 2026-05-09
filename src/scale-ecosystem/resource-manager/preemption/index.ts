export interface PreemptionCandidate {
  readonly executionId: string;
  readonly priority: number;
  readonly progressPercent: number;
  /** Unix timestamp (ms) when the last checkpoint was successfully saved, or 0 if no checkpoint exists */
  readonly lastCheckpointTimestampMs?: number;
  readonly checkpointLatencyMs?: number;
}

/**
 * R15-59: Choose the best victim for preemption with checkpoint-before-preempt requirement.
 *
 * Only executions that have taken a checkpoint within the acceptable window can be preempted.
 * This ensures progress is preserved and recovery is possible after preemption.
 *
 * @param candidates - List of preemptable executions
 * @param maxCheckpointAgeMs - Maximum age of checkpoint to be considered valid (default: 5 minutes)
 * @returns The selected victim or null if no candidate has a valid checkpoint
 */
export function choosePreemptionVictim(
  candidates: readonly PreemptionCandidate[],
  maxCheckpointAgeMs = 300_000,
): PreemptionCandidate | null {
  const now = Date.now();
  return [...candidates]
    .filter((candidate) => {
      // R15-59: Require valid checkpoint before preemption
      const checkpointAge = now - (candidate.lastCheckpointTimestampMs ?? 0);
      const hasValidCheckpoint = candidate.lastCheckpointTimestampMs != null
        && candidate.lastCheckpointTimestampMs > 0
        && checkpointAge <= maxCheckpointAgeMs;
      return hasValidCheckpoint;
    })
    .sort((left, right) => {
      // Prefer lower priority (lower number = higher priority for preemption)
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      // Prefer longer checkpoint latency (slower checkpoints are more expensive to redo)
      if ((left.checkpointLatencyMs ?? 0) !== (right.checkpointLatencyMs ?? 0)) {
        return (right.checkpointLatencyMs ?? 0) - (left.checkpointLatencyMs ?? 0);
      }
      // Prefer higher progress (more work done that would be lost)
      return right.progressPercent - left.progressPercent;
    })[0] ?? null;
}
