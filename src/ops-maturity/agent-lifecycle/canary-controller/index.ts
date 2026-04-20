export interface CanaryProgress {
  readonly rolloutPercent: number;
  readonly successRate: number;
}

export function shouldPromoteCanary(progress: CanaryProgress): boolean {
  return progress.rolloutPercent >= 25 && progress.successRate >= 0.99;
}
