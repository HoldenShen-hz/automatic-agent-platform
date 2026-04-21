export interface RunSnapshot {
  readonly stepId: string;
  readonly status: string;
  readonly latencyMs?: number;
  readonly outputHash?: string;
}

export interface RunComparisonDiff {
  readonly stepId: string;
  readonly leftStatus: string;
  readonly rightStatus: string;
  readonly latencyDeltaMs: number | null;
  readonly outputChanged: boolean;
}

export function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[] {
  const rightByStep = new Map(right.map((item) => [item.stepId, item.status]));
  return left
    .filter((item) => rightByStep.get(item.stepId) !== item.status)
    .map((item) => `step:${item.stepId}:${item.status}->${rightByStep.get(item.stepId) ?? "missing"}`);
}

export function buildRunComparison(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): RunComparisonDiff[] {
  const rightByStep = new Map(right.map((item) => [item.stepId, item]));
  return left.map((item) => {
    const other = rightByStep.get(item.stepId);
    return {
      stepId: item.stepId,
      leftStatus: item.status,
      rightStatus: other?.status ?? "missing",
      latencyDeltaMs: item.latencyMs != null && other?.latencyMs != null ? other.latencyMs - item.latencyMs : null,
      outputChanged: item.outputHash != null && other?.outputHash != null ? item.outputHash !== other.outputHash : false,
    };
  });
}
