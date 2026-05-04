/**
 * platform-contracts.ts
 *
 * Central platform-level contract definitions.
 * Canonical types are exported from executable-contracts/ or their respective directories.
 * This file provides platform-level aggregation and deprecated legacy type stubs.
 *
 * ARCHITECTURAL DEBT (R4-4):
 * This file contains TWO overlapping contract sets:
 * 1. Re-exports from executable-contracts/ (PlanGraphBundle, NodeAttemptReceipt, SideEffectRecord, etc.)
 * 2. Platform-specific types (PlatformPrincipal, EvidenceRecord, ProjectionUpdate, ContractEnvelope)
 *
 * The re-exports here duplicate exports in src/platform/contracts/index.ts barrel.
 * Additionally, some types here (PlatformPrincipal, EvidenceRecord, ProjectionUpdate) are also
 * re-exported from contracts/index.ts, creating confusion about the canonical source.
 *
 * Cleanup direction per §4:
 * - Move platform-specific types (PlatformPrincipal, EvidenceRecord, ProjectionUpdate) to a new
 *   file or to contracts/index.ts directly
 * - Remove re-exports of executable-contracts types from this file - they should only be
 *   imported from executable-contracts/ directly or via the contracts/index.ts barrel
 * - Keep ContractEnvelope and legacy stubs (RequestEnvelopeLegacy, SideEffectExpectation) here
 *   until migration is complete
 */

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

// SideEffectRecord - canonical with 16 states per §14.5/§14.11 (re-exported for convenience)
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

// RequestEnvelope - canonical inter-plane envelope per §5.3
export {
  type RequestEnvelope,
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

// =============================================================================
// ContractEnvelope - canonical envelope per §5.5
// Root cause: §5.5 mandates a standard envelope with version, schema, payload,
// signature, ttl. This type was completely missing from the codebase.
// =============================================================================

/**
 * ContractEnvelope - canonical wire format for inter-plane contract delivery.
 * Required fields per §5.5: version, schema, payload, signature, ttl.
 */
export interface ContractEnvelope<TPayload = unknown> {
  readonly version: string;
  readonly schema: string;
  readonly payload: TPayload;
  readonly signature: string;
  readonly ttl: number;
}

// =============================================================================
// Platform-Level Contract Types
// =============================================================================

// PlatformPrincipal is used in EvidenceRecord and legacy factory functions
// that are still referenced by existing code.
export interface PlatformPrincipal {
  readonly actorId: string;
  readonly tenantId: string | null;
  readonly roles: readonly string[];
  readonly authMethod?: string;
  readonly displayName?: string;
}

/**
 * @deprecated RequestEnvelopeLegacy is deprecated per §5.3.
 * Use RequestEnvelope from executable-contracts (canonical with confirmedTaskSpecId,
 * domainId, requestHash, constraintPackRef, budgetIntent, etc.).
 * This interface is retained for legacy adapter compatibility only.
 */
export interface RequestEnvelopeLegacy<TPayload = unknown> {
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
 * Use SideEffectRecord from executable-contracts (canonical with 16 states per §14.5/§14.11).
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

/**
 * @deprecated createRequestEnvelope is deprecated per §5.3.
 * Use createRequestEnvelopeFromConfirmedTask from executable-contracts instead.
 */
export function createRequestEnvelope<TPayload>(input: {
  principal: PlatformPrincipal;
  tenantId?: string;
  payload: TPayload;
  metadata?: Readonly<Record<string, unknown>>;
  requestId?: string;
  idempotencyKey?: string;
  traceId?: string;
  timestamp?: string;
}): RequestEnvelopeLegacy<TPayload> {
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