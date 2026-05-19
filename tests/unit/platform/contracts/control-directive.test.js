/**
 * Control Directive Contract Unit Tests
 *
 * Tests the control directive creation and validation logic.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createControlDirective } from "../../../../src/platform/contracts/control-directive/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("control-directive: createControlDirective rejects legacy pause directives", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
test("control-directive: createControlDirective rejects legacy resume directives", () => {
    assert.throws(() => createControlDirective({
        kind: "resume",
        targetRef: "task_456",
        reasonCode: "issue_resolved",
        issuedBy: "system",
        tenantId: "tenant_abc",
        executionId: "exec_789",
        metadata: { resumeReason: "manual" },
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
test("control-directive: createControlDirective throws when targetRef is empty", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
test("control-directive: createControlDirective throws when reasonCode is empty", () => {
    assert.throws(() => createControlDirective({
        kind: "cancel",
        targetRef: "task_123",
        reasonCode: "   ",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
test("control-directive: createControlDirective throws when issuedBy is empty", () => {
    assert.throws(() => createControlDirective({
        kind: "rollback",
        targetRef: "task_123",
        reasonCode: "failure",
        issuedBy: "",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
test("control-directive: createControlDirective accepts rollback kind", () => {
    assert.throws(() => createControlDirective({
        kind: "rollback",
        targetRef: "exec_abc",
        reasonCode: "critical_failure",
        issuedBy: "system",
        tenantId: null,
        executionId: "exec_abc",
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
test("control-directive: createControlDirective accepts escalate kind", () => {
    assert.throws(() => createControlDirective({
        kind: "escalate",
        targetRef: "task_789",
        reasonCode: "human_review_required",
        issuedBy: "ai_agent",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
test("control-directive: createControlDirective rejects even fully populated legacy directives", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
        directiveId: "custom_directive",
        createdAt: "2026-01-01T00:00:00.000Z",
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
//# sourceMappingURL=control-directive.test.js.map