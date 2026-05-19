/**
 * @deprecated This test suite validates the deprecated ControlDirective contract.
 * Per R6-29, these tests verify the legacy contract is properly blocked.
 * New tests should use OperationalDirective/DecisionDirective from executable-contracts instead.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createControlDirective, } from "../../../../../src/platform/contracts/control-directive/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
/**
 * @deprecated ControlDirectiveKind is deprecated per §4.3.
 * Use OperationalDirectiveType or DecisionDirectiveType instead.
 */
test("ControlDirectiveKind accepts the canonical directive kinds", () => {
    const kinds = ["pause", "resume", "cancel", "rollback", "escalate"];
    assert.equal(kinds.length, 5);
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 * Use createOperationalDirective or createDecisionDirective instead.
 */
test("createControlDirective fails fast because ControlDirective is no longer canonical", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: "tenant-1",
        executionId: "execution-1",
        metadata: { source: "console" },
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 */
test("createControlDirective generates a directiveId when not provided", () => {
    assert.throws(() => createControlDirective({
        kind: "resume",
        targetRef: "execution:1",
        reasonCode: "incident.resume",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 */
test("createControlDirective uses provided directiveId", () => {
    assert.throws(() => createControlDirective({
        directiveId: "custom-directive-id",
        kind: "cancel",
        targetRef: "execution:1",
        reasonCode: "user.cancel",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 */
test("createControlDirective sets createdAt to nowIso when not provided", () => {
    assert.throws(() => createControlDirective({
        kind: "rollback",
        targetRef: "execution:1",
        reasonCode: "incident.rollback",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 */
test("createControlDirective uses provided createdAt timestamp", () => {
    assert.throws(() => createControlDirective({
        kind: "escalate",
        targetRef: "execution:1",
        reasonCode: "incident.escalate",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
test("createControlDirective throws when targetRef is empty", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
test("createControlDirective throws when targetRef is only whitespace", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "   ",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
test("createControlDirective throws when reasonCode is empty", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
test("createControlDirective throws when issuedBy is empty", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), ValidationError);
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 */
test("createControlDirective allows null tenantId and executionId", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
});
/**
 * @deprecated createControlDirective is deprecated per §4.3.
 */
test("createControlDirective accepts all directive kinds", () => {
    for (const kind of ["pause", "resume", "cancel", "rollback", "escalate"]) {
        assert.throws(() => createControlDirective({
            kind,
            targetRef: "execution:1",
            reasonCode: "test",
            issuedBy: "operator:1",
            tenantId: null,
            executionId: null,
            metadata: {},
        }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden");
    }
});
/**
 * @deprecated ControlDirective interface is deprecated per §4.3.
 * Use OperationalDirective or DecisionDirective instead.
 */
test("ControlDirective interface accepts all fields", () => {
    const directive = {
        directiveId: "dir-123",
        kind: "pause",
        targetRef: "execution:1",
        reasonCode: "incident.freeze",
        issuedBy: "operator:1",
        tenantId: "tenant-1",
        executionId: "exec-1",
        metadata: { source: "api" },
        createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(directive.directiveId, "dir-123");
    assert.equal(directive.kind, "pause");
    assert.equal(directive.tenantId, "tenant-1");
    assert.equal(directive.executionId, "exec-1");
});
//# sourceMappingURL=index.test.js.map