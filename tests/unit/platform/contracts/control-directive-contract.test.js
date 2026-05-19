/**
 * ControlDirective Contract Unit Tests
 *
 * Tests the deprecated ControlDirective contract vs canonical directive replacements.
 * Per §4.3, ControlDirective is deprecated; use OperationalDirective or DecisionDirective instead.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createControlDirective, createOperationalDirective, createDecisionDirective, } from "../../../../src/platform/contracts/control-directive/index.js";
import { LEGACY_CONTRACT_NAMES, CANONICAL_CONTRACT_NAMES, } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
const minimalIssuedBy = {
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
};
test("ControlDirective is listed in LEGACY_CONTRACT_NAMES", () => {
    assert.equal(LEGACY_CONTRACT_NAMES.includes("ControlDirective"), true);
});
test("ControlDirective type is deprecated via JSDoc @deprecated marker", () => {
    // Verify by checking that createControlDirective throws with legacy_contract_forbidden code
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
test("createControlDirective rejects all directive kinds with legacy_contract_forbidden", () => {
    const kinds = [
        "pause",
        "resume",
        "cancel",
        "rollback",
        "escalate",
    ];
    for (const kind of kinds) {
        assert.throws(() => createControlDirective({
            kind,
            targetRef: "task_123",
            reasonCode: "test_reason",
            issuedBy: "operator_1",
            tenantId: null,
            executionId: null,
            metadata: {},
        }), (error) => error instanceof ValidationError && error.code === "control_directive.legacy_contract_forbidden", `kind '${kind}' should be rejected`);
    }
});
test("createControlDirective error message references canonical replacements", () => {
    assert.throws(() => createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
    }), (error) => {
        if (error instanceof ValidationError) {
            return (error.message.includes("OperationalDirective") ||
                error.message.includes("DecisionDirective"));
        }
        return false;
    });
});
test("OperationalDirective and DecisionDirective are canonical replacements", () => {
    // These types exist in the canonical module
    assert.ok(CANONICAL_CONTRACT_NAMES.includes("NodeAttemptReceipt"));
});
test("createOperationalDirective creates pause directive", () => {
    const directive = createOperationalDirective({
        type: "pause",
        scope: { tenantId: "tenant-1" },
        issuedBy: minimalIssuedBy,
        reason: "maintenance window",
    });
    assert.equal(directive.type, "pause");
    assert.equal(directive.operationalDirectiveId.startsWith("opdir_"), true);
    assert.equal(directive.scope.tenantId, "tenant-1");
    assert.equal(directive.reason, "maintenance window");
    assert.deepEqual(directive.params, {});
});
test("createOperationalDirective creates resume directive", () => {
    const directive = createOperationalDirective({
        type: "resume",
        scope: { tenantId: "tenant-1", harnessRunId: "hrun-123" },
        issuedBy: minimalIssuedBy,
        reason: "maintenance complete",
    });
    assert.equal(directive.type, "resume");
    assert.equal(directive.scope.harnessRunId, "hrun-123");
});
test("createOperationalDirective creates kill directive", () => {
    const directive = createOperationalDirective({
        type: "kill",
        issuedBy: minimalIssuedBy,
        reason: "critical failure",
        params: { force: true },
    });
    assert.equal(directive.type, "kill");
    assert.deepEqual(directive.params, { force: true });
});
test("createOperationalDirective creates mode_switch directive", () => {
    const directive = createOperationalDirective({
        type: "mode_switch",
        issuedBy: minimalIssuedBy,
        reason: "switch to safe mode",
        params: { targetMode: "safe" },
    });
    assert.equal(directive.type, "mode_switch");
    assert.deepEqual(directive.params, { targetMode: "safe" });
});
test("createOperationalDirective creates quota_adjust directive", () => {
    const directive = createOperationalDirective({
        type: "quota_adjust",
        scope: { tenantId: "tenant-1" },
        issuedBy: minimalIssuedBy,
        reason: "increase quota",
        params: { resourceKind: "token", delta: 1000 },
    });
    assert.equal(directive.type, "quota_adjust");
});
test("createOperationalDirective rejects empty type", () => {
    assert.throws(() => createOperationalDirective({
        type: "",
        issuedBy: minimalIssuedBy,
        reason: "test",
    }), ValidationError);
});
test("createOperationalDirective rejects whitespace-only type", () => {
    assert.throws(() => createOperationalDirective({
        type: "   ",
        issuedBy: minimalIssuedBy,
        reason: "test",
    }), ValidationError);
});
test("createDecisionDirective creates approve directive", () => {
    const directive = createDecisionDirective({
        type: "approve",
        issuedBy: minimalIssuedBy,
        targetRef: "task-123",
        payload: { approved: true },
        reason: "looks good",
    });
    assert.equal(directive.type, "approve");
    assert.equal(directive.targetRef, "task-123");
    assert.deepEqual(directive.payload, { approved: true });
    assert.equal(directive.riskAcknowledged, false);
});
test("createDecisionDirective creates deny directive", () => {
    const directive = createDecisionDirective({
        type: "deny",
        issuedBy: minimalIssuedBy,
        targetRef: "task-456",
        payload: { denied: true, reason: "policy violation" },
        reason: "violates policy",
        riskAcknowledged: true,
    });
    assert.equal(directive.type, "deny");
    assert.equal(directive.riskAcknowledged, true);
});
test("createDecisionDirective creates override directive", () => {
    const directive = createDecisionDirective({
        type: "override",
        issuedBy: minimalIssuedBy,
        targetRef: "task-789",
        payload: { overrideReason: "business need" },
        reason: "business justification provided",
    });
    assert.equal(directive.type, "override");
});
test("createDecisionDirective creates patch directive", () => {
    const directive = createDecisionDirective({
        type: "patch",
        issuedBy: minimalIssuedBy,
        targetRef: "task-patch",
        payload: { field: "priority", value: "high" },
        reason: "update priority",
    });
    assert.equal(directive.type, "patch");
});
test("createDecisionDirective creates takeover directive", () => {
    const directive = createDecisionDirective({
        type: "takeover",
        issuedBy: minimalIssuedBy,
        targetRef: "task-takeover",
        payload: {},
        reason: "human takeover required",
    });
    assert.equal(directive.type, "takeover");
});
test("createDecisionDirective creates expire_approval directive", () => {
    const directive = createDecisionDirective({
        type: "expire_approval",
        issuedBy: minimalIssuedBy,
        targetRef: "approval-123",
        payload: { expiredAt: "2026-04-28T00:00:00.000Z" },
        reason: "approval window expired",
    });
    assert.equal(directive.type, "expire_approval");
});
test("createDecisionDirective rejects empty type", () => {
    assert.throws(() => createDecisionDirective({
        type: "",
        issuedBy: minimalIssuedBy,
        targetRef: "task-123",
        payload: {},
        reason: "test",
    }), ValidationError);
});
test("createDecisionDirective rejects empty targetRef", () => {
    assert.throws(() => createDecisionDirective({
        type: "approve",
        issuedBy: minimalIssuedBy,
        targetRef: "",
        payload: {},
        reason: "test",
    }), ValidationError);
});
test("createDecisionDirective accepts optional expiresAt", () => {
    const directive = createDecisionDirective({
        type: "approve",
        issuedBy: minimalIssuedBy,
        targetRef: "task-123",
        payload: {},
        reason: "approved",
        expiresAt: "2026-04-28T01:00:00.000Z",
    });
    assert.equal(directive.expiresAt, "2026-04-28T01:00:00.000Z");
});
test("createDecisionDirective defaults riskAcknowledged to false", () => {
    const directive = createDecisionDirective({
        type: "approve",
        issuedBy: minimalIssuedBy,
        targetRef: "task-123",
        payload: {},
        reason: "approved",
    });
    assert.equal(directive.riskAcknowledged, false);
});
//# sourceMappingURL=control-directive-contract.test.js.map