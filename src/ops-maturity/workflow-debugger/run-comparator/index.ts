export interface RunSnapshot {
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly status: string;
  readonly decision?: string;
  readonly cost?: number;
  readonly durationMs?: number;
  readonly outcome?: string;
  readonly latencyMs?: number;
  readonly outputHash?: string;
  /** §65.1: Side effects produced by this run step */
  readonly sideEffects?: readonly SideEffectRecord[];
}

export interface SideEffectRecord {
  readonly effectId: string;
  readonly effectType: string;
  readonly targetResource: string;
  readonly outcome: "created" | "updated" | "deleted" | "accessed" | "failed";
  readonly timestamp: string;
}

/**
 * §65.1: Side-effect diff between expected and actual runs.
 * Shows the delta between expected vs actual side effects.
 */
export interface SideEffectDiff {
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly expectedEffects: readonly SideEffectRecord[];
  readonly actualEffects: readonly SideEffectRecord[];
  readonly addedEffects: readonly SideEffectRecord[];
  readonly missingEffects: readonly SideEffectRecord[];
  readonly modifiedEffects: readonly ModifiedSideEffect[];
  readonly diffSummary: string;
}

export interface ModifiedSideEffect {
  readonly effectId: string;
  readonly effectType: string;
  readonly expectedOutcome: SideEffectRecord["outcome"];
  readonly actualOutcome: SideEffectRecord["outcome"];
  readonly expectedResource: string;
  readonly actualResource: string;
}

export interface RunComparisonDiff {
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly leftStatus: string;
  readonly rightStatus: string;
  readonly statusChanged: boolean;
  readonly leftDecision: string | null;
  readonly rightDecision: string | null;
  readonly decisionChanged: boolean;
  readonly leftCost: number | null;
  readonly rightCost: number | null;
  readonly costDelta: number | null;
  readonly leftDurationMs: number | null;
  readonly rightDurationMs: number | null;
  readonly durationDeltaMs: number | null;
  readonly leftOutcome: string | null;
  readonly rightOutcome: string | null;
  readonly outcomeChanged: boolean;
  readonly latencyDeltaMs: number | null;
  readonly outputChanged: boolean;
}

function resolveNodeRunId(snapshot: RunSnapshot): string {
  return snapshot.nodeRunId ?? snapshot.stepId ?? "";
}

export function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[] {
  const rightByStep = new Map(right.map((item) => [resolveNodeRunId(item), item]));
  const diffs: string[] = [];
  for (const item of left) {
    const nodeRunId = resolveNodeRunId(item);
    const other = rightByStep.get(nodeRunId);
    if (other) {
      if (item.status !== other.status) {
        diffs.push(`step:${nodeRunId}:status:${item.status}->${other.status}`);
      }
      if (item.decision !== other.decision) {
        diffs.push(`step:${nodeRunId}:decision:${item.decision ?? "null"}->${other.decision ?? "null"}`);
      }
      if (item.cost !== other.cost) {
        diffs.push(`step:${nodeRunId}:cost:${item.cost ?? "null"}->${other.cost ?? "null"}`);
      }
      if (item.durationMs !== other.durationMs) {
        diffs.push(`step:${nodeRunId}:duration:${item.durationMs ?? "null"}->${other.durationMs ?? "null"}`);
      }
      if (item.outcome !== other.outcome) {
        diffs.push(`step:${nodeRunId}:outcome:${item.outcome ?? "null"}->${other.outcome ?? "null"}`);
      }
    } else {
      diffs.push(`step:${nodeRunId}:missing_in_right`);
    }
  }
  return diffs;
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
      statusChanged: other ? item.status !== other.status : true,
      leftDecision: item.decision ?? null,
      rightDecision: other?.decision ?? null,
      decisionChanged: other ? item.decision !== other.decision : true,
      leftCost: item.cost ?? null,
      rightCost: other?.cost ?? null,
      costDelta: item.cost != null && other?.cost != null ? other.cost - item.cost : null,
      leftDurationMs: item.durationMs ?? null,
      rightDurationMs: other?.durationMs ?? null,
      durationDeltaMs: item.durationMs != null && other?.durationMs != null ? other.durationMs - item.durationMs : null,
      leftOutcome: item.outcome ?? null,
      rightOutcome: other?.outcome ?? null,
      outcomeChanged: other ? item.outcome !== other.outcome : true,
      latencyDeltaMs: item.latencyMs != null && other?.latencyMs != null ? other.latencyMs - item.latencyMs : null,
      outputChanged: item.outputHash != null && other?.outputHash != null ? item.outputHash !== other.outputHash : false,
    };
  });
}

/**
 * §65.1: Computes side-effect diff between expected (left) and actual (right) runs.
 * Returns detailed delta showing added, missing, and modified side effects.
 */
export function buildSideEffectDiff(
  expected: readonly RunSnapshot[],
  actual: readonly RunSnapshot[],
): SideEffectDiff[] {
  const actualByStep = new Map(actual.map((item) => [resolveNodeRunId(item), item.sideEffects ?? []]));
  return expected.map((item) => {
    const nodeRunId = resolveNodeRunId(item);
    const actualEffects = actualByStep.get(nodeRunId) ?? [];
    const expectedEffects = item.sideEffects ?? [];

    return computeSideEffectDiffForStep(nodeRunId, expectedEffects, actualEffects);
  });
}

/**
 * §65.1: Computes side-effect diff for a single step.
 */
function computeSideEffectDiffForStep(
  nodeRunId: string,
  expectedEffects: readonly SideEffectRecord[],
  actualEffects: readonly SideEffectRecord[],
): SideEffectDiff {
  const expectedById = new Map(expectedEffects.map((e) => [e.effectId, e]));
  const actualById = new Map(actualEffects.map((e) => [e.effectId, e]));

  // Effects that are in actual but not in expected (added)
  const addedEffects = actualEffects.filter((e) => !expectedById.has(e.effectId));

  // Effects that are in expected but not in actual (missing)
  const missingEffects = expectedEffects.filter((e) => !actualById.has(e.effectId));

  // Effects that exist in both but have different outcomes or resources (modified)
  const modifiedEffects: ModifiedSideEffect[] = [];
  expectedById.forEach((expectedEffect, effectId) => {
    const actualEffect = actualById.get(effectId);
    if (actualEffect) {
      const isModified =
        expectedEffect.outcome !== actualEffect.outcome
        || expectedEffect.targetResource !== actualEffect.targetResource
        || expectedEffect.effectType !== actualEffect.effectType;
      if (isModified) {
        modifiedEffects.push({
          effectId,
          effectType: expectedEffect.effectType,
          expectedOutcome: expectedEffect.outcome,
          actualOutcome: actualEffect.outcome,
          expectedResource: expectedEffect.targetResource,
          actualResource: actualEffect.targetResource,
        });
      }
    }
  });

  const diffSummary = buildSideEffectDiffSummary(addedEffects, missingEffects, modifiedEffects);

  return {
    nodeRunId,
    stepId: nodeRunId,
    expectedEffects,
    actualEffects,
    addedEffects,
    missingEffects,
    modifiedEffects,
    diffSummary,
  };
}

/**
 * §65.1: Builds a human-readable summary of the side-effect diff.
 */
function buildSideEffectDiffSummary(
  addedEffects: readonly SideEffectRecord[],
  missingEffects: readonly SideEffectRecord[],
  modifiedEffects: readonly ModifiedSideEffect[],
): string {
  const parts: string[] = [];
  if (addedEffects.length > 0) {
    parts.push(`+${addedEffects.length} added`);
  }
  if (missingEffects.length > 0) {
    parts.push(`-${missingEffects.length} missing`);
  }
  if (modifiedEffects.length > 0) {
    parts.push(`~${modifiedEffects.length} modified`);
  }
  if (parts.length === 0) {
    return "side_effects:identical";
  }
  return `side_effects:${parts.join(",")}`;
}

/**
 * §65.1: Returns true if there are any side-effect differences between expected and actual.
 */
export function hasSideEffectDifferences(diff: SideEffectDiff): boolean {
  return (
    diff.addedEffects.length > 0
    || diff.missingEffects.length > 0
    || diff.modifiedEffects.length > 0
  );
}
