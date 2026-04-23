import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
export function createDelegationRequest(input) {
    assertRequired(input.taskId, "delegation.task_id_required");
    assertRequired(input.fromAgentId, "delegation.from_agent_required");
    if ((input.toAgentId == null || input.toAgentId.trim().length === 0) && (input.capabilityRef == null || input.capabilityRef.trim().length === 0)) {
        throw new ValidationError("delegation.target_required", "Delegation request requires a target agent or capability reference.");
    }
    return {
        requestId: input.requestId ?? newId("delegate"),
        taskId: input.taskId,
        fromAgentId: input.fromAgentId,
        toAgentId: normalizeNullable(input.toAgentId),
        capabilityRef: normalizeNullable(input.capabilityRef),
        priority: input.priority,
        reason: input.reason,
        contextRef: normalizeNullable(input.contextRef),
        tenantId: normalizeNullable(input.tenantId),
        createdAt: input.createdAt ?? nowIso(),
    };
}
function assertRequired(value, code) {
    if (value.trim().length === 0) {
        throw new ValidationError(code, "Delegation request field is required.");
    }
}
function normalizeNullable(value) {
    return value == null || value.trim().length === 0 ? null : value;
}
//# sourceMappingURL=index.js.map