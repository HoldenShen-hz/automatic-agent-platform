import assert from "node:assert/strict";
import test from "node:test";
import { ReplayBoundaryGuard } from "../../../src/platform/execution/recovery/replay-boundary-guard.js";
/**
 * INV-REPLAY-001: Replay and simulation must never produce real external side effects.
 *
 * This test verifies that:
 * 1. Trace replay blocks real side effects
 * 2. Reexecution replay blocks real side effects
 * 3. Projection replay allows projections without side effects
 * 4. Tombstone boundaries are enforced
 */
test("INV-REPLAY-001: Trace replay blocks real side effects", () => {
    const guard = new ReplayBoundaryGuard();
    const operations = [
        {
            operationId: "op-1",
            resourceKind: "tool",
            hasRealSideEffect: true,
            tombstoneReplay: false,
        },
        {
            operationId: "op-2",
            resourceKind: "llm",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
    ];
    const decision = guard.evaluate("trace_replay", operations);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "replay.real_side_effect_blocked");
    assert.deepEqual(decision.blockedOperationIds, ["op-1"]);
});
test("INV-REPLAY-001: Reexecution replay blocks real side effects", () => {
    const guard = new ReplayBoundaryGuard();
    const operations = [
        {
            operationId: "op-web-fetch",
            resourceKind: "tool",
            hasRealSideEffect: true, // Web fetch creates real network side effect
            tombstoneReplay: false,
        },
    ];
    const decision = guard.evaluate("reexecution_replay", operations);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "replay.real_side_effect_blocked");
});
test("INV-REPLAY-001: Projection replay allows non-side-effect operations", () => {
    const guard = new ReplayBoundaryGuard();
    const operations = [
        {
            operationId: "op-projection-1",
            resourceKind: "projection",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
        {
            operationId: "op-projection-2",
            resourceKind: "projection",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
    ];
    const decision = guard.evaluate("projection_replay", operations);
    assert.equal(decision.allowed, true);
    assert.equal(decision.reasonCode, "replay.allowed");
    assert.deepEqual(decision.blockedOperationIds, []);
});
test("INV-REPLAY-001: Tombstone boundary violations are blocked", () => {
    const guard = new ReplayBoundaryGuard();
    const operations = [
        {
            operationId: "op-tombstone",
            resourceKind: "tool", // Tombstone for non-projection is violation
            hasRealSideEffect: false,
            tombstoneReplay: true,
        },
    ];
    const decision = guard.evaluate("trace_replay", operations);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "replay.tombstone_boundary_violation");
    assert.deepEqual(decision.blockedOperationIds, ["op-tombstone"]);
});
test("INV-REPLAY-001: Mixed operations - some blocked, some allowed", () => {
    const guard = new ReplayBoundaryGuard();
    const operations = [
        {
            operationId: "op-safe-1",
            resourceKind: "projection",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
        {
            operationId: "op-dangerous-1",
            resourceKind: "tool",
            hasRealSideEffect: true,
            tombstoneReplay: false,
        },
        {
            operationId: "op-safe-2",
            resourceKind: "llm",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
        {
            operationId: "op-dangerous-2",
            resourceKind: "connector",
            hasRealSideEffect: true,
            tombstoneReplay: false,
        },
    ];
    const decision = guard.evaluate("trace_replay", operations);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "replay.real_side_effect_blocked");
    assert.deepEqual(decision.blockedOperationIds.sort(), ["op-dangerous-1", "op-dangerous-2"].sort());
});
test("INV-REPLAY-001: All operations allowed when no side effects", () => {
    const guard = new ReplayBoundaryGuard();
    const operations = [
        {
            operationId: "op-read-1",
            resourceKind: "llm",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
        {
            operationId: "op-read-2",
            resourceKind: "projection",
            hasRealSideEffect: false,
            tombstoneReplay: false,
        },
    ];
    const decision = guard.evaluate("trace_replay", operations);
    assert.equal(decision.allowed, true);
    assert.equal(decision.reasonCode, "replay.allowed");
    assert.deepEqual(decision.blockedOperationIds, []);
});
//# sourceMappingURL=no-side-effect-in-replay.test.js.map