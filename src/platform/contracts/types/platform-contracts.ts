/**
 * platform-contracts.ts
 *
 * Central platform-level contract definitions.
 * Canonical types are exported from executable-contracts/ or their respective directories.
 * This file provides platform-level aggregation and deprecated legacy type stubs.
 */

import { ValidationError } from "../errors.js";
import { newId, nowIso } from "./ids.js";

// =============================================================================
// Re-exports from executable-contracts (canonical types per §4)
// =============================================================================

// PlanGraphBundle - canonical P3→P4 execution contract (re-exported for convenience)
export {
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type GraphValidationReport,
  type GraphPatch,
  type GraphPatchOperation,
  type ReadyNodeSchedulingPolicy,
  createPlanGraphBundle,
  createGraphPatch,
} from "../executable-contracts/index.js";

// NodeAttemptReceipt - canonical P4→P3 execution receipt (re-exported for convenience)
export {
  type NodeAttemptReceipt,
  type AppErrorRef,
  createNodeAttemptReceipt,
} from "../executable-contracts/index.js";

// =============================================================================
// Re-exports from control-directive (canonical directives per §4.3)
// =============================================================================

// OperationalDirective and DecisionDirective - canonical P2→P3/P4 directives
export {
  type OperationalDirectiveType,
  type OperationalDirectiveScope,
  type OperationalDirective,
  type DecisionDirectiveType,
  type DecisionDirectiveScope,
  type DecisionDirective,
  createOperationalDirective,
  createDecisionDirective,
  // Legacy - deprecated
  type ControlDirectiveKind,
  type ControlDirective,
  createControlDirective,
} from "../control-directive/index.js";

// =============================================================================
// Re-exports from execution-plan (deprecated legacy types)
// =============================================================================

// Legacy ExecutionPlan - deprecated, use PlanGraphBundle instead
export {
  // Legacy - deprecated
  type ExecutionPlan,
  type ExecutionPlanStep,
  createExecutionPlan,
} from "../execution-plan/index.js";

// =============================================================================
// Re-exports from execution-receipt (deprecated legacy types)
// =============================================================================

// Legacy ExecutionReceipt - deprecated, use NodeAttemptReceipt instead
export {
  // Legacy - deprecated
  type ExecutionReceipt,
  type ExecutionReceiptStatus,
  createExecutionReceipt,
} from "../execution-receipt/index.js";

// =============================================================================
// Platform-Level Contract Types
// =============================================================================

export interface PlatformPrincipal {
  readonly actorId: string;
  readonly tenantId: string | null;
  readonly roles: readonly string[];
  readonly authMethod?: string;
  readonly displayName?: string;
}

export interface RequestEnvelope<TPayload = unknown> {
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly tenantId: string;
  readonly timestamp: string;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, string>>;
}

// SideEffectRecord is defined in executable-contracts with 16 states (canonical per §4)
// SideEffectExpectation is retained locally for platform-level use
export interface SideEffectExpectation {
  readonly effectId: string;
  readonly category: "read" | "write" | "notification" | "artifact" | "external_api";
  readonly targetRef: string;
  readonly requiredReceipt: boolean;
  readonly reversible: boolean;
}

// Note: SideEffectRecord with 16 states is canonical in executable-contracts

export interface ExecutionPlanBudget {
  readonly maxSteps: number;
  readonly maxDurationMs: number;
  readonly maxCost: number;
}

export interface ExecutionReceiptErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export type StateCommandType =
  | "update_truth"
  | "append_event"
  | "write_checkpoint"
  | "store_artifact";

/**
 * @deprecated StateCommand is deprecated per §5.3. Use inter-plane commands from executable-contracts instead.
 * This interface is retained for legacy adapter compatibility only.
 */
export interface StateCommand<TPayload = unknown> {
  readonly commandId: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly leaseId: string;
  readonly fencingToken: string;
  readonly event: string;
  readonly type: StateCommandType;
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly payload: TPayload;
}

export interface EvidenceRecord {
  readonly recordId: string;
  readonly traceId: string;
  readonly principal: PlatformPrincipal;
  readonly category: "decision" | "execution" | "approval" | "audit" | "compliance";
  readonly targetRef: string;
  readonly content: unknown;
  readonly timestamp: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ProjectionUpdate {
  readonly projectionId: string;
  readonly projectionType: string;
  readonly version: number;
  readonly timestamp: string;
  readonly sourceEvents: readonly string[];
  readonly patch: Readonly<Record<string, unknown>>;
  readonly metadata: {
    readonly rebuiltAt?: string | undefined;
    readonly triggeredBy: string;
    readonly idempotencyKey: string;
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

function stringifyRecord(input?: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  if (input == null) {
    return {};
  }
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
}

export function createPlatformPrincipal(input: {
  actorId: string;
  tenantId: string | null;
  roles?: readonly string[];
  authMethod?: string;
  displayName?: string;
}): PlatformPrincipal {
  return {
    actorId: input.actorId,
    tenantId: input.tenantId,
    roles: input.roles ?? [],
    ...(input.authMethod != null ? { authMethod: input.authMethod } : {}),
    ...(input.displayName != null ? { displayName: input.displayName } : {}),
  };
}

export function createRequestEnvelope<TPayload>(input: {
  principal: PlatformPrincipal;
  tenantId?: string;
  payload: TPayload;
  metadata?: Readonly<Record<string, unknown>>;
  requestId?: string;
  idempotencyKey?: string;
  traceId?: string;
  timestamp?: string;
}): RequestEnvelope<TPayload> {
  return {
    requestId: input.requestId ?? newId("request"),
    idempotencyKey: input.idempotencyKey ?? newId("idem"),
    traceId: input.traceId ?? newId("trace"),
    principal: input.principal,
    tenantId: input.tenantId ?? input.principal.tenantId ?? "global",
    timestamp: input.timestamp ?? nowIso(),
    payload: input.payload,
    metadata: stringifyRecord(input.metadata),
  };
}

/**
 * @deprecated StateCommand factory is deprecated per §5.3.
 * Use inter-plane commands from executable-contracts instead.
 */
export function createStateCommand<TPayload>(input: {
  traceId: string;
  principal: PlatformPrincipal;
  leaseId: string;
  fencingToken: string;
  event: string;
  type: StateCommandType;
  aggregateId: string;
  expectedVersion: number;
  payload: TPayload;
  commandId?: string;
}): StateCommand<TPayload> {
  return {
    commandId: input.commandId ?? newId("statecmd"),
    traceId: input.traceId,
    principal: input.principal,
    leaseId: input.leaseId,
    fencingToken: input.fencingToken,
    event: input.event,
    type: input.type,
    aggregateId: input.aggregateId,
    expectedVersion: input.expectedVersion,
    payload: input.payload,
  };
}

export function createEvidenceRecord(input: {
  traceId: string;
  principal: PlatformPrincipal;
  category: EvidenceRecord["category"];
  targetRef: string;
  content: unknown;
  metadata?: Readonly<Record<string, string>>;
  recordId?: string;
}): EvidenceRecord {
  return {
    recordId: input.recordId ?? newId("evid"),
    traceId: input.traceId,
    principal: input.principal,
    category: input.category,
    targetRef: input.targetRef,
    content: input.content,
    timestamp: nowIso(),
    metadata: input.metadata ?? {},
  };
}

export function createProjectionUpdate(input: {
  projectionId: string;
  projectionType: string;
  version: number;
  sourceEvents: readonly string[];
  patch: Readonly<Record<string, unknown>>;
  triggeredBy: string;
  rebuiltAt?: string;
  idempotencyKey?: string;
}): ProjectionUpdate {
  return {
    projectionId: input.projectionId,
    projectionType: input.projectionType,
    version: input.version,
    timestamp: nowIso(),
    sourceEvents: input.sourceEvents,
    patch: input.patch,
    metadata: {
      ...(input.rebuiltAt != null ? { rebuiltAt: input.rebuiltAt } : {}),
      triggeredBy: input.triggeredBy,
      idempotencyKey: input.idempotencyKey ?? newId("projupd"),
    },
  };
}