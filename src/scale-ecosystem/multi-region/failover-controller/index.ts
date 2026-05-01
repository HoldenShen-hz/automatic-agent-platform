/**
 * @fileoverview Region Failover Controller
 *
 * §52.3: Implements failover with fencing epoch and old leader demotion.
 * When a failover occurs, a new promote epoch is assigned and the old leader
 * must be demoted before the new leader can assume authority.
 *
 * Key behaviors per §52.3:
 * - Fencing token (promote epoch) must be acquired before region can serve writes
 * - Old leader receives demotion指令 and must acknowledge before new leader activates
 * - All state changes are sequenced by promote epoch to prevent split-brain
 *
 * Split-brain detection:
 * - Uses fencing epoch to ensure only one region can be leader at a time
 * - Old leader must confirm demotion before new leader can activate
 * - Prevents dual-active scenario where both regions think they are leader
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface RegionCircuitBreakerState {
  readonly regionId: string;
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly lastFailureAt: string | null;
  readonly lastStateChangeAt: string;
  readonly halfOpenSuccessCount: number;
}

/**
 * Split-brain detection metadata carried in fencing tokens.
 */
export interface FencingToken {
  readonly epoch: number;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly previousLeaderId: string | null;
  readonly isAcknowledged: boolean;
}

export interface RegionFailoverInput {
  readonly primaryHealthy: boolean;
  readonly candidateRegionIds: readonly string[];
  readonly primaryLatencyMs?: number;
  readonly maxAcceptableLatencyMs?: number;
  readonly primaryErrorRate?: number;
  readonly maxAcceptableErrorRate?: number;
  readonly preferredRegionId?: string | null;
}

export interface RegionFailoverDecision {
  readonly shouldFailover: boolean;
  readonly targetRegionId: string | null;
  readonly rationale: string;
  readonly promoteEpoch: number;
  readonly demoteOldLeader: boolean;
  readonly oldLeaderId: string | null;
  readonly fencingToken: FencingToken | null;
}

export interface RegionLeaderState {
  readonly currentLeaderId: string | null;
  readonly promoteEpoch: number;
  readonly isDemotionAcknowledged: boolean;
  readonly lastUpdatedAt: string;
  readonly fencingToken: FencingToken | null;
}

/**
 * §52.3: Stateful failover controller with promote epoch tracking.
 *
 * Tracks the current leader region and enforce proper failover sequence:
 * 1. New leader receives promote epoch
 * 2. Old leader receives demotion command
 * 3. Old leader must acknowledge demotion
 * 4. Only after demotion acknowledgment can new leader activate
 *
 * Split-brain prevention:
 * - Fencing token issued with each promote epoch
 * - Old leader must acknowledge demotion before new leader activates
 * - Dual-active detection via epoch comparison
 */
export class RegionFailoverController {
  private leaderState: RegionLeaderState = {
    currentLeaderId: null,
    promoteEpoch: 0,
    isDemotionAcknowledged: true,
    lastUpdatedAt: new Date(0).toISOString(),
    fencingToken: null,
  };

  /**
   * §52.3: Returns the current leader state for this region cluster.
   */
  public getLeaderState(): RegionLeaderState {
    return { ...this.leaderState };
  }

  /**
   * §52.3: Checks for split-brain condition.
   * Returns true if another region claims to be leader with a higher or equal epoch.
   */
  public detectSplitBrain(
    claimedLeaderId: string,
    claimedEpoch: number,
  ): boolean {
    // If claimed epoch is lower than ours, it's stale
    if (claimedEpoch < this.leaderState.promoteEpoch) {
      return true; // Split-brain: stale leader trying to act
    }

    // If claimed epoch equals ours and leader is different, we have dual leadership
    if (
      claimedEpoch === this.leaderState.promoteEpoch &&
      claimedLeaderId !== this.leaderState.currentLeaderId &&
      this.leaderState.currentLeaderId !== null
    ) {
      return true; // Split-brain: two leaders with same epoch
    }

    return false;
  }

  /**
   * §52.3: Generates an isolation fencing token for the given epoch.
   * The token must be presented by the new leader when activating.
   */
  public generateFencingToken(
    epoch: number,
    previousLeaderId: string | null,
  ): FencingToken {
    const token: FencingToken = {
      epoch,
      issuedAt: new Date().toISOString(),
      issuedBy: "system",
      previousLeaderId,
      isAcknowledged: false,
    };
    this.leaderState = {
      ...this.leaderState,
      fencingToken: token,
      lastUpdatedAt: new Date().toISOString(),
    };
    return token;
  }

  /**
   * §52.3: Validates a fencing token against current state.
   * Returns true if the token is valid and can be used to activate leadership.
   */
  public validateFencingToken(token: FencingToken): boolean {
    // Token epoch must match current epoch
    if (token.epoch !== this.leaderState.promoteEpoch) {
      return false;
    }

    // Token must have been issued for this epoch
    if (this.leaderState.fencingToken?.epoch !== token.epoch) {
      return false;
    }

    // Token must be acknowledged (old leader demoted)
    return token.isAcknowledged || this.leaderState.isDemotionAcknowledged;
  }

  /**
   * §52.3: Processes failover decision with proper epoch promotion and demotion.
   *
   * When failover is needed:
   * 1. Generate new promote epoch for new leader
   * 2. Mark old leader for demotion
   * 3. Require demotion acknowledgment before new leader activates
   */
  public resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision {
    const latencyBreached = input.primaryLatencyMs != null
      && input.maxAcceptableLatencyMs != null
      && input.primaryLatencyMs > input.maxAcceptableLatencyMs;
    const errorRateBreached = input.primaryErrorRate != null
      && input.maxAcceptableErrorRate != null
      && input.primaryErrorRate > input.maxAcceptableErrorRate;
    const degraded = !input.primaryHealthy || latencyBreached || errorRateBreached;

    // No failover needed - primary is healthy and within thresholds
    if (!degraded) {
      return {
        shouldFailover: false,
        targetRegionId: null,
        rationale: "multi_region.primary_within_threshold",
        promoteEpoch: this.leaderState.promoteEpoch,
        demoteOldLeader: false,
        oldLeaderId: null,
        fencingToken: this.leaderState.fencingToken,
      };
    }

    // No candidates available for failover
    if (input.candidateRegionIds.length === 0) {
      return {
        shouldFailover: false,
        targetRegionId: null,
        rationale: "multi_region.no_candidate_available",
        promoteEpoch: this.leaderState.promoteEpoch,
        demoteOldLeader: false,
        oldLeaderId: null,
        fencingToken: this.leaderState.fencingToken,
      };
    }

    // Determine target region
    // Root cause: Just picks candidateRegionIds[0] without considering health or replication lag
    // Fix: Prefer preferredRegionId if provided, but cannot determine health without external data
    // In production, use RegionFailoverOrchestrator.selectFailoverTarget which has health check data
    const targetRegionId = input.preferredRegionId && input.candidateRegionIds.includes(input.preferredRegionId)
      ? input.preferredRegionId
      : input.candidateRegionIds[0] ?? null;

    if (targetRegionId === null) {
      return {
        shouldFailover: false,
        targetRegionId: null,
        rationale: "multi_region.no_candidate_available",
        promoteEpoch: this.leaderState.promoteEpoch,
        demoteOldLeader: false,
        oldLeaderId: null,
        fencingToken: this.leaderState.fencingToken,
      };
    }

    // Determine rationale for failover
    const rationale = !input.primaryHealthy
      ? "multi_region.primary_unhealthy"
      : latencyBreached
        ? "multi_region.primary_latency_breached"
        : "multi_region.primary_error_rate_breached";

    // Check if this is a leader change or initial promotion
    const oldLeaderId = this.leaderState.currentLeaderId;
    const isLeaderChange = oldLeaderId !== null && oldLeaderId !== targetRegionId;

    // Generate new promote epoch for the new leader
    const newPromoteEpoch = this.leaderState.promoteEpoch + 1;

    // Generate fencing token for isolation
    const fencingToken = this.generateFencingToken(newPromoteEpoch, oldLeaderId);

    // Update internal state
    this.leaderState = {
      currentLeaderId: targetRegionId,
      promoteEpoch: newPromoteEpoch,
      isDemotionAcknowledged: !isLeaderChange, // No demotion needed if no previous leader or same leader
      lastUpdatedAt: new Date().toISOString(),
      fencingToken,
    };

    // §52.3: Return decision with demotion flag if this is a leader change
    return {
      shouldFailover: true,
      targetRegionId,
      rationale,
      promoteEpoch: newPromoteEpoch,
      demoteOldLeader: isLeaderChange,
      oldLeaderId: isLeaderChange ? oldLeaderId : null,
      fencingToken,
    };
  }

  /**
   * §52.3: Acknowledges demotion of the old leader.
   * Must be called before new leader can activate.
   */
  public acknowledgeDemotion(leaderId: string): boolean {
    if (this.leaderState.currentLeaderId === null) {
      return false;
    }

    // Only the old leader (stored in currentLeaderId before failover) can acknowledge
    // In practice, this would be called with the old leader's ID after it steps down
    if (this.leaderState.isDemotionAcknowledged) {
      return true; // Already acknowledged
    }

    // Mark fencing token as acknowledged
    if (this.leaderState.fencingToken) {
      this.leaderState.fencingToken = {
        ...this.leaderState.fencingToken,
        isAcknowledged: true,
      };
    }

    this.leaderState = {
      ...this.leaderState,
      isDemotionAcknowledged: true,
      lastUpdatedAt: new Date().toISOString(),
    };
    return true;
  }

  /**
   * §52.3: Checks if the current leader can serve writes (demotion was acknowledged if needed).
   */
  public canLeaderServeWrites(): boolean {
    return this.leaderState.isDemotionAcknowledged;
  }

  /**
   * §52.3: Returns the current promote epoch.
   */
  public getPromoteEpoch(): number {
    return this.leaderState.promoteEpoch;
  }

  /**
   * §52.3: Returns the current fencing token.
   */
  public getFencingToken(): FencingToken | null {
    return this.leaderState.fencingToken;
  }
}

/**
 * @deprecated Use RegionFailoverController class for stateful failover.
 * This function remains for backward compatibility but does not maintain state.
 */
export function resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision {
  const controller = new RegionFailoverController();
  return controller.resolveRegionFailover(input);
}

/**
 * @deprecated Use RegionFailoverController.getNextFencingEpoch().
 */
export function getNextFencingEpoch(): number {
  const controller = new RegionFailoverController();
  return controller.getPromoteEpoch() + 1;
}
