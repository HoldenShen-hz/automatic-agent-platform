export interface PolicyAdherenceCase {
  readonly caseId: string;
  readonly policyMatched: boolean;
  readonly toolArgumentsValid: boolean;
  readonly handoffCorrect: boolean;
  readonly requiresHitl: boolean;
  readonly hitlApproved: boolean;
}

export interface PolicyAdherenceReport {
  readonly taskCompletion: number;
  readonly policyViolationCount: number;
  readonly toolArgumentCorrectness: number;
  readonly handoffCorrectness: number;
  readonly blockers: readonly string[];
}

export function evaluatePolicyAdherence(cases: readonly PolicyAdherenceCase[]): PolicyAdherenceReport {
  const total = cases.length === 0 ? 1 : cases.length;
  const policyViolationCount = cases.filter((entry) => !entry.policyMatched || (entry.requiresHitl && !entry.hitlApproved)).length;
  const blockers = cases
    .filter((entry) => entry.requiresHitl && !entry.hitlApproved)
    .map((entry) => `${entry.caseId}:missing_hitl`);
  return {
    taskCompletion: cases.filter((entry) => entry.policyMatched && entry.toolArgumentsValid).length / total,
    policyViolationCount,
    toolArgumentCorrectness: cases.filter((entry) => entry.toolArgumentsValid).length / total,
    handoffCorrectness: cases.filter((entry) => entry.handoffCorrect).length / total,
    blockers,
  };
}
