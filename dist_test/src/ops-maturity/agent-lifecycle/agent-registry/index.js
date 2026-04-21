import { z } from "zod";
/**
 * Agent lifecycle states as defined in architecture doc §61.3.
 */
export const AgentLifecycleStateSchema = z.enum([
    "draft",
    "testing",
    "staging",
    "canary",
    "active",
    "paused",
    "deprecated",
    "archived",
]);
/**
 * Agent component: Pack reference with version.
 * As defined in architecture doc §61.1.
 */
export const PackComponentSchema = z.object({
    packId: z.string().min(1),
    version: z.string().min(1),
});
/**
 * Agent component: Prompt Bundle reference with version.
 * As defined in architecture doc §61.1.
 */
export const PromptBundleComponentSchema = z.object({
    bundleId: z.string().min(1),
    version: z.string().min(1),
});
/**
 * Agent component: Model binding with fallback chain.
 * As defined in architecture doc §61.1.
 */
export const ModelBindingComponentSchema = z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    fallbackChain: z.array(z.string()).default([]),
});
/**
 * Agent component: Trust profile for autonomy scoring.
 * As defined in architecture doc §61.1.
 */
export const TrustProfileComponentSchema = z.object({
    initialLevel: z.enum(["suggestion", "supervised", "semi_auto", "full_auto"]).default("suggestion"),
    scoringConfig: z.object({
        successWeight: z.number().min(0).max(1).default(0.4),
        latencyWeight: z.number().min(0).max(1).default(0.3),
        errorWeight: z.number().min(0).max(1).default(0.3),
    }).default({}),
});
/**
 * Agent component: Trigger policy for proactive agents.
 * As defined in architecture doc §41.
 */
export const TriggerPolicySchema = z.object({
    triggerId: z.string().min(1),
    type: z.enum(["scheduled", "event", "manual"]).default("manual"),
    enabled: z.boolean().default(true),
});
/**
 * Agent component: Autonomy configuration.
 * As defined in architecture doc §42.
 */
export const AutonomyConfigSchema = z.object({
    maxAutomationLevel: z.enum(["suggestion", "supervised", "semi_auto", "full_auto"]).default("supervised"),
    requireHumanApprovalForHighRisk: z.boolean().default(true),
    maxRetriesBeforeApproval: z.number().int().nonnegative().default(3),
});
/**
 * Agent components composite.
 * As defined in architecture doc §61.1.
 */
export const AgentComponentsSchema = z.object({
    pack: PackComponentSchema,
    promptBundle: PromptBundleComponentSchema,
    modelBinding: ModelBindingComponentSchema,
    trustProfile: TrustProfileComponentSchema,
    triggerSet: z.array(TriggerPolicySchema).default([]),
    autonomyConfig: AutonomyConfigSchema,
});
/**
 * OrgNode reference for ownership.
 * As defined in architecture doc §46.
 */
export const OrgNodeRefSchema = z.object({
    orgNodeId: z.string().min(1),
    path: z.string().min(1),
});
/**
 * Agent definition -复合 entity as defined in architecture doc §61.1.
 * This is the primary entity for Agent lifecycle management.
 */
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
/**
 * Lists all agents in active states (canary or active).
 */
export function listActiveAgents(agents) {
    return agents.filter((item) => item.lifecycleState === "active" || item.lifecycleState === "canary");
}
/**
 * Valid state transitions per architecture doc §61.3.
 */
export const VALID_LIFECYCLE_TRANSITIONS = new Map([
    ["draft", ["testing"]],
    ["testing", ["staging", "draft"]],
    ["staging", ["canary", "testing"]],
    ["canary", ["active", "staging", "paused"]],
    ["active", ["paused", "deprecated"]],
    ["paused", ["active", "deprecated"]],
    ["deprecated", ["archived", "active"]],
    ["archived", []],
]);
/**
 * Checks if a lifecycle state transition is valid.
 */
export function isValidLifecycleTransition(from, to) {
    const allowed = VALID_LIFECYCLE_TRANSITIONS.get(from);
    return allowed?.includes(to) ?? false;
}
/**
 * Checks if agent can be promoted (for automatic canary promotion).
 */
export function canAutoPromote(state) {
    return state === "canary";
}
/**
 * Checks if agent is in a terminal state.
 */
export function isTerminalState(state) {
    return state === "archived";
}
//# sourceMappingURL=index.js.map