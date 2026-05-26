export interface CanonicalLoadScoreInput {
  readonly activeCount: number;
  readonly maxConcurrency: number;
  readonly saturation: number | null;
  readonly backlogCount: number;
  readonly cpuPct: number | null;
}

export interface CanonicalLoadScoreWeights {
  readonly backlogWeight?: number;
  readonly cpuWeight?: number;
  readonly backlogCapRatio?: number;
}

const DEFAULT_WEIGHTS: Required<CanonicalLoadScoreWeights> = {
  backlogWeight: 0.1,
  cpuWeight: 0.2,
  backlogCapRatio: 4,
};

export function computeCanonicalLoadScore(
  input: CanonicalLoadScoreInput,
  weights: CanonicalLoadScoreWeights = {},
): number {
  const config = { ...DEFAULT_WEIGHTS, ...weights };
  const concurrency = Math.max(1, Math.trunc(input.maxConcurrency));
  const activeRatio = Math.max(0, input.activeCount) / concurrency;
  const normalizedSaturation = input.saturation == null ? activeRatio : Math.max(0, input.saturation);
  const normalizedBacklog = Math.min(Math.max(0, input.backlogCount) / concurrency, config.backlogCapRatio);
  const normalizedCpu = input.cpuPct == null ? 0 : Math.min(Math.max(input.cpuPct, 0), 100) / 100;

  return Math.max(activeRatio, normalizedSaturation) + (normalizedBacklog * config.backlogWeight) + (normalizedCpu * config.cpuWeight);
}
