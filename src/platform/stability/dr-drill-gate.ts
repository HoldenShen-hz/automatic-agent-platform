export interface DrDrillEvidence {
  readonly drillId: string;
  readonly regionPair: string;
  readonly failoverCompleted: boolean;
  readonly quorumPreserved: boolean;
  readonly tombstoneReplayBoundaryPreserved: boolean;
  readonly recoveryTimeMs: number;
  readonly maxRecoveryTimeMs: number;
}

export interface DrDrillDecision {
  readonly passed: boolean;
  readonly reasonCodes: readonly string[];
  readonly slaEligible: boolean;
}

export class DrDrillGate {
  public evaluate(evidence: DrDrillEvidence): DrDrillDecision {
    const reasonCodes: string[] = [];
    if (!evidence.failoverCompleted) {
      reasonCodes.push("dr.failover_not_completed");
    }
    if (!evidence.quorumPreserved) {
      reasonCodes.push("dr.quorum_not_preserved");
    }
    if (!evidence.tombstoneReplayBoundaryPreserved) {
      reasonCodes.push("dr.tombstone_replay_boundary_failed");
    }
    if (evidence.recoveryTimeMs > evidence.maxRecoveryTimeMs) {
      reasonCodes.push("dr.rto_exceeded");
    }
    return {
      passed: reasonCodes.length === 0,
      reasonCodes,
      slaEligible: reasonCodes.length === 0,
    };
  }
}
