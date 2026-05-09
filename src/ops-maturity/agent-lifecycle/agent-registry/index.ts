import { z } from "zod";
import {
  mapAutonomyLevelToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../../platform/contracts/types/unified-runtime-mode.js";

export const AgentLifecycleStateSchema = z.enum([
  "draft",
  "testing",
  "staging",
  "canary",
  "active",
  "paused",
  "deprecated",
  "archived",
  "removed",
]);

export type AgentLifecycleState = z.infer<typeof AgentLifecycleStateSchema>;

function normalizeAgentRuntimeMode(value: string): UnifiedRuntimeMode {
  switch (value) {
    case "suggestion":
    case "supervised":
    case "semi_auto":
    case "full_auto":
      return mapAutonomyLevelToUnifiedRuntimeMode(value);
    default:
      return normalizeUnifiedRuntimeMode(value as UnifiedRuntimeMode | DocumentedUnifiedRuntimeMode);
  }
}

const AgentRuntimeModeSchema = z.string().transform((value) => normalizeAgentRuntimeMode(value));

export const PackComponentSchema = z.object({
  packId: z.string().min(1),
  version: z.string().min(1),
});

export const PromptBundleComponentSchema = z.object({
  bundleId: z.string().min(1),
  version: z.string().min(1),
});

export const ModelBindingComponentSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  fallbackChain: z.array(z.string()).default([]),
});

export const TrustProfileComponentSchema = z.object({
  initialLevel: AgentRuntimeModeSchema.default("no_write"),
  scoringConfig: z.object({
    successWeight: z.number().min(0).max(1).default(0.4),
    latencyWeight: z.number().min(0).max(1).default(0.3),
    errorWeight: z.number().min(0).max(1).default(0.3),
  }).default({}),
});

export const ConnectorBindingComponentSchema = z.object({
  connectorId: z.string().min(1),
  bindingRef: z.string().min(1),
  permissionScope: z.string().min(1).default("read"),
});

export const TriggerPolicySchema = z.object({
  triggerId: z.string().min(1),
  type: z.enum(["scheduled", "event", "manual"]).default("manual"),
  enabled: z.boolean().default(true),
});

export const AutonomyConfigSchema = z.object({
  maxAutomationLevel: AgentRuntimeModeSchema.default("manual_only"),
  requireHumanApprovalForHighRisk: z.boolean().default(true),
  maxRetriesBeforeApproval: z.number().int().nonnegative().default(3),
});

export const AgentComponentsSchema = z.object({
  pack: PackComponentSchema,
  promptBundle: PromptBundleComponentSchema,
  modelBinding: ModelBindingComponentSchema,
  trustProfile: TrustProfileComponentSchema,
  triggerSet: z.array(TriggerPolicySchema).default([]),
  connectorBindings: z.array(ConnectorBindingComponentSchema).default([]),
  autonomyConfig: AutonomyConfigSchema,
});

export const OrgNodeRefSchema = z.object({
  orgNodeId: z.string().min(1),
  path: z.string().min(1),
});

export const AgentDefinitionSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  domainId: z.string().min(1),
  owner: OrgNodeRefSchema,
  components: AgentComponentsSchema,
  currentVersionId: z.string().optional().default(""),
  lifecycleState: AgentLifecycleStateSchema.default("draft"),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export function listActiveAgents(agents: readonly AgentDefinition[]): AgentDefinition[] {
  return agents.filter((item) => item.lifecycleState === "active" || item.lifecycleState === "canary");
}

export const VALID_LIFECYCLE_TRANSITIONS: ReadonlyMap<AgentLifecycleState, readonly AgentLifecycleState[]> = new Map([
  ["draft", ["testing"]],
  ["testing", ["staging", "draft"]],
  ["staging", ["canary", "testing"]],
  ["canary", ["active", "staging", "paused"]],
  ["active", ["paused", "deprecated"]],
  ["paused", ["active", "deprecated", "canary"]],
  ["deprecated", ["archived", "active"]],
  ["archived", ["removed", "paused"]],
  ["removed", []],
]);

export function isValidLifecycleTransition(from: AgentLifecycleState, to: AgentLifecycleState): boolean {
  const allowed = VALID_LIFECYCLE_TRANSITIONS.get(from);
  return allowed?.includes(to) ?? false;
}

export function canAutoPromote(state: AgentLifecycleState): boolean {
  return state === "canary";
}

export function isTerminalState(state: AgentLifecycleState): boolean {
  return state === "archived";
}
