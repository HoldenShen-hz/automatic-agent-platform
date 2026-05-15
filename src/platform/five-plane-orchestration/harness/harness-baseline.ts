export type HarnessCapabilityId =
  | "constraint-pack"
  | "planner-generator-evaluator-loop"
  | "hitl"
  | "governance";

export interface HarnessCapabilityBaseline {
  readonly capabilityId: HarnessCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

export const HARNESS_CAPABILITY_BASELINES: readonly HarnessCapabilityBaseline[] = Object.freeze([
  {
    capabilityId: "constraint-pack",
    entryModule: "src/platform/five-plane-orchestration/harness/index.ts",
    description: "ConstraintPack policy, budget, autonomy, and tool policy baselines.",
    baselineServices: ["HarnessRuntimeService"],
  },
  {
    capabilityId: "planner-generator-evaluator-loop",
    entryModule: "src/platform/five-plane-orchestration/harness/index.ts",
    description: "Planner to generator to evaluator to loop-controller orchestration baselines.",
    baselineServices: ["HarnessRuntimeService"],
  },
  {
    capabilityId: "hitl",
    entryModule: "src/platform/five-plane-orchestration/harness/index.ts",
    description: "Human escalation, paused states, and operator continuation baselines.",
    baselineServices: ["HarnessRuntimeService"],
  },
  {
    capabilityId: "governance",
    entryModule: "src/platform/five-plane-orchestration/harness/index.ts",
    description: "Evaluation-driven decisions, retry/replan flows, and governed loop exits.",
    baselineServices: ["HarnessRuntimeService"],
  },
]);

export function listHarnessCapabilityBaselines(): readonly HarnessCapabilityBaseline[] {
  return HARNESS_CAPABILITY_BASELINES;
}

export function resolveHarnessCapabilityBaseline(capabilityId: HarnessCapabilityId): HarnessCapabilityBaseline {
  const baseline = HARNESS_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`harness_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
