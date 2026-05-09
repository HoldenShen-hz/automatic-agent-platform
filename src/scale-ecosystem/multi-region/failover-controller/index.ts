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
}

export interface RegionFailoverDecision {
  readonly shouldFailover: boolean;
  readonly targetRegionId: string | null;
  readonly rationale: string;
  readonly fencingEpoch: number;
  readonly demotedRegionId: string | null;
  readonly leaderState: "stable" | "promoted" | "demoted_previous_leader";
}

export interface FencingEpochState {
  readonly partitionKey: string;
  readonly fencingEpoch: number;
  readonly leaderRegionId: string | null;
  readonly demotedLeaderRegionId: string | null;
}

export class RegionFailoverController {
  private readonly stateByPartition = new Map<string, FencingEpochState>();

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

    if (!degraded || input.candidateRegionIds.length === 0) {
      this.stateByPartition.set(partitionKey, previous);
      return {
        shouldFailover: false,
        targetRegionId: null,
        rationale: degraded ? "multi_region.no_candidate_available" : "multi_region.primary_within_threshold",
        fencingEpoch: previous.fencingEpoch,
        demotedRegionId: null,
        leaderState: "stable",
      };
    }

    const targetRegionId = input.preferredRegionId && input.candidateRegionIds.includes(input.preferredRegionId)
      ? input.preferredRegionId
      : input.candidateRegionIds[0] ?? null;
    const demotedRegionId = previous.leaderRegionId != null && previous.leaderRegionId !== targetRegionId
      ? previous.leaderRegionId
      : input.currentLeaderRegionId ?? null;
    const nextState: FencingEpochState = {
      partitionKey,
      fencingEpoch: previous.fencingEpoch + 1,
      leaderRegionId: targetRegionId,
      demotedLeaderRegionId: demotedRegionId,
    };
    this.stateByPartition.set(partitionKey, nextState);
    return {
      shouldFailover: true,
      targetRegionId,
      rationale: !input.primaryHealthy
        ? "multi_region.primary_unhealthy"
        : latencyBreached
          ? "multi_region.primary_latency_breached"
          : "multi_region.primary_error_rate_breached",
      fencingEpoch: nextState.fencingEpoch,
      demotedRegionId,
      leaderState: demotedRegionId == null ? "promoted" : "demoted_previous_leader",
    };
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
