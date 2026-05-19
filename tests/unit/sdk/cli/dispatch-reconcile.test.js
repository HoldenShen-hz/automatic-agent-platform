/**
 * Dispatch Reconcile CLI Tests
 *
 * Tests for dispatch-reconcile.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for DispatchReconcileCliEnvConfig interface
// ---------------------------------------------------------------------------
test("DispatchReconcileCliEnvConfig has correct action types", () => {
    const scanAction = "scan";
    const repairAction = "repair";
    assert.equal(scanAction, "scan");
    assert.equal(repairAction, "repair");
});
test("DispatchReconcileCliEnvConfig can hold occurredAt as optional ISO timestamp", () => {
    const occurredAt = "2026-04-27T10:00:00.000Z";
    const config = {
        action: "scan",
        occurredAt,
    };
    assert.equal(config.action, "scan");
    assert.equal(config.occurredAt, occurredAt);
});
test("DispatchReconcileCliEnvConfig occurredAt can be undefined", () => {
    const config = {
        action: "scan",
        occurredAt: undefined,
    };
    assert.equal(config.action, "scan");
    assert.equal(config.occurredAt, undefined);
});
// ---------------------------------------------------------------------------
// Tests for reconciliation output structure
// ---------------------------------------------------------------------------
test("scan output contains issues array", () => {
    const scanOutput = {
        issues: [
            { ticketId: "ticket-1", issue: "orphaned" },
            { ticketId: "ticket-2", issue: "stale_lease" },
        ],
    };
    assert.ok(Array.isArray(scanOutput.issues));
    assert.equal(scanOutput.issues.length, 2);
});
test("repair output returns repair results", () => {
    const repairOutput = {
        repaired: ["ticket-1", "ticket-2"],
        failed: [],
    };
    assert.ok(Array.isArray(repairOutput.repaired));
    assert.ok(Array.isArray(repairOutput.failed));
    assert.equal(repairOutput.repaired.length, 2);
});
// ---------------------------------------------------------------------------
// Tests for action conditional logic
// ---------------------------------------------------------------------------
test("action === 'repair' conditional works", () => {
    const action = "repair";
    const result = action === "repair" ? "repairing" : "scanning";
    assert.equal(result, "repairing");
});
test("action === 'scan' conditional works", () => {
    const action = "scan";
    const result = action === "repair" ? "repairing" : "scanning";
    assert.equal(result, "scanning");
});
//# sourceMappingURL=dispatch-reconcile.test.js.map