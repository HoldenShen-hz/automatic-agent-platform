export interface SideEffectRecord {
  readonly effectId: string;
  readonly effectType: string;
  readonly targetResource: string;
  readonly outcome: string;
  readonly timestamp: string;
}

export interface RunSnapshot {
  readonly stepId?: string;
  readonly nodeRunId?: string;
  readonly status?: string;
  readonly decision?: string;
  readonly cost?: number;
  readonly latencyMs?: number;
  readonly durationMs?: number;
  readonly outputHash?: string;
  readonly sideEffects?: readonly SideEffectRecord[];
}

export interface RunComparisonDiff {
  readonly stepId: string;
  readonly nodeRunId: string;
  readonly leftStatus: string;
  readonly rightStatus: string;
  readonly statusChanged: boolean;
  readonly leftDecision: string;
  readonly rightDecision: string;
  readonly decisionChanged: boolean;
  readonly costDelta: number | null;
  readonly latencyDeltaMs: number | null;
  readonly durationDeltaMs: number | null;
  readonly outputChanged: boolean;
}

export interface ModifiedSideEffectRecord extends SideEffectRecord {
  readonly expectedOutcome: string;
  readonly actualOutcome: string;
}

export interface SideEffectDiff {
  readonly nodeRunId: string;
  readonly expectedEffects: readonly SideEffectRecord[];
  readonly actualEffects: readonly SideEffectRecord[];
  readonly addedEffects: readonly SideEffectRecord[];
  readonly missingEffects: readonly SideEffectRecord[];
  readonly modifiedEffects: readonly ModifiedSideEffectRecord[];
  readonly diffSummary: string;
}

function getRunKey(item: RunSnapshot): string {
  return item.nodeRunId ?? item.stepId ?? "";
}

export function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[] {
  const diffs: string[] = [];
  const rightByStep = new Map(right.map((item) => [getRunKey(item), item] as const));

  for (const leftItem of left) {
    const stepId = getRunKey(leftItem);
    const rightItem = rightByStep.get(stepId);
    if (!rightItem) {
      diffs.push(leftItem.nodeRunId != null
        ? `step:${stepId}:missing_in_right`
        : `step:${stepId}:${leftItem.status ?? "missing"}->missing`);
      continue;
    }
    if (leftItem.status !== rightItem.status && (leftItem.status != null || rightItem.status != null)) {
      diffs.push(leftItem.nodeRunId != null
        ? `step:${stepId}:status:${leftItem.status ?? "missing"}->${rightItem.status ?? "missing"}`
        : `step:${stepId}:${leftItem.status ?? "missing"}->${rightItem.status ?? "missing"}`);
    }
    if (leftItem.decision !== rightItem.decision && (leftItem.decision != null || rightItem.decision != null)) {
      diffs.push(`step:${stepId}:decision:${leftItem.decision ?? "missing"}->${rightItem.decision ?? "missing"}`);
    }
    if (leftItem.cost !== rightItem.cost && (leftItem.cost != null || rightItem.cost != null)) {
      diffs.push(`step:${stepId}:cost:${leftItem.cost ?? "missing"}->${rightItem.cost ?? "missing"}`);
    }
    const leftDuration = leftItem.durationMs ?? leftItem.latencyMs;
    const rightDuration = rightItem.durationMs ?? rightItem.latencyMs;
    if (leftDuration !== rightDuration && (leftDuration != null || rightDuration != null)) {
      diffs.push(`step:${stepId}:duration:${leftDuration ?? "missing"}->${rightDuration ?? "missing"}`);
    }
  }

  const leftByStep = new Set(left.map((item) => getRunKey(item)));
  for (const rightItem of right) {
    const stepId = getRunKey(rightItem);
    if (!leftByStep.has(stepId)) {
      diffs.push(rightItem.nodeRunId != null
        ? `step:${stepId}:missing_in_left`
        : `step:${stepId}:missing->${rightItem.status ?? "missing"}`);
    }
  }
  return diffs;
}

export function buildRunComparison(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): RunComparisonDiff[] {
  const leftByStep = new Map(left.map((item) => [getRunKey(item), item] as const));
  const rightByStep = new Map(right.map((item) => [getRunKey(item), item] as const));
  const allStepIds = new Set([...leftByStep.keys(), ...rightByStep.keys()].filter((key) => key.length > 0));

  return [...allStepIds].map((stepId) => {
    const leftItem = leftByStep.get(stepId);
    const rightItem = rightByStep.get(stepId);
    const leftStatus = leftItem?.status ?? "missing";
    const rightStatus = rightItem?.status ?? "missing";
    const leftDecision = leftItem?.decision ?? "missing";
    const rightDecision = rightItem?.decision ?? "missing";
    const leftDuration = leftItem?.durationMs ?? leftItem?.latencyMs ?? null;
    const rightDuration = rightItem?.durationMs ?? rightItem?.latencyMs ?? null;

    return {
      stepId,
      nodeRunId: stepId,
      leftStatus,
      rightStatus,
      statusChanged: leftStatus !== rightStatus,
      leftDecision,
      rightDecision,
      decisionChanged: leftDecision !== rightDecision,
      costDelta:
        leftItem?.cost != null && rightItem?.cost != null
          ? rightItem.cost - leftItem.cost
          : null,
      latencyDeltaMs:
        leftItem?.latencyMs != null && rightItem?.latencyMs != null
          ? rightItem.latencyMs - leftItem.latencyMs
          : null,
      durationDeltaMs:
        leftDuration != null && rightDuration != null
          ? rightDuration - leftDuration
          : null,
      outputChanged:
        leftItem?.outputHash != null && rightItem?.outputHash != null
          ? leftItem.outputHash !== rightItem.outputHash
          : false,
    } satisfies RunComparisonDiff;
  });
}

export function buildSideEffectDiff(
  expected: readonly RunSnapshot[],
  actual: readonly RunSnapshot[],
): SideEffectDiff[] {
  const expectedByStep = new Map(expected.map((item) => [getRunKey(item), item] as const));
  const actualByStep = new Map(actual.map((item) => [getRunKey(item), item] as const));
  const allStepIds = new Set([...expectedByStep.keys(), ...actualByStep.keys()].filter((key) => key.length > 0));

  return [...allStepIds].map((nodeRunId) => {
    const expectedEffects = [...(expectedByStep.get(nodeRunId)?.sideEffects ?? [])];
    const actualEffects = [...(actualByStep.get(nodeRunId)?.sideEffects ?? [])];
    const expectedById = new Map(expectedEffects.map((effect) => [effect.effectId, effect] as const));
    const actualById = new Map(actualEffects.map((effect) => [effect.effectId, effect] as const));

    const addedEffects = actualEffects.filter((effect) => !expectedById.has(effect.effectId));
    const missingEffects = expectedEffects.filter((effect) => !actualById.has(effect.effectId));
    const modifiedEffects = expectedEffects.flatMap((effect) => {
      const actualEffect = actualById.get(effect.effectId);
      if (!actualEffect) {
        return [];
      }
      if (
        effect.effectType === actualEffect.effectType
        && effect.targetResource === actualEffect.targetResource
        && effect.outcome === actualEffect.outcome
        && effect.timestamp === actualEffect.timestamp
      ) {
        return [];
      }
      return [{
        ...actualEffect,
        expectedOutcome: effect.outcome,
        actualOutcome: actualEffect.outcome,
      } satisfies ModifiedSideEffectRecord];
    });

    return {
      nodeRunId,
      expectedEffects,
      actualEffects,
      addedEffects,
      missingEffects,
      modifiedEffects,
      diffSummary: buildSideEffectSummary(addedEffects, missingEffects, modifiedEffects),
    } satisfies SideEffectDiff;
  });
}

export function hasSideEffectDifferences(diff: SideEffectDiff): boolean {
  return diff.addedEffects.length > 0 || diff.missingEffects.length > 0 || diff.modifiedEffects.length > 0;
}

function buildSideEffectSummary(
  addedEffects: readonly SideEffectRecord[],
  missingEffects: readonly SideEffectRecord[],
  modifiedEffects: readonly ModifiedSideEffectRecord[],
): string {
  if (addedEffects.length === 0 && missingEffects.length === 0 && modifiedEffects.length === 0) {
    return "side_effects:identical";
  }
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
  return parts.join(", ");
}
