export interface RegionFailoverInput {
  readonly primaryHealthy: boolean;
  readonly candidateRegionIds: readonly string[];
}

export interface RegionFailoverDecision {
  readonly shouldFailover: boolean;
  readonly targetRegionId: string | null;
}

export function resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision {
  if (input.primaryHealthy || input.candidateRegionIds.length === 0) {
    return { shouldFailover: false, targetRegionId: null };
  }
  return { shouldFailover: true, targetRegionId: input.candidateRegionIds[0] ?? null };
}
