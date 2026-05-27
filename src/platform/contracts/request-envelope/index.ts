import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { PrincipalRef } from "../executable-contracts/index.js";
import type { OperationalDirective, DecisionDirective } from "../control-directive/index.js";

// Runtime warning for imports from legacy contract path
process.emitWarning(
  "[DEPRECATED] request-envelope/ is deprecated. " +
  "Use RequestEnvelope from src/platform/contracts/executable-contracts instead. " +
  "See: docs_zh/contracts/README.md",
  { code: "AA_LEGACY_REQUEST_ENVELOPE" },
);

/**
 * @deprecated RequestEnvelope from request-envelope/ is a legacy contract.
 * Use RequestEnvelope from executable-contracts (canonical per §5.3).
 */
export interface RequestEnvelope<TBody = Record<string, unknown>> {
  readonly envelopeId: string;
  readonly requestId: string;
  readonly confirmedTaskSpecId: string;
  readonly tenantId: string | null;
  readonly principal: PrincipalRef;
  readonly traceId: string | null;
  readonly idempotencyKey: string;
  readonly priority: number;
  readonly taskId: string | null;
  readonly sessionId: string | null;
  readonly mode: "sync" | "async";
  readonly body: TBody;
  readonly createdAt: string;
  // R24-58 FIX: ADR-021 requires 4/8 mandatory fields for inter-plane routing.
  // Missing fields: principal (already present), source_plane, target_plane, directives.
  readonly sourcePlane?: string;
  readonly targetPlane?: string;
  readonly directives?: readonly (OperationalDirective | DecisionDirective)[];
}

type RequestEnvelopeInput<TBody> = {
  readonly requestId: string;
  readonly confirmedTaskSpecId?: string;
  readonly tenantId?: string | null;
  readonly principal?: PrincipalRef;
  readonly traceId?: string | null;
  readonly idempotencyKey?: string;
  readonly priority?: number;
  readonly taskId?: string | null;
  readonly sessionId?: string | null;
  readonly mode: "sync" | "async";
  readonly body: TBody;
  readonly sourcePlane?: string;
  readonly targetPlane?: string;
  readonly directives?: readonly (OperationalDirective | DecisionDirective)[];
  readonly envelopeId?: string;
  readonly createdAt?: string;
};

/**
 * @deprecated Use createRequestEnvelopeFromConfirmedTask from executable-contracts instead.
 */
export function createRequestEnvelope<TBody>(input: RequestEnvelopeInput<TBody>): RequestEnvelope<TBody> {
  if (input.requestId.trim().length === 0) {
    throw new ValidationError("request_envelope.request_id_required", "Request envelope requires a request id.");
  }
  const sourcePlane = normalizeOptionalPlane(input.sourcePlane);
  const targetPlane = normalizeOptionalPlane(input.targetPlane);
  return {
    envelopeId: input.envelopeId ?? newId("envelope"),
    requestId: input.requestId.trim(),
    confirmedTaskSpecId: normalizeNullable(input.confirmedTaskSpecId) ?? newId("confirmed_task"),
    tenantId: normalizeNullable(input.tenantId),
    principal: input.principal ?? {
      principalId: "anonymous",
      type: "system",
      tenantId: normalizeNullable(input.tenantId) ?? "global",
      roles: [],
    },
    traceId: normalizeNullable(input.traceId),
    idempotencyKey: normalizeNullable(input.idempotencyKey) ?? newId("idem"),
    priority: input.priority ?? 0,
    taskId: normalizeNullable(input.taskId),
    sessionId: normalizeNullable(input.sessionId),
    mode: input.mode,
    body: input.body,
    directives: input.directives ?? [],
    ...(sourcePlane !== undefined ? { sourcePlane } : {}),
    ...(targetPlane !== undefined ? { targetPlane } : {}),
    createdAt: input.createdAt ?? nowIso(),
  };
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value == null || value.trim().length === 0 ? null : value;
}

function normalizeOptionalPlane(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}
