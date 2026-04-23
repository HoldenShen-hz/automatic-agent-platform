import { newId, nowIso } from "./ids.js";
function stringifyRecord(input) {
    if (input == null) {
        return {};
    }
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
}
export function createPlatformPrincipal(input) {
    return {
        actorId: input.actorId,
        tenantId: input.tenantId,
        roles: input.roles ?? [],
        ...(input.authMethod != null ? { authMethod: input.authMethod } : {}),
        ...(input.displayName != null ? { displayName: input.displayName } : {}),
    };
}
export function createRequestEnvelope(input) {
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
export function createControlDirective(input) {
    return {
        directiveId: input.directiveId ?? newId("directive"),
        type: input.type,
        targetScope: input.targetScope ?? {},
        issuedBy: input.issuedBy,
        reason: input.reason,
        params: (input.params ?? {}),
        ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
    };
}
export function createExecutionPlan(input) {
    return {
        planId: input.planId ?? newId("plan"),
        traceId: input.traceId,
        principal: input.principal,
        workflowRunId: input.workflowRunId,
        steps: input.steps,
        fallbackStrategy: input.fallbackStrategy ?? "retry",
        approvalGates: input.approvalGates ?? [],
        sideEffectExpectations: input.sideEffectExpectations ?? [],
        budget: input.budget,
        createdAt: input.createdAt ?? nowIso(),
    };
}
export function createExecutionReceipt(input) {
    return {
        receiptId: input.receiptId ?? newId("receipt"),
        planId: input.planId,
        stepId: input.stepId,
        status: input.status,
        durationMs: input.durationMs,
        sideEffects: input.sideEffects ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
        ...(input.errorDetail != null ? { errorDetail: input.errorDetail } : {}),
    };
}
export function createStateCommand(input) {
    return {
        commandId: input.commandId ?? newId("statecmd"),
        traceId: input.traceId,
        principal: input.principal,
        type: input.type,
        aggregateId: input.aggregateId,
        expectedVersion: input.expectedVersion,
        fencingToken: input.fencingToken,
        payload: input.payload,
    };
}
export function createEvidenceRecord(input) {
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
export function createProjectionUpdate(input) {
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
//# sourceMappingURL=platform-contracts.js.map