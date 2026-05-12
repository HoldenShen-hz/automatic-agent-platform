import { z } from "zod";
import {
  mapAutonomyLevelToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../../platform/contracts/types/unified-runtime-mode.js";

const InternalAgentLifecycleStateSchema = z.enum([
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

export type InternalAgentLifecycleState = z.infer<typeof InternalAgentLifecycleStateSchema>;

export type DocumentedAgentLifecycleState =
  | "draft"
  | "testing"
  | "staging"
  | "production"
  | "retired"
  | "removed";

export type AgentLifecycleState = InternalAgentLifecycleState | DocumentedAgentLifecycleState;

export function normalizeAgentLifecycleState(state: AgentLifecycleState): InternalAgentLifecycleState {
  switch (state) {
    case "production":
      return "active";
    case "retired":
      return "archived";
    default:
      return state;
  }
}

export function toDocumentedAgentLifecycleState(state: AgentLifecycleState): DocumentedAgentLifecycleState {
  switch (normalizeAgentLifecycleState(state)) {
    case "draft":
      return "draft";
    case "testing":
      return "testing";
    case "staging":
      return "staging";
    case "active":
    case "canary":
    case "paused":
      return "production";
    case "deprecated":
    case "archived":
      return "retired";
    case "removed":
      return "removed";
  }
}

export const AgentLifecycleStateSchema = z.string().transform((value, ctx): InternalAgentLifecycleState => {
  const normalized = normalizeAgentLifecycleState(value as AgentLifecycleState);
  const parsed = InternalAgentLifecycleStateSchema.safeParse(normalized);
  if (!parsed.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid agent lifecycle state: ${value}`,
    });
    return z.NEVER;
  }
  return parsed.data;
});

const ALLOWED_UNIFIED_RUNTIME_MODES = new Set<UnifiedRuntimeMode>([
  "full_auto",
  "supervised_auto",
  "read_only",
  "no_write",
  "no_external_call",
  "no_rollout",
  "manual_only",
  "incident_mode",
]);

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

const AgentRuntimeModeSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeAgentRuntimeMode(value);
  if (!ALLOWED_UNIFIED_RUNTIME_MODES.has(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid runtime mode: ${value}`,
    });
    return z.NEVER;
  }
  return normalized;
});

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
  return agents.filter((item) => {
    const normalizedState = normalizeAgentLifecycleState(item.lifecycleState);
    return normalizedState === "active" || normalizedState === "canary";
  });
}

export const VALID_LIFECYCLE_TRANSITIONS: ReadonlyMap<InternalAgentLifecycleState, readonly InternalAgentLifecycleState[]> = new Map([
  ["draft", ["testing"]],
  ["testing", ["staging", "draft"]],
  ["staging", ["canary", "testing", "active"]],
  ["canary", ["active", "staging", "paused"]],
  ["active", ["paused", "deprecated"]],
  ["paused", ["active", "deprecated", "canary"]],
  ["deprecated", ["archived", "active"]],
  ["archived", ["removed", "paused"]],
  ["removed", []],
]);

export function isValidLifecycleTransition(from: AgentLifecycleState, to: AgentLifecycleState): boolean {
  const normalizedFrom = normalizeAgentLifecycleState(from);
  const normalizedTo = normalizeAgentLifecycleState(to);
  const allowed = VALID_LIFECYCLE_TRANSITIONS.get(normalizedFrom);
  return allowed?.includes(normalizedTo) ?? false;
}

export function canAutoPromote(state: AgentLifecycleState): boolean {
  return normalizeAgentLifecycleState(state) === "canary";
}

export function isTerminalState(state: AgentLifecycleState): boolean {
  const normalizedState = normalizeAgentLifecycleState(state);
  return normalizedState === "archived" || normalizedState === "removed";
}
