import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeEntryGuard } from "../../../src/platform/orchestration/harness/runtime/runtime-entry-guard.js";
/**
 * INV-POLICY-001: Undefined or unproven capability must converge to deny,
 * degrade, require approval, supervised, no-write, no-external-call, or manual-only.
 *
 * This test verifies that:
 * 1. RuntimeEntryGuard.assertNoLegacyTruthWrite blocks legacy contract writes
 * 2. PlanGraphBundle is the only accepted execution contract
 * 3. Non-platform event types are rejected
 * 4. Legacy contract names are blocked
 */
test("INV-POLICY-001: RuntimeEntryGuard blocks legacy contract writes", () => {
    const guard = new RuntimeEntryGuard();
    // Legacy contract names that must be blocked
    const legacyContracts = [
        { contractName: "ExecutionPlan" },
        { contractName: "ExecutionReceipt" },
        { contractName: "ControlDirective" },
        { contractName: "WorkflowStep" },
        { contractName: "StepOutput" },
    ];
    for (const legacy of legacyContracts) {
        assert.throws(() => guard.assertNoLegacyTruthWrite(legacy), /legacy_contract_forbidden/, `${legacy.contractName} must be blocked`);
    }
});
test("INV-POLICY-001: Non-platform event types are rejected", () => {
    const guard = new RuntimeEntryGuard();
    // Event types not starting with "platform." must be blocked
    const invalidEventTypes = [
        { eventType: "task.status_changed" },
        { eventType: "workflow.started" },
        { eventType: "execution.completed" },
        { eventType: "delegation.initiated" },
        { eventType: "oapeflir.observe" },
    ];
    for (const invalid of invalidEventTypes) {
        assert.throws(() => guard.assertNoLegacyTruthWrite(invalid), /platform_fact_required/, `${invalid.eventType} must be rejected`);
    }
});
test("INV-POLICY-001: Platform.* event types are accepted", () => {
    const guard = new RuntimeEntryGuard();
    // Platform.* events are valid
    const validEvents = [
        { eventType: "platform.harness_run.created" },
        { eventType: "platform.node_run.status_changed" },
        { eventType: "platform.side_effect.committed" },
        { eventType: "platform.budget.reserved" },
    ];
    for (const valid of validEvents) {
        // Should not throw - platform events are allowed
        guard.assertNoLegacyTruthWrite(valid);
    }
});
test("INV-POLICY-001: PlanGraphBundle is the only accepted execution contract", () => {
    const guard = new RuntimeEntryGuard();
    // Valid PlanGraphBundle
    const validBundle = {
        planGraphBundleId: "bundle-001",
        harnessRunId: "run-001",
        graphVersion: 1,
        graph: {
            nodes: [],
            edges: [],
        },
    };
    const result = guard.assertPlanGraphBundleOnly(validBundle);
    assert.equal(result.accepted, true);
    assert.equal(result.planGraphBundle, validBundle);
});
test("INV-POLICY-001: Non-PlanGraphBundle inputs are rejected", () => {
    const guard = new RuntimeEntryGuard();
    // Legacy execution plan - must be rejected
    const legacyPlan = {
        planId: "plan-001",
        steps: [
            { stepId: "step-1", name: "Analyze" },
            { stepId: "step-2", name: "Execute" },
        ],
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(legacyPlan), /plan_graph_bundle_required/, "Legacy execution plan must be rejected");
    // Null/undefined
    assert.throws(() => guard.assertPlanGraphBundleOnly(null), /plan_graph_bundle_required/, "Null must be rejected");
    // Partial bundle missing required fields
    const partialBundle = {
        planGraphBundleId: "bundle-001",
        // missing harnessRunId, graphVersion, graph
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(partialBundle), /plan_graph_bundle_required/, "Incomplete PlanGraphBundle must be rejected");
});
test("INV-POLICY-001: Deny-by-default for unknown capabilities", () => {
    const guard = new RuntimeEntryGuard();
    // Unknown contract with no explicit allowance
    const unknownContract = { contractName: "SomeUnknownContract" };
    // Should not throw because it's not in the legacy block list
    // But any non-platform event should still be blocked
    const unknownWithEvent = {
        contractName: "SomeUnknownContract",
        eventType: "unknown.event",
    };
    assert.throws(() => guard.assertNoLegacyTruthWrite(unknownWithEvent), /platform_fact_required/, "Non-platform event types default to deny");
});
//# sourceMappingURL=deny-by-default.test.js.map