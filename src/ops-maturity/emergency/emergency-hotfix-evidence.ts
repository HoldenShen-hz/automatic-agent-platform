export interface EmergencyHotfixEvidence {
  readonly hotfixId: string;
  readonly expiresAt: string;
  readonly followUpTicketId: string | null;
  readonly rollbackRunbookId: string | null;
  readonly evidenceBundleId: string | null;
}

export interface EmergencyHotfixDecision {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
}

export class EmergencyHotfixEvidenceGate {
  public evaluate(evidence: EmergencyHotfixEvidence, now: string): EmergencyHotfixDecision {
    const reasonCodes: string[] = [];
    if (evidence.expiresAt <= now) {
      reasonCodes.push("hotfix.expired");
    }
    if (evidence.followUpTicketId == null) {
      reasonCodes.push("hotfix.follow_up_missing");
    }
    if (evidence.rollbackRunbookId == null) {
      reasonCodes.push("hotfix.rollback_runbook_missing");
    }
    if (evidence.evidenceBundleId == null) {
      reasonCodes.push("hotfix.evidence_bundle_missing");
    }
    return {
      allowed: reasonCodes.length === 0,
      reasonCodes: Object.freeze([...reasonCodes]),
    };
  }
}
