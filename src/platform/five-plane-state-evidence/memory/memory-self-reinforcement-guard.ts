export interface MemoryPromotionEvidence {
  readonly memoryId: string;
  readonly evaluatorGeneratedByCandidate: boolean;
  readonly holdoutPassed: boolean;
  readonly differentJudgePassed: boolean;
  readonly humanReviewRequired: boolean;
  readonly humanApproved: boolean;
  readonly attestationVerified?: boolean;
  readonly holdoutEvidenceRef?: string | null;
  readonly holdoutEvidenceVerified?: boolean;
  readonly differentJudgeEvidenceRef?: string | null;
  readonly differentJudgeEvidenceVerified?: boolean;
  readonly humanReviewEvidenceRef?: string | null;
  readonly humanReviewerId?: string | null;
  readonly humanReviewEvidenceVerified?: boolean;
}

export interface MemorySelfReinforcementDecision {
  readonly promotable: boolean;
  readonly reasonCodes: readonly string[];
}

export class MemorySelfReinforcementGuard {
  public evaluate(evidence: MemoryPromotionEvidence): MemorySelfReinforcementDecision {
    const reasonCodes: string[] = [];
    if (evidence.attestationVerified !== true) {
      reasonCodes.push("memory.attestation_missing");
    }
    if (evidence.evaluatorGeneratedByCandidate) {
      reasonCodes.push("memory.self_generated_evaluator");
    }
    if (!evidence.holdoutPassed) {
      reasonCodes.push("memory.holdout_failed");
    } else if (!hasVerifiedEvidence(evidence.holdoutEvidenceRef, evidence.holdoutEvidenceVerified)) {
      reasonCodes.push("memory.holdout_evidence_missing");
    }
    if (!evidence.differentJudgePassed) {
      reasonCodes.push("memory.different_judge_failed");
    } else if (!hasVerifiedEvidence(evidence.differentJudgeEvidenceRef, evidence.differentJudgeEvidenceVerified)) {
      reasonCodes.push("memory.different_judge_evidence_missing");
    }
    if (evidence.humanReviewRequired && !evidence.humanApproved) {
      reasonCodes.push("memory.human_review_required");
    } else if (
      evidence.humanReviewRequired
      && (
        !hasVerifiedEvidence(evidence.humanReviewEvidenceRef, evidence.humanReviewEvidenceVerified)
        || evidence.humanReviewerId == null
        || evidence.humanReviewerId.length === 0
      )
    ) {
      reasonCodes.push("memory.human_review_evidence_missing");
    }
    return {
      promotable: reasonCodes.length === 0,
      reasonCodes,
    };
  }
}

function hasVerifiedEvidence(evidenceRef: string | null | undefined, verified: boolean | undefined): boolean {
  return typeof evidenceRef === "string" && evidenceRef.length > 0 && verified === true;
}
