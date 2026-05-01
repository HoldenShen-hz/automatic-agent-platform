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

// SideEffectRecord - canonical with 16 states per §5.3 (re-exported for convenience)
// NOTE: Only ONE definition exists - in executable-contracts/schemas.ts.
// The 4-state "SideEffectExpectation" below is deprecated legacy stub.
export {
  type SideEffectRecord,
  type SideEffectKind,
  type SideEffectStatus,
  type SideEffectProfile,
  createSideEffectRecord,
} from "../executable-contracts/index.js";

// PlatformFactEvent and OapeflirViewEvent - canonical event types per §28.1
export {
  type PlatformFactEvent,
  type OapeflirViewEvent,
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
} from "../control-directive/index.js";

// Legacy - deprecated per §4.3. Use OperationalDirective/DecisionDirective instead.
export {
  /**
   * @deprecated ControlDirective is deprecated per §4.3. Use OperationalDirective or DecisionDirective instead.
   */
  type ControlDirectiveKind,
  /**
   * @deprecated ControlDirective is deprecated per §4.3. Use OperationalDirective or DecisionDirective instead.
   */
  type ControlDirective,
  /**
   * @deprecated ControlDirective factory is deprecated per §4.3. Use createOperationalDirective or createDecisionDirective instead.
   */
  createControlDirective,
} from "../control-directive/index.js";

// =============================================================================
// Legacy Type Re-exports (deprecated per §5)
// These are re-exported from executable-contracts for backward compatibility.
// DO NOT use in new code - use canonical types from executable-contracts.
// =============================================================================

// Legacy ExecutionPlan - deprecated per §4.4, use PlanGraphBundle instead
export {
  /**
   * @deprecated ExecutionPlan is deprecated per §4.4. Use PlanGraphBundle from executable-contracts instead.
   */
  type ExecutionPlan,
  /**
   * @deprecated ExecutionPlanStep is deprecated per §4.4. Use PlanNode from executable-contracts instead.
   */
  type ExecutionPlanStep,
  /**
   * @deprecated createExecutionPlan is deprecated per §4.4. Use createPlanGraphBundle instead.
   */
  createExecutionPlan,
} from "../execution-plan/index.js";

// Legacy ExecutionReceipt - deprecated per §4.5, use NodeAttemptReceipt instead
export {
  /**
   * @deprecated ExecutionReceipt is deprecated per §4.5. Use NodeAttemptReceipt from executable-contracts instead.
   */
  type ExecutionReceipt,
  /**
   * @deprecated ExecutionReceiptStatus is deprecated per §4.5.
   */
  type ExecutionReceiptStatus,
  /**
   * @deprecated createExecutionReceipt is deprecated per §4.5. Use createNodeAttemptReceipt instead.
   */
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

/**
 * @deprecated SideEffectExpectation is deprecated per §5.3.
 * Use SideEffectRecord from executable-contracts (canonical with 16 states).
 * This interface is retained for legacy adapter compatibility only.
 */
export interface SideEffectExpectation {
  readonly effectId: string;
  readonly category: "read" | "write" | "notification" | "artifact" | "external_api";
  readonly targetRef: string;
  readonly requiredReceipt: boolean;
  readonly reversible: boolean;
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