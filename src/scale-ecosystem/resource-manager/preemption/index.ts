export interface PreemptionCandidate {
  readonly executionId: string;
  readonly priority: number;
  readonly progressPercent: number;
}

export function choosePreemptionVictim(candidates: readonly PreemptionCandidate[]): PreemptionCandidate | null {
  return [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.progressPercent - right.progressPercent;
  })[0] ?? null;
}
