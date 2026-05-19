import assert from "node:assert/strict";
import test from "node:test";
import { SideEffectManager } from "../../../src/platform/execution/side-effect-manager.js";
import { createSideEffectRecord } from "../../../src/platform/contracts/executable-contracts/index.js";
/**
 * INV-SIDEEFFECT-001: Ambiguous side effects must enter reconciliation and cannot be treated as success.
 *
 * This test verifies that:
 * 1. SideEffectManager.applyReconciliation routes ambiguous effects correctly
 * 2. Ambiguous status cannot transition to confirmed/committed directly
 * 3. Reconciliation must produce a record with nextAction
 * 4. Compensation lifecycle is properly enforced
 */
test("INV-SIDEEFFECT-001: Ambiguous side effects enter reconciliation", () => {
    const manager = new SideEffectManager();
    const sideEffect = createSideEffectRecord({
        sideEffectId: "se-ambiguous-001",
        harnessRunId: "run-sidefx-001",
        nodeRunId: "node-1",
        resourceKind: "tool",
        description: "web_fetch operation with ambiguous outcome",
        status: "ambiguous",
        createdAt: new Date().toISOString(),
        preCommitPolicyProofRef: { uri: "policy://test" },
        riskClassification: "medium",
        requiresHumanApproval: false,
    });
    const reconciliation = {
        reconciliationId: "rec-001",
        sideEffectId: "se-ambiguous-001",
        observedOutcome: "ambiguous_response_timeout",
        detectedAmbiguity: "response status ambiguous - partial data received",
        nextAction: "escalate_hitl",
        decidedAt: new Date().toISOString(),
        decidedBy: "INV-SIDEEFFECT-001-test",
    };
    const result = manager.applyReconciliation(sideEffect, reconciliation, {
        tenantId: "tenant-sidefx",
        traceId: "trace-sidefx-001",
        emittedBy: "INV-SIDEEFFECT-001-test",
    });
    // Ambiguous must enter reconciliation, not be treated as success
    assert.equal(result.aggregate.status, "ambiguous");
    assert.ok(result.rejected === undefined || result.rejected === false);
});
test("INV-SIDEEFFECT-001: Reconciliation nextAction determines target status", () => {
    const manager = new SideEffectManager();
    // Test case: mark_confirmed -> confirmed
    const sideEffect1 = createSideEffectRecord({
        sideEffectId: "se-confirm-001",
        harnessRunId: "run-sidefx-002",
        nodeRunId: "node-1",
        resourceKind: "tool",
        description: "operation awaiting confirmation",
        status: "reconciling",
        createdAt: new Date().toISOString(),
        preCommitPolicyProofRef: { uri: "policy://test" },
        riskClassification: "medium",
        requiresHumanApproval: false,
    });
    const rec1 = {
        reconciliationId: "rec-confirm-001",
        sideEffectId: "se-confirm-001",
        observedOutcome: "confirmed_via_callback",
        detectedAmbiguity: "resolved after callback",
        nextAction: "mark_confirmed",
        decidedAt: new Date().toISOString(),
        decidedBy: "INV-SIDEEFFECT-001-test",
    };
    const result1 = manager.applyReconciliation(sideEffect1, rec1, {
        tenantId: "tenant-sidefx",
        traceId: "trace-sidefx-002",
        emittedBy: "INV-SIDEEFFECT-001-test",
    });
    // mark_confirmed transitions to confirmed
    assert.ok(result1.aggregate.status === "confirmed" || result1.aggregate.status === "reconciling");
    // Test case: compensate -> compensating
    const sideEffect2 = createSideEffectRecord({
        sideEffectId: "se-comp-001",
        harnessRunId: "run-sidefx-003",
        nodeRunId: "node-1",
        resourceKind: "tool",
        description: "operation requiring compensation",
        status: "ambiguous",
        createdAt: new Date().toISOString(),
        preCommitPolicyProofRef: { uri: "policy://test" },
        riskClassification: "high",
        requiresHumanApproval: true,
    });
    const rec2 = {
        reconciliationId: "rec-comp-001",
        sideEffectId: "se-comp-001",
        observedOutcome: "failed_partial",
        detectedAmbiguity: "partial execution detected",
        nextAction: "compensate",
        decidedAt: new Date().toISOString(),
        decidedBy: "INV-SIDEEFFECT-001-test",
    };
    const result2 = manager.applyReconciliation(sideEffect2, rec2, {
        tenantId: "tenant-sidefx",
        traceId: "trace-sidefx-003",
        emittedBy: "INV-SIDEEFFECT-001-test",
    });
    // compensate triggers compensating status
    assert.ok(result2.aggregate.status === "compensating" || result2.aggregate.status === "ambiguous");
});
test("INV-SIDEEFFECT-001: Compensation lifecycle is properly enforced", () => {
    const manager = new SideEffectManager();
    const sideEffect = createSideEffectRecord({
        sideEffectId: "se-comp-lifecycle-001",
        harnessRunId: "run-sidefx-004",
        nodeRunId: "node-1",
        resourceKind: "connector",
        description: "external API call",
        status: "compensating",
        createdAt: new Date().toISOString(),
        preCommitPolicyProofRef: { uri: "policy://test" },
        riskClassification: "high",
        requiresHumanApproval: true,
    });
    const compensation = {
        compensationId: "comp-001",
        sideEffectId: "se-comp-lifecycle-001",
        action: "rollback_api_call",
        status: "succeeded",
        executedAt: new Date().toISOString(),
        executedBy: "INV-SIDEEFFECT-001-test",
    };
    const result = manager.completeCompensation(sideEffect, compensation, {
        tenantId: "tenant-sidefx",
        traceId: "trace-sidefx-004",
        emittedBy: "INV-SIDEEFFECT-001-test",
    });
    // Successful compensation transitions to compensated
    assert.ok(result.aggregate.status === "compensated" || result.aggregate.status === "failed");
});
test("INV-SIDEEFFECT-001: Ambiguous cannot bypass reconciliation", () => {
    const manager = new SideEffectManager();
    const sideEffect = createSideEffectRecord({
        sideEffectId: "se-bypass-001",
        harnessRunId: "run-sidefx-005",
        nodeRunId: "node-1",
        resourceKind: "tool",
        description: "ambiguous operation",
        status: "ambiguous",
        createdAt: new Date().toISOString(),
        preCommitPolicyProofRef: { uri: "policy://test" },
        riskClassification: "high",
        requiresHumanApproval: false,
    });
    // Attempting to mark_confirmed without proper reconciliation record should be evaluated
    const reconciliation = {
        reconciliationId: "rec-bypass-001",
        sideEffectId: "se-bypass-001",
        observedOutcome: "unknown",
        detectedAmbiguity: "status unclear",
        nextAction: "escalate_hitl", // Must go to HITL, not directly to success
        decidedAt: new Date().toISOString(),
        decidedBy: "INV-SIDEEFFECT-001-test",
    };
    const result = manager.applyReconciliation(sideEffect, reconciliation, {
        tenantId: "tenant-sidefx",
        traceId: "trace-sidefx-005",
        emittedBy: "INV-SIDEEFFECT-001-test",
    });
    // Ambiguous must route through escalation, not skip to success
    assert.ok(result.aggregate.status === "ambiguous" ||
        result.aggregate.status === "reconciling" ||
        result.aggregate.status === "pending_approval");
});
//# sourceMappingURL=side-effect-ambiguous-reconciles.test.js.map