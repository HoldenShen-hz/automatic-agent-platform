export interface RunSnapshot {
  readonly stepId?: string;
  readonly nodeRunId?: string;
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
  const diffs: string[] = [];

  // Build lookup for right side
  const rightByStep = new Map(right.map((item) => [item.nodeRunId ?? item.stepId ?? "", item.status]));

  // Left → Right: detect steps that differ or are missing from right
  for (const item of left) {
    const stepId = item.nodeRunId ?? item.stepId ?? "";
    const rightStatus = rightByStep.get(stepId);
    if (rightStatus == null) {
      diffs.push(item.nodeRunId != null
        ? `step:${stepId}:missing_in_right`
        : `step:${stepId}:${item.status}->missing`);
    } else if (rightStatus !== item.status) {
      diffs.push(item.nodeRunId != null
        ? `step:${stepId}:status:${item.status}->${rightStatus}`
        : `step:${stepId}:${item.status}->${rightStatus}`);
    }
  }

  // Right → Left: detect steps that exist only in right (missing from left)
  const leftByStep = new Map(left.map((item) => [item.nodeRunId ?? item.stepId ?? "", true]));
  for (const item of right) {
    const stepId = item.nodeRunId ?? item.stepId ?? "";
    if (!leftByStep.has(stepId)) {
      diffs.push(item.nodeRunId != null
        ? `step:${stepId}:missing_in_left`
        : `step:${stepId}:missing->${item.status}`);
    }
  }

  return diffs;
}

export function buildRunComparison(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): RunComparisonDiff[] {
  // Build lookup for right side using composite key (nodeRunId preferred over stepId)
  const rightByStep = new Map(right.map((item) => [item.nodeRunId ?? item.stepId ?? "", item]));

  // Collect all unique stepIds (by composite key) from both sides
  const allStepIds = new Set<string>();
  for (const item of left) {
    const key = item.nodeRunId ?? item.stepId ?? "";
    if (key) allStepIds.add(key);
  }
  for (const item of right) {
    const key = item.nodeRunId ?? item.stepId ?? "";
    if (key) allStepIds.add(key);
  }

  const diffs: RunComparisonDiff[] = [];

  for (const stepId of allStepIds) {
    const leftItem = left.find((item) => (item.nodeRunId ?? item.stepId ?? "") === stepId);
    const rightItem = rightByStep.get(stepId);

    diffs.push({
      stepId: stepId ?? "",
      leftStatus: leftItem?.status ?? "missing",
      rightStatus: rightItem?.status ?? "missing",
      latencyDeltaMs:
        leftItem?.latencyMs != null && rightItem?.latencyMs != null
          ? rightItem.latencyMs - leftItem.latencyMs
          : null,
      outputChanged:
        leftItem?.outputHash != null && rightItem?.outputHash != null
          ? leftItem.outputHash !== rightItem.outputHash
          : false,
    });
  }

  return diffs;
}
