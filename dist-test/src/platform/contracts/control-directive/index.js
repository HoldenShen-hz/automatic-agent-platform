import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
export function createControlDirective(input) {
    assertRequired(input.targetRef, "control_directive.target_ref_required");
    assertRequired(input.reasonCode, "control_directive.reason_code_required");
    assertRequired(input.issuedBy, "control_directive.issued_by_required");
    return {
        directiveId: input.directiveId ?? newId("directive"),
        kind: input.kind,
        targetRef: input.targetRef,
        reasonCode: input.reasonCode,
        issuedBy: input.issuedBy,
        tenantId: input.tenantId ?? null,
        executionId: input.executionId ?? null,
        metadata: input.metadata,
        createdAt: input.createdAt ?? nowIso(),
    };
}
function assertRequired(value, code) {
    if (value.trim().length === 0) {
        throw new ValidationError(code, "Control directive field is required.");
    }
}
//# sourceMappingURL=index.js.map