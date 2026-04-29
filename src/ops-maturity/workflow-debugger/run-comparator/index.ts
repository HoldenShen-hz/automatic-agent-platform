export interface RunSnapshot {
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly status: string;
  readonly latencyMs?: number;
  readonly outputHash?: string;
}

export interface RunComparisonDiff {
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly leftStatus: string;
  readonly rightStatus: string;
  readonly latencyDeltaMs: number | null;
  readonly outputChanged: boolean;
}

function resolveNodeRunId(snapshot: RunSnapshot): string {
  return snapshot.nodeRunId ?? snapshot.stepId ?? "";
}

export function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[] {
  const rightByStep = new Map(right.map((item) => [resolveNodeRunId(item), item.status]));
  return left
    .filter((item) => rightByStep.get(resolveNodeRunId(item)) !== item.status)
    .map((item) => `step:${resolveNodeRunId(item)}:${item.status}->${rightByStep.get(resolveNodeRunId(item)) ?? "missing"}`);
}

export function buildRunComparison(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): RunComparisonDiff[] {
  const rightByStep = new Map(right.map((item) => [resolveNodeRunId(item), item]));
  return left.map((item) => {
    const nodeRunId = resolveNodeRunId(item);
    const other = rightByStep.get(nodeRunId);
    return {
      nodeRunId,
      stepId: nodeRunId,
      leftStatus: item.status,
      rightStatus: other?.status ?? "missing",
      latencyDeltaMs: item.latencyMs != null && other?.latencyMs != null ? other.latencyMs - item.latencyMs : null,
      outputChanged: item.outputHash != null && other?.outputHash != null ? item.outputHash !== other.outputHash : false,
    };
  });
}
