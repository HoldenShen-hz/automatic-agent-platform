/**
 * Agent Delegation - Core Types
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */

// ─────────────────────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────────────────────

import type { SandboxMode } from "../../five-plane-control-plane/iam/sandbox-policy.js";

export interface AgentContext {
  agentId: string;
  agentType: string;
  packId: string;
  delegationDepth: number;
  activeDelegations: ReadonlyArray<string>;
  permissions: PermissionSet;
  sandboxTier: SandboxMode;
  correlationId: string;
  tenantId: string | null;
  currentCallDepth?: number;
  goalDecompositionDepth?: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema Types (for tool input/output)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Specification Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegationSpec {
  targetAgentId: string;
  targetAgentType: string;
  targetPackId: string;
  requiredPermissions: PermissionSet;
  timeout: number; // milliseconds
  requiresApproval?: boolean;
  inputSchema?: ToolSchema;
  outputSchema?: ToolSchema;
  dataClass?: string;
  // Collaboration modes
  collaborationMode?: "pipeline" | "negotiation" | "broadcast" | "aggregation";
  pipelineStages?: PipelineStageDefinition[];
  negotiationRounds?: number;
  negotiationSelectionPolicy?: "highest_confidence" | "consensus" | "parent_selection";
  aggregationPolicy?: AggregationPolicy;
}

export interface PipelineStageDefinition {
  stageId: string;
  agentId: string;
  agentType: string;
  inputTransform?: (prev: unknown) => unknown;
}

export interface AggregationPolicy {
  aggregationMethod: "sum" | "average" | "max" | "min" | "weighted";
  weightingField?: string;
  confidenceThreshold?: number;
  requiresConsensus?: boolean;
}

export interface DelegationResult {
  delegationId: string;
  parentAgentId: string;
  childAgentId: string;
  depth: number;
  permissions: PermissionSet;
  grantedPermissions: PermissionSet;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  correlationId: string;
  requiresApproval?: boolean;
  status: DelegationStatus;
  artifact_refs?: readonly string[];
  trust_level?: number;
  taint_labels?: readonly string[];
  evidence_refs?: readonly string[];
  policy_outcome?: string;
  data_class?: string;
  summary?: string;
  error?: string;
}

export type DelegationStatus =
  | "pending"
  | "pending_approval"
  | "discovery"
  | "bid"
  | "awarded"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "timed_out";

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Handle (returned to caller)
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegationHandle {
  delegationId: string;
  parentAgentId: string;
  childAgentId: string;
  depth: number;
  status: DelegationStatus;
  createdAt: string;
  timeout: number;
  correlationId: string;
  requiresApproval?: boolean;
}

export type AwaitableDelegationHandle = DelegationHandle & PromiseLike<DelegationHandle>;

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Chain (for tracking)
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegationChainNode {
  delegationId: string;
  agentId: string;
  packId?: string;
  agentType: string;
  depth: number;
  createdAt: string;
  parentDelegationId: string | null;
  status?: DelegationStatus;
}

export interface DelegationChain {
  rootAgentId: string;
  nodes: readonly DelegationChainNode[];
  maxDepthReached: number;
  totalDelegations: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Events
// ─────────────────────────────────────────────────────────────────────────────

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

export type DelegationEvent =
  | DelegationCreatedEvent
  | DelegationCompletedEvent
  | DelegationFailedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Options
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegationOptions {
  maxDepth?: number;
  maxDelegationDepth?: number;
  maxFanout?: number;
  allowedPackIds?: readonly string[];
  defaultTimeout?: number;
  defaultTimeoutMs?: number;
}
