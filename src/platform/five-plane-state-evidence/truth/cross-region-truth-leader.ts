export interface TruthLeaderEpoch {
  readonly tenantId: string;
  readonly homeRegion: string;
  readonly leaderRegion: string;
  readonly epoch: number;
  readonly fencingToken: string;
}

export interface TruthWriteClaim {
  readonly tenantId: string;
  readonly region: string;
  readonly epoch: number;
  readonly fencingToken: string;
}

export interface TruthLeaderDecision {
  readonly accepted: boolean;
  readonly reasonCode:
    | "truth_leader.accepted"
    | "truth_leader.tenant_mismatch"
    | "truth_leader.not_home_region"
    | "truth_leader.epoch_mismatch"
    | "truth_leader.fencing_token_mismatch";
}

export class CrossRegionTruthLeader {
  public evaluate(epoch: TruthLeaderEpoch, claim: TruthWriteClaim): TruthLeaderDecision {
    if (epoch.tenantId !== claim.tenantId) {
      return { accepted: false, reasonCode: "truth_leader.tenant_mismatch" };
    }
    if (epoch.homeRegion !== claim.region || epoch.leaderRegion !== claim.region) {
      return { accepted: false, reasonCode: "truth_leader.not_home_region" };
    }
    if (epoch.epoch !== claim.epoch) {
      return { accepted: false, reasonCode: "truth_leader.epoch_mismatch" };
    }
    if (epoch.fencingToken !== claim.fencingToken) {
      return { accepted: false, reasonCode: "truth_leader.fencing_token_mismatch" };
    }
    return { accepted: true, reasonCode: "truth_leader.accepted" };
  }
}
