/**
 * Region failover input with consensus support
 */
export interface RegionFailoverInput {
  readonly primaryHealthy: boolean;
  readonly candidateRegionIds: readonly string[];
  readonly currentLeaderRegionId?: string | null;
  readonly partitionKey?: string | null;
  readonly primaryLatencyMs?: number;
  readonly maxAcceptableLatencyMs?: number;
  readonly primaryErrorRate?: number;
  readonly maxAcceptableErrorRate?: number;
  readonly preferredRegionId?: string | null;
  /** Quorum-based consensus for failover decision */
  readonly quorumRegions?: readonly string[];
  readonly minQuorumWeight?: number;
  /**
   * Explicit promote epoch for failover sequencing.
   * New leader must acknowledge this epoch before accepting writes.
   * Old leader's rejoin is rejected if it offers a lower epoch.
   */
  readonly promoteEpoch?: number;
  /**
   * If true, forces demotion of the current leader even if other conditions are not met.
   * Used when manual failover is required.
   */
  readonly forceDemote?: boolean;
}

/**
 * Quorum vote for failover consensus
 */
export interface QuorumVote {
  readonly regionId: string;
  readonly vote: "promote" | "demote" | "abstain";
  readonly weight: number;
  readonly timestamp: string;
  readonly reason?: string;
}

/**
 * Consensus decision result
 */
export interface ConsensusDecision {
  readonly decided: boolean;
  readonly votesFor: number;
  readonly votesAgainst: number;
  readonly abstains: number;
  readonly totalWeight: number;
  readonly requiredWeight: number;
  readonly consensusReached: boolean;
}

export interface RegionFailoverDecision {
  readonly shouldFailover: boolean;
  readonly targetRegionId: string | null;
  readonly rationale: string;
  readonly fencingEpoch: number;
  readonly demotedRegionId: string | null;
  readonly leaderState: "stable" | "promoted" | "demoted_previous_leader";
  /** Consensus information for the decision */
  readonly consensus?: ConsensusDecision;
}

export interface FencingEpochState {
  readonly partitionKey: string;
  readonly fencingEpoch: number;
  readonly leaderRegionId: string | null;
  readonly demotedLeaderRegionId: string | null;
}

/**
 * RejectRegionJoinInput - request to check if a region can join with the given fencing epoch
 */
export interface RejectRegionJoinInput {
  readonly regionId: string;
  readonly offeredFencingEpoch: number;
  readonly partitionKey: string;
}

/**
 * Region join rejection result - enforces that demoted leaders rejoin only as followers
 */
export interface RejectRegionJoinResult {
  readonly accepted: boolean;
  readonly reason: string;
  readonly currentFencingEpoch: number;
  readonly mustRejoinAsFollower: boolean;
}

export class RegionFailoverController {
  private readonly stateByPartition = new Map<string, FencingEpochState>();
  private readonly quorumVotes = new Map<string, QuorumVote[]>();

  /**
   * Enforce fencing: after failover, demoted leader must rejoin as follower.
   * If the region was previously the leader and offers a stale epoch, reject it.
   */
  public rejectRegionJoin(input: RejectRegionJoinInput): RejectRegionJoinResult {
    const state = this.stateByPartition.get(input.partitionKey ?? "global");
    if (state == null) {
      return {
        accepted: true,
        reason: "no_fencing_epoch_recorded",
        currentFencingEpoch: 0,
        mustRejoinAsFollower: false,
      };
    }
    const currentEpoch = state.fencingEpoch;
    const wasDemotedLeader = state.demotedLeaderRegionId === input.regionId;
    if (!wasDemotedLeader) {
      return {
        accepted: true,
        reason: "region_was_not_demoted_leader",
        currentFencingEpoch: currentEpoch,
        mustRejoinAsFollower: false,
      };
    }
    // Demoted leader must offer the current (incremented) epoch to rejoin
    const stale = input.offeredFencingEpoch < currentEpoch;
    const mustRejoinAsFollower = stale || input.offeredFencingEpoch === currentEpoch;
    return {
      accepted: !stale,
      reason: stale
        ? "fencing_epoch_stale_demoted_leader_must_offfer_current_epoch"
        : "fencing_epoch_ok_must_rejoin_as_follower",
      currentFencingEpoch: currentEpoch,
      mustRejoinAsFollower,
    };
  }

  /**
   * Cast a quorum vote for failover consensus
   */
  public castVote(partitionKey: string, vote: QuorumVote): void {
    const key = partitionKey ?? "global";
    const votes = this.quorumVotes.get(key) ?? [];
    // Replace existing vote from same region
    const filtered = votes.filter((v) => v.regionId !== vote.regionId);
    filtered.push(vote);
    this.quorumVotes.set(key, filtered);
  }

  /**
   * Evaluate consensus for a partition
   */
  public evaluateConsensus(partitionKey: string, minQuorumWeight = 0.5): ConsensusDecision {
    const key = partitionKey ?? "global";
    const votes = this.quorumVotes.get(key) ?? [];

    let votesFor = 0;
    let votesAgainst = 0;
    let abstains = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      totalWeight += vote.weight;
      switch (vote.vote) {
        case "promote":
          votesFor += vote.weight;
          break;
        case "demote":
          votesAgainst += vote.weight;
          break;
        case "abstain":
          abstains += vote.weight;
          break;
      }
    }

    const requiredWeight = totalWeight * minQuorumWeight;
    const consensusReached = votesFor >= requiredWeight && votesAgainst < requiredWeight;

    return {
      decided: consensusReached || votesAgainst >= requiredWeight,
      votesFor,
      votesAgainst,
      abstains,
      totalWeight,
      requiredWeight,
      consensusReached,
    };
  }

  public resolve(input: RegionFailoverInput): RegionFailoverDecision {
    const partitionKey = input.partitionKey ?? "global";
    const previous = this.stateByPartition.get(partitionKey) ?? {
      partitionKey,
      fencingEpoch: 0,
      leaderRegionId: input.currentLeaderRegionId ?? null,
      demotedLeaderRegionId: null,
    };
    const latencyBreached = input.primaryLatencyMs != null
      && input.maxAcceptableLatencyMs != null
      && input.primaryLatencyMs > input.maxAcceptableLatencyMs;
    const errorRateBreached = input.primaryErrorRate != null
      && input.maxAcceptableErrorRate != null
      && input.primaryErrorRate > input.maxAcceptableErrorRate;
    const degraded = !input.primaryHealthy || latencyBreached || errorRateBreached;
    const forceDemote = input.forceDemote ?? false;

    // Determine if failover should occur: conditions met OR forced demotion
    const shouldFailoverReason = forceDemote
      ? "multi_region.forced_demotion"
      : degraded
        ? (!input.primaryHealthy
          ? "multi_region.primary_unhealthy"
          : latencyBreached
            ? "multi_region.primary_latency_breached"
            : "multi_region.primary_error_rate_breached")
        : null;

    if ((!degraded && !forceDemote) || input.candidateRegionIds.length === 0) {
      this.stateByPartition.set(partitionKey, previous);
      return {
        shouldFailover: false,
        targetRegionId: null,
        rationale: forceDemote ? "multi_region.forced_demotion_no_candidates" : (degraded ? "multi_region.no_candidate_available" : "multi_region.primary_within_threshold"),
        fencingEpoch: previous.fencingEpoch,
        demotedRegionId: null,
        leaderState: "stable",
      };
    }

    // Evaluate quorum-based consensus if quorum regions provided
    let consensus: ConsensusDecision | undefined;
    if (input.quorumRegions && input.quorumRegions.length > 0) {
      const minWeight = input.minQuorumWeight ?? 0.5;
      consensus = this.evaluateConsensus(partitionKey, minWeight);

      // Require consensus for failover (unless forced)
      if (!consensus.consensusReached && !forceDemote) {
        return {
          shouldFailover: false,
          targetRegionId: null,
          rationale: "multi_region.no_consensus",
          fencingEpoch: previous.fencingEpoch,
          demotedRegionId: null,
          leaderState: "stable",
          consensus,
        };
      }
    }

    const targetRegionId = input.preferredRegionId && input.candidateRegionIds.includes(input.preferredRegionId)
      ? input.preferredRegionId
      : input.candidateRegionIds[0] ?? null;

    // Demoted leader is the previous leader (not null) that differs from target
    const demotedRegionId = previous.leaderRegionId != null && previous.leaderRegionId !== targetRegionId
      ? previous.leaderRegionId
      : forceDemote && input.currentLeaderRegionId != null
        ? input.currentLeaderRegionId
        : null;

    // Use explicit promoteEpoch if provided, otherwise increment from current
    const effectivePromoteEpoch = input.promoteEpoch ?? (previous.fencingEpoch + 1);
    const nextState: FencingEpochState = {
      partitionKey,
      fencingEpoch: effectivePromoteEpoch,
      leaderRegionId: targetRegionId,
      demotedLeaderRegionId: demotedRegionId,
    };
    this.stateByPartition.set(partitionKey, nextState);
    const result: RegionFailoverDecision = {
      shouldFailover: true,
      targetRegionId,
      rationale: shouldFailoverReason ?? "multi_region.forced_failover",
      fencingEpoch: effectivePromoteEpoch,
      demotedRegionId,
      leaderState: demotedRegionId == null ? "promoted" : "demoted_previous_leader",
      ...(consensus !== undefined ? { consensus } : {}),
    };
    return result;
  }

  public getState(partitionKey = "global"): FencingEpochState | null {
    return this.stateByPartition.get(partitionKey) ?? null;
  }
}

const defaultFailoverController = new RegionFailoverController();

export function getNextFencingEpoch(partitionKey = "global"): number {
  return (defaultFailoverController.getState(partitionKey)?.fencingEpoch ?? 0) + 1;
}

export function resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision {
  return defaultFailoverController.resolve(input);
}
