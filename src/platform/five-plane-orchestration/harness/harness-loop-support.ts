import type { HarnessLoopInput, HarnessRunRuntimeState } from "./runtime-types.js";

export function getPreviousPlannerOutput(run: HarnessRunRuntimeState): Readonly<Record<string, unknown>> | null {
  const previousPlannerStep = [...run.steps].reverse().find((step) => step.role === "planner");
  if (previousPlannerStep?.outputs && typeof previousPlannerStep.outputs === "object" && !Array.isArray(previousPlannerStep.outputs)) {
    return previousPlannerStep.outputs as Readonly<Record<string, unknown>>;
  }
  return null;
}

export function createDefaultPlannerOutput(
  input: HarnessLoopInput,
  iteration: number,
): Readonly<Record<string, unknown>> {
  return {
    planId: `plan-${input.taskId}-${iteration}`,
    summary: `Plan ${iteration} for ${input.taskId}`,
    costUsd: Number((0.05 * iteration).toFixed(3)),
    output: `Plan ${iteration} for ${input.domainId}`,
    checkpoints: [`checkpoint-${iteration}-1`, `checkpoint-${iteration}-2`],
  };
}

export function createDefaultGeneratorOutput(
  input: HarnessLoopInput,
  iteration: number,
  plannerOutput: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    artifact: `artifact-${input.taskId}-${iteration}`,
    summary: `Generated artifact for ${(plannerOutput.planId as string | undefined) ?? input.taskId}`,
    costUsd: Number((0.1 * iteration).toFixed(3)),
    input: `Task ${input.taskId} iteration ${iteration}`,
    output: `Generated artifact ${iteration} for ${input.domainId}`,
  };
}

export function createDefaultEvaluatorOutput(
  input: HarnessLoopInput,
  iteration: number,
  generatorOutput: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    verdict: "pass",
    score: 0.86,
    costUsd: Number((0.02 * iteration).toFixed(3)),
    reasoning: `Artifact ${(generatorOutput.artifact as string | undefined) ?? input.taskId} passed evaluation`,
  };
}

export function estimateIterationCost(
  plannerOutput: Readonly<Record<string, unknown>>,
  generatorOutput: Readonly<Record<string, unknown>>,
  evaluatorOutput: Readonly<Record<string, unknown>>,
): number {
  const extract = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return extract(record["costUsd"] ?? record["estimatedCostUsd"] ?? record["totalCostUsd"] ?? record["usage"]);
    }
    return 0;
  };

  return Number((extract(plannerOutput) + extract(generatorOutput) + extract(evaluatorOutput)).toFixed(6));
}
