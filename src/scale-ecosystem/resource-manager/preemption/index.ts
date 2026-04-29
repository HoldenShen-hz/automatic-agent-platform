export interface PreemptionCandidate {
  readonly executionId: string;
  readonly priority: number;
  readonly progressPercent: number;
  /** Whether this execution has completed its checkpoint */
  readonly hasCheckpoint: boolean;
}

export interface PreemptionDecision {
  readonly victim: PreemptionCandidate | null;
  readonly reason: string;
  readonly checkpointRequired: boolean;
}

/**
 * Choose a preemption victim per §53.4
 * Only executions that have completed their checkpoint can be preempted
 */
export function choosePreemptionVictim(candidates: readonly PreemptionCandidate[]): PreemptionDecision {
  // Filter to only candidates that have completed their checkpoint
  const checkpointedCandidates = candidates.filter((c) => c.hasCheckpoint);

  if (checkpointedCandidates.length === 0) {
    return {
      victim: null,
      reason: "No eligible candidates with completed checkpoints",
      checkpointRequired: true,
    };
  }

  const victim = [...checkpointedCandidates].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.progressPercent - right.progressPercent;
  })[0]!;

  return {
    victim,
    reason: `Selected lowest priority candidate with checkpoint: ${victim.executionId}`,
    checkpointRequired: false,
  };
}
