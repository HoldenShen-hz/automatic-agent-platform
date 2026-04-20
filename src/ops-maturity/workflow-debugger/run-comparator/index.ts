export interface RunSnapshot {
  readonly stepId: string;
  readonly status: string;
}

export function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[] {
  const rightByStep = new Map(right.map((item) => [item.stepId, item.status]));
  return left
    .filter((item) => rightByStep.get(item.stepId) !== item.status)
    .map((item) => `step:${item.stepId}:${item.status}->${rightByStep.get(item.stepId) ?? "missing"}`);
}
