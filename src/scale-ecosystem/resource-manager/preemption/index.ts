export interface PreemptionCandidate {
  readonly executionId: string;
  readonly priority: number;
  readonly progressPercent: number;
  readonly checkpointAvailable?: boolean;
  readonly checkpointLatencyMs?: number;
}

export function choosePreemptionVictim(candidates: readonly PreemptionCandidate[]): PreemptionCandidate | null {
  return [...candidates]
    .filter((candidate) => candidate.checkpointAvailable !== false)
    .sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    if ((left.checkpointLatencyMs ?? 0) !== (right.checkpointLatencyMs ?? 0)) {
      return (left.checkpointLatencyMs ?? 0) - (right.checkpointLatencyMs ?? 0);
    }
    return left.progressPercent - right.progressPercent;
    })[0] ?? null;
}
