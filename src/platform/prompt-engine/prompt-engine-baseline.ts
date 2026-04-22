export type PromptEngineCapabilityId =
  | "registry"
  | "renderer"
  | "rollout"
  | "eval"
  | "conversation-template";

export interface PromptEngineCapabilityBaseline {
  readonly capabilityId: PromptEngineCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

export const PROMPT_ENGINE_CAPABILITY_BASELINES: readonly PromptEngineCapabilityBaseline[] = Object.freeze([
  {
    capabilityId: "registry",
    entryModule: "src/platform/prompt-engine/registry/index.ts",
    description: "Prompt bundle registry, version graph, and scope-aware resolution baselines.",
    baselineServices: ["PromptTemplateRegistryService", "HierarchicalRegistryService"],
  },
  {
    capabilityId: "renderer",
    entryModule: "src/platform/prompt-engine/renderer/index.ts",
    description: "Prompt rendering, interpolation, and layered template compilation baselines.",
    baselineServices: ["PromptRendererService"],
  },
  {
    capabilityId: "rollout",
    entryModule: "src/platform/prompt-engine/rollout/index.ts",
    description: "Traffic split, prompt rollout, rollback, and governance gate baselines.",
    baselineServices: ["PromptRolloutService"],
  },
  {
    capabilityId: "eval",
    entryModule: "src/platform/prompt-engine/eval/index.ts",
    description: "Prompt evaluation datasets, judges, and regression baselines.",
    baselineServices: ["EvalDatasetJudgeService"],
  },
  {
    capabilityId: "conversation-template",
    entryModule: "src/platform/prompt-engine/conversation-template-service.ts",
    description: "Conversation template loading and backward-compatible registry baselines.",
    baselineServices: ["ConversationTemplateRegistry"],
  },
]);

export function listPromptEngineCapabilityBaselines(): readonly PromptEngineCapabilityBaseline[] {
  return PROMPT_ENGINE_CAPABILITY_BASELINES;
}

export function resolvePromptEngineCapabilityBaseline(
  capabilityId: PromptEngineCapabilityId,
): PromptEngineCapabilityBaseline {
  const baseline = PROMPT_ENGINE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`prompt_engine_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
