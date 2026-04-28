import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { PrincipalRef } from "../executable-contracts/index.js";

/**
 * @deprecated RequestEnvelope from request-envelope/ is a legacy contract.
 * Use RequestEnvelope from executable-contracts (canonical per §5.3).
 */
export interface RequestEnvelope<TBody = Record<string, unknown>> {
  readonly envelopeId: string;
  readonly requestId: string;
  readonly confirmedTaskSpecId: string;
  readonly tenantId: string;
  readonly principal: PrincipalRef;
  readonly traceId: string;
  readonly idempotencyKey: string;
  readonly priority: number;
  readonly taskId: string | null;
  readonly sessionId: string | null;
  readonly mode: "sync" | "async";
  readonly body: TBody;
  readonly createdAt: string;
}

/**
 * @deprecated Use createRequestEnvelopeFromConfirmedTask from executable-contracts instead.
 */
export function createRequestEnvelope<TBody>(input: Omit<RequestEnvelope<TBody>, "envelopeId" | "createdAt"> & {
  envelopeId?: string;
  createdAt?: string;
}): RequestEnvelope<TBody> {
  if (input.requestId.trim().length === 0) {
    throw new ValidationError("request_envelope.request_id_required", "Request envelope requires a request id.");
  }
  return {
    envelopeId: input.envelopeId ?? newId("envelope"),
    requestId: input.requestId,
    confirmedTaskSpecId: input.confirmedTaskSpecId,
    tenantId: input.tenantId,
    principal: input.principal,
    traceId: input.traceId,
    idempotencyKey: input.idempotencyKey,
    priority: input.priority ?? 0,
    taskId: normalizeNullable(input.taskId),
    sessionId: normalizeNullable(input.sessionId),
    mode: input.mode,
    body: input.body,
    createdAt: input.createdAt ?? nowIso(),
  };
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value == null || value.trim().length === 0 ? null : value;
}
