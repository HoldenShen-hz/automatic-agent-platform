import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export interface RequestEnvelope<TBody = Record<string, unknown>> {
  envelopeId: string;
  requestId: string;
  taskId: string | null;
  tenantId: string | null;
  sessionId: string | null;
  traceId: string | null;
  mode: "sync" | "async";
  body: TBody;
  createdAt: string;
}

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
    taskId: normalizeNullable(input.taskId),
    tenantId: normalizeNullable(input.tenantId),
    sessionId: normalizeNullable(input.sessionId),
    traceId: normalizeNullable(input.traceId),
    mode: input.mode,
    body: input.body,
    createdAt: input.createdAt ?? nowIso(),
  };
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value == null || value.trim().length === 0 ? null : value;
}
