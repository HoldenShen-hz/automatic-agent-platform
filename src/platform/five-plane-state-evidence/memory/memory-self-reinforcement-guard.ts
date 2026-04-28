export interface MemoryPromotionEvidence {
  readonly memoryId: string;
  readonly evaluatorGeneratedByCandidate: boolean;
  readonly holdoutPassed: boolean;
  readonly differentJudgePassed: boolean;
  readonly humanReviewRequired: boolean;
  readonly humanApproved: boolean;
}

export interface MemorySelfReinforcementDecision {
  readonly promotable: boolean;
  readonly reasonCodes: readonly string[];
}

export class MemorySelfReinforcementGuard {
  public evaluate(evidence: MemoryPromotionEvidence): MemorySelfReinforcementDecision {
    const reasonCodes: string[] = [];
    if (evidence.evaluatorGeneratedByCandidate) {
      reasonCodes.push("memory.self_generated_evaluator");
    }
    if (!evidence.holdoutPassed) {
      reasonCodes.push("memory.holdout_failed");
    }
    if (!evidence.differentJudgePassed) {
      reasonCodes.push("memory.different_judge_failed");
    }
    if (evidence.humanReviewRequired && !evidence.humanApproved) {
      reasonCodes.push("memory.human_review_required");
    }
    return {
      promotable: reasonCodes.length === 0,
      reasonCodes,
    };
  }
}
