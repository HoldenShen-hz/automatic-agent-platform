import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
export class HitlRuntime {
    requests = new Map();
    open(input) {
        const request = {
            requestId: newId("hitl"),
            runId: input.runId,
            domainId: input.domainId,
            reason: input.reason,
            evidenceRefs: [...input.evidenceRefs],
            requestedAt: nowIso(),
            status: "pending",
            resolvedAt: null,
            resolvedBy: null,
        };
        this.requests.set(request.requestId, request);
        return request;
    }
    resolve(requestId, resolution, actorId) {
        const request = this.requests.get(requestId);
        if (!request) {
            throw new Error(`harness.hitl.request_not_found:${requestId}`);
        }
        const resolved = {
            ...request,
            status: resolution,
            resolvedAt: nowIso(),
            resolvedBy: actorId,
        };
        this.requests.set(requestId, resolved);
        return resolved;
    }
    get(requestId) {
        return this.requests.get(requestId) ?? null;
    }
}
//# sourceMappingURL=hitl-runtime.js.map