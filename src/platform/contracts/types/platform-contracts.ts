/**
 * platform-contracts.ts
 *
 * Platform-level contract definitions.
 * Canonical types are exported from executable-contracts/ or their respective directories.
 * This file provides platform-specific types ONLY.
 *
 * ARCHITECTURAL R4-4 FIX:
 * This file now contains ONLY platform-specific types (PlatformPrincipal, EvidenceRecord,
 * ProjectionUpdate). All canonical types (PlanGraphBundle, NodeAttemptReceipt,
 * ContractEnvelope, SideEffectRecord, RequestEnvelope, EventEnvelope, etc.) are exported from
 * executable-contracts/ directly or via the contracts/index.ts barrel.
 *
 * Legacy type stubs (RequestEnvelopeLegacy, SideEffectExpectation) are retained here
 * for backward compatibility until migration is complete.
 */

import { newId, nowIso } from "./ids.js";
export {
  createControlDirective,
  type ControlDirective,
  type ControlDirectiveKind as ControlDirectiveType,
} from "../control-directive/index.js";
export { createExecutionPlan, type ExecutionPlan } from "../execution-plan/index.js";
export { createExecutionReceipt, type ExecutionReceipt } from "../execution-receipt/index.js";
export {
  createStateCommand,
  type StateCommand,
  type StateCommandAction as StateCommandType,
} from "../state-command/index.js";
export type { SideEffectRecord } from "../executable-contracts/index.js";

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

export type RequestEnvelope<TPayload = unknown> = RequestEnvelopeLegacy<TPayload>;

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
