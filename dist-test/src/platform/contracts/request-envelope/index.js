import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
export function createRequestEnvelope(input) {
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
function normalizeNullable(value) {
    return value == null || value.trim().length === 0 ? null : value;
}
//# sourceMappingURL=index.js.map