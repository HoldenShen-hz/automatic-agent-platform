/**
 * platform-contracts.ts
 *
 * Platform-level contract definitions.
 * Canonical types are exported from executable-contracts/ or their respective directories.
 * This file provides platform-specific types ONLY.
 *
 * ARCHITECTURAL R4-4 FIX:
 * This file now contains ONLY platform-specific types (PlatformPrincipal, EvidenceRecord).
 * All canonical types (PlanGraphBundle, NodeAttemptReceipt,
 * ContractEnvelope, SideEffectRecord, RequestEnvelope, EventEnvelope, etc.) are exported from
 * executable-contracts/ directly or via the contracts/index.ts barrel.
 *
 * Legacy compatibility types that still need to exist are named with explicit Legacy suffixes
 * so they cannot be confused with canonical executable contracts.
 */

import { newId, nowIso } from "./ids.js";
export { createProjectionUpdate } from "../projection-update/index.js";
export type { ProjectionUpdate } from "../projection-update/index.js";
export type RequestEnvelope<TPayload = unknown> = RequestEnvelopeLegacy<TPayload>;
export type StateCommandType = "update_truth" | "append_event" | "write_checkpoint" | "store_artifact";

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
