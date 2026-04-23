/**
 * Agent Delegation - Core Types
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */
export interface AgentContext {
    agentId: string;
    agentType: string;
    packId: string;
    delegationDepth: number;
    activeDelegations: ReadonlyArray<string>;
    permissions: PermissionSet;
    sandboxTier: "none" | "process" | "container" | "scoped_external_access";
    correlationId: string;
    tenantId: string | null;
}
export interface PermissionSet {
    resources: readonly string[];
    actions: readonly string[];
    constraints: PermissionConstraints;
}
export interface PermissionConstraints {
    maxDurationMs?: number;
    maxTokens?: number;
    allowedDomains?: readonly string[];
    deniedDomains?: readonly string[];
}
/**
 * A single property within a JSON Schema definition.
 * Supports the property types commonly used in tool schema definitions.
 */
export interface ToolSchemaProperty {
    readonly type?: "string" | "number" | "boolean" | "array" | "object";
    readonly description?: string;
    readonly minLength?: number;
    readonly maximum?: number;
    readonly enum?: readonly string[];
    readonly items?: ToolSchemaProperty;
    readonly additionalProperties?: boolean | ToolSchemaProperty;
}
/**
 * JSON Schema definition for tool input/output validation.
 * Used to define the expected structure of delegation tool schemas.
 * Extends Record<string, unknown> for compatibility with code expecting
 * loose object schemas while providing typed property access.
 */
export interface ToolSchema extends Record<string, unknown> {
    readonly type?: "object";
    readonly properties?: Readonly<Record<string, ToolSchemaProperty>>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
    readonly description?: string;
}
export interface DelegationSpec {
    targetAgentId: string;
    targetAgentType: string;
    targetPackId: string;
    requiredPermissions: PermissionSet;
    timeout: number;
    inputSchema?: ToolSchema;
    outputSchema?: ToolSchema;
    collaborationMode?: "pipeline" | "negotiation";
    pipelineStages?: PipelineStageDefinition[];
    negotiationRounds?: number;
    negotiationSelectionPolicy?: "highest_confidence" | "consensus" | "parent_selection";
}
export interface PipelineStageDefinition {
    stageId: string;
    agentId: string;
    agentType: string;
    inputTransform?: (prev: unknown) => unknown;
}
export interface DelegationResult {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    depth: number;
    permissions: PermissionSet;
    createdAt: string;
    expiresAt: string;
    status: DelegationStatus;
}
export type DelegationStatus = "pending" | "active" | "completed" | "failed" | "cancelled" | "expired";
export interface DelegationHandle {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    depth: number;
    status: DelegationStatus;
    createdAt: string;
    timeout: number;
    correlationId: string;
}
export interface DelegationChainNode {
    delegationId: string;
    agentId: string;
    packId?: string;
    agentType: string;
    depth: number;
    createdAt: string;
    parentDelegationId: string | null;
}
export interface DelegationChain {
    rootAgentId: string;
    nodes: readonly DelegationChainNode[];
    maxDepthReached: number;
    totalDelegations: number;
}
export interface DelegationCreatedEvent {
    eventType: "delegation.created";
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    depth: number;
    timestamp: string;
    correlationId: string;
}
export interface DelegationCompletedEvent {
    eventType: "delegation.completed";
    delegationId: string;
    durationMs: number;
    outputRef?: string;
    timestamp: string;
}
export interface DelegationFailedEvent {
    eventType: "delegation.failed";
    delegationId: string;
    error: string;
    timestamp: string;
}
export type DelegationEvent = DelegationCreatedEvent | DelegationCompletedEvent | DelegationFailedEvent;
export interface DelegationOptions {
    maxDepth?: number;
    maxFanout?: number;
    allowedPackIds?: readonly string[];
    defaultTimeout?: number;
}
