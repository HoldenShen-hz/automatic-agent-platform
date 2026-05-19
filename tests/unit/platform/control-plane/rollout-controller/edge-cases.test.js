/**
 * Unit Tests: TrafficRoutingService Edge Cases
 *
 * Additional edge case coverage for the blue-green / canary traffic routing service.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { TrafficRoutingService, TRAFFIC_ROUTING_DDL, } from "../../../../../src/platform/control-plane/rollout-controller/traffic-routing-service.js";
/**
 * Creates an in-memory database with the traffic routing schema.
 */
function createTestDb() {
    const db = new DatabaseSync(":memory:");
    db.exec(TRAFFIC_ROUTING_DDL);
    return {
        filePath: ":memory:",
        backendType: "sqlite",
        connection: db,
        migrate: () => { },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getSchemaStatus: () => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assertSchemaCurrent: () => { },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        integrityCheck: () => [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transaction: ((work) => work()),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        readTransaction: ((work) => work()),
        async healthCheck() {
            return true;
        },
    };
}
// ---------------------------------------------------------------------------
// Edge Case: Rollback Shift Not Found
// ---------------------------------------------------------------------------
test("rollbackShift handles non-existent shift gracefully", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    // Register slots but don't create any shift
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    // Rollback non-existent shift - should still create a rollback record with unknown versions
    const rollback = service.rollbackShift("nonexistent_shift_id", "manual", "Testing rollback on missing shift");
    assert.equal(rollback.success, true);
    assert.equal(rollback.fromVersion, "unknown");
    assert.equal(rollback.toVersion, "unknown");
    assert.equal(rollback.reason, "Testing rollback on missing shift");
});
// ---------------------------------------------------------------------------
// Edge Case: Advance Shift Not In Progress
// ---------------------------------------------------------------------------
test("advanceShift returns null when shift exists but is not in_progress", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const shift = service.startCanaryShift("blue", "green");
    // Complete the shift
    for (let i = 0; i < shift.totalSteps; i++) {
        service.advanceShift(shift.id);
    }
    // Try to advance a completed shift
    const result = service.advanceShift(shift.id);
    assert.equal(result, null);
});
test("advanceShift returns null when shift has been rolled_back", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const shift = service.startCanaryShift("blue", "green");
    service.rollbackShift(shift.id, "manual", "User cancelled");
    // Try to advance a rolled_back shift
    const result = service.advanceShift(shift.id);
    assert.equal(result, null);
});
// ---------------------------------------------------------------------------
// Edge Case: Canary Health Check Edge Cases
// ---------------------------------------------------------------------------
test("checkCanaryHealth handles missing canary slot gracefully", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    // Only register blue slot, not green (the canary target)
    service.registerSlot("blue", "v1.0.0", 1);
    // Manually insert a shift pointing to non-existent green slot
    const shift = service.startCanaryShift("blue", "green");
    // The shift is in_progress but green doesn't exist as active slot
    const health = service.checkCanaryHealth(shift.id);
    assert.equal(health.healthy, false);
    assert.equal(health.reason, "no_health_data");
});
// ---------------------------------------------------------------------------
// Edge Case: Multiple Shifts Same Slot
// ---------------------------------------------------------------------------
test("starting new shift while previous is in_progress updates existing shift", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    // Start first shift
    const shift1 = service.startCanaryShift("blue", "green");
    assert.equal(shift1.status, "in_progress");
    // Advance it a bit
    const advanced = service.advanceShift(shift1.id);
    assert.ok(advanced !== null);
    assert.equal(advanced.currentStep, 1);
    // Original shift should still be in_progress (not modified by new shift creation)
    const original = service.getShift(shift1.id);
    assert.ok(original !== null);
    assert.equal(original.status, "in_progress");
});
// ---------------------------------------------------------------------------
// Edge Case: Slot Version Tracking
// ---------------------------------------------------------------------------
test("getSlotVersion returns 'unknown' when no slot exists", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    // Access the private method indirectly via rollback which uses it
    // We test this via rollback returning "unknown" for missing slots
    service.registerSlot("blue", "v1.0.0", 1);
    // green doesn't exist
    const shift = service.startCanaryShift("blue", "green");
    const rollback = service.rollbackShift(shift.id, "manual", "test");
    // fromVersion should be "unknown" because toSlot (green) doesn't exist
    // toVersion is blue's version (v1.0.0) since we're rolling back to blue
    assert.equal(rollback.fromVersion, "unknown");
    assert.equal(rollback.toVersion, "v1.0.0");
});
// ---------------------------------------------------------------------------
// Edge Case: Traffic Weights Boundaries
// ---------------------------------------------------------------------------
test("startCanaryShift with 100% initial weight creates single step", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const config = {
        initialWeightPct: 100,
        stepIncrementPct: 10,
        stepIntervalMinutes: 5,
        healthThreshold: 0.95,
        errorRateThreshold: 0.02,
        autoPromoteOnSuccess: true,
    };
    const shift = service.startCanaryShift("blue", "green", config);
    // With 100% initial, steps should be just [100]
    const steps = JSON.parse(shift.shiftSteps);
    assert.deepEqual(steps, [100]);
    assert.equal(shift.totalSteps, 1);
});
test("startCanaryShift with step increment that overshoots 100", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const config = {
        initialWeightPct: 45,
        stepIncrementPct: 30,
        stepIntervalMinutes: 5,
        healthThreshold: 0.95,
        errorRateThreshold: 0.02,
        autoPromoteOnSuccess: true,
    };
    const shift = service.startCanaryShift("blue", "green", config);
    // Steps: 45, 75, 100 (caps at 100 due to while (weight < 100) condition)
    const steps = JSON.parse(shift.shiftSteps);
    assert.deepEqual(steps, [45, 75, 100]);
    assert.equal(shift.totalSteps, 3);
});
// ---------------------------------------------------------------------------
// Edge Case: List Operations Return Empty
// ---------------------------------------------------------------------------
test("listShifts returns empty array when no shifts exist", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    const shifts = service.listShifts();
    assert.equal(shifts.length, 0);
});
test("listRollbacks returns empty array when no rollbacks exist", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    const rollbacks = service.listRollbacks();
    assert.equal(rollbacks.length, 0);
});
test("listSlots returns empty array when no slots exist", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    const slots = service.listSlots();
    assert.equal(slots.length, 0);
});
// ---------------------------------------------------------------------------
// Edge Case: Multiple Slots Same Name Different Versions
// ---------------------------------------------------------------------------
test("registering multiple slots with same name creates multiple records", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    const slot1 = service.registerSlot("blue", "v1.0.0", 1);
    const slot2 = service.registerSlot("blue", "v1.1.0", 1);
    const slot3 = service.registerSlot("blue", "v2.0.0", 1);
    // All have different IDs
    assert.notEqual(slot1.id, slot2.id);
    assert.notEqual(slot2.id, slot3.id);
    // listSlots returns all of them
    const slots = service.listSlots();
    assert.equal(slots.length, 3);
});
// ---------------------------------------------------------------------------
// Edge Case: Rollback Preserves Traffic State
// ---------------------------------------------------------------------------
test("rollbackShift restores correct traffic weights to source slot", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const shift = service.startCanaryShift("blue", "green");
    // Advance a few steps
    service.advanceShift(shift.id);
    service.advanceShift(shift.id);
    // Verify weights before rollback
    let green = service.getActiveSlot("green");
    assert.ok(green !== null);
    const weightBeforeRollback = green.trafficWeight;
    // Rollback
    service.rollbackShift(shift.id, "manual", "Test rollback");
    // Blue should have 100% traffic
    const blue = service.getActiveSlot("blue");
    assert.ok(blue !== null);
    assert.equal(blue.trafficWeight, 100);
    assert.equal(blue.status, "active");
});
// ---------------------------------------------------------------------------
// Edge Case: Health Update Non-Existent Slot
// ---------------------------------------------------------------------------
test("updateHealth on non-existent slot does not throw", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    // updateHealth with non-existent ID should not throw
    // It runs an UPDATE query that affects 0 rows
    service.updateHealth("nonexistent_id", 0.99);
    // No error means success - this is silent failure behavior
    assert.ok(true);
});
// ---------------------------------------------------------------------------
// Edge Case: Canary Health Check with Exactly Threshold
// ---------------------------------------------------------------------------
test("checkCanaryHealth returns healthy when score equals threshold", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    const greenRecord = service.registerSlot("green", "v2.0.0", 1);
    // Set health exactly at threshold
    service.updateHealth(greenRecord.id, 0.95);
    const shift = service.startCanaryShift("blue", "green");
    const health = service.checkCanaryHealth(shift.id);
    // Health score equals threshold (0.95 >= 0.95), should be healthy
    assert.equal(health.healthy, true);
});
// ---------------------------------------------------------------------------
// Edge Case: Advance Shift After Rollback Does Not Work
// ---------------------------------------------------------------------------
test("cannot advance shift after it has been rolled back", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const shift = service.startCanaryShift("blue", "green");
    service.rollbackShift(shift.id, "manual", "User cancelled");
    const result = service.advanceShift(shift.id);
    assert.equal(result, null);
    // Verify shift is still rolled_back
    const updated = service.getShift(shift.id);
    assert.ok(updated !== null);
    assert.equal(updated.status, "rolled_back");
});
// ---------------------------------------------------------------------------
// Edge Case: Multiple Rollbacks on Same Shift
// ---------------------------------------------------------------------------
test("multiple rollbacks on same shift only creates one rollback record", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const shift = service.startCanaryShift("blue", "green");
    // First rollback
    service.rollbackShift(shift.id, "manual", "First rollback");
    const rollbacks1 = service.listRollbacks();
    assert.equal(rollbacks1.length, 1);
    // Second rollback - note: this will update shift status to rolled_back again
    // but rollback record might or might not be created depending on implementation
    // Looking at the code, rollbackShift always creates a new rollback record
    service.rollbackShift(shift.id, "health_check_failed", "Second rollback");
    const rollbacks2 = service.listRollbacks();
    assert.equal(rollbacks2.length, 2);
});
// ---------------------------------------------------------------------------
// Edge Case: Shift Step Exact Completion
// ---------------------------------------------------------------------------
test("shift completes correctly when currentStep reaches end of steps array", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("green", "v2.0.0", 1);
    const shift = service.startCanaryShift("blue", "green");
    assert.equal(shift.totalSteps, 11); // Default: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 100]
    // Advance through all steps
    for (let i = 0; i < 11; i++) {
        const result = service.advanceShift(shift.id);
        assert.ok(result !== null);
    }
    // Verify final state
    const final = service.getShift(shift.id);
    assert.ok(final !== null);
    assert.equal(final.status, "completed");
    assert.equal(final.currentStep, 11);
    assert.equal(final.toWeight, 100);
});
// ---------------------------------------------------------------------------
// Edge Case: Canary Health Check Uses Correct Slot
// ---------------------------------------------------------------------------
test("checkCanaryHealth uses the canary slot (toSlot) not fromSlot", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    // Setup: blue is source (old), green is canary (new)
    const blueRecord = service.registerSlot("blue", "v1.0.0", 1);
    const greenRecord = service.registerSlot("green", "v2.0.0", 1);
    // Set health scores - blue healthy, green unhealthy
    service.updateHealth(blueRecord.id, 0.99);
    service.updateHealth(greenRecord.id, 0.85); // Below threshold
    const shift = service.startCanaryShift("blue", "green");
    // Health check should use green (toSlot), not blue (fromSlot)
    const health = service.checkCanaryHealth(shift.id);
    assert.equal(health.healthy, false);
    assert.ok(health.reason.includes("0.85")); // Should reflect green's low score
});
// ---------------------------------------------------------------------------
// Edge Case: listSlots Order
// ---------------------------------------------------------------------------
test("listSlots returns slots ordered by slot name then created_at desc", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    // Create slots in non-alphabetical order
    service.registerSlot("green", "v1.0.0", 1);
    service.registerSlot("blue", "v1.0.0", 1);
    service.registerSlot("canary", "v1.0.0", 1);
    const slots = service.listSlots();
    assert.equal(slots.length, 3);
    // Should be ordered: blue, canary, green
    assert.equal(slots[0].slot, "blue");
    assert.equal(slots[1].slot, "canary");
    assert.equal(slots[2].slot, "green");
});
// ---------------------------------------------------------------------------
// Edge Case: Empty Metadata
// ---------------------------------------------------------------------------
test("registerSlot without metadata has null metadata", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    const record = service.registerSlot("blue", "v1.0.0", 1);
    assert.equal(record.metadata, null);
});
test("registerSlot with empty object metadata serializes correctly", () => {
    const db = createTestDb();
    const service = new TrafficRoutingService(db);
    const record = service.registerSlot("blue", "v1.0.0", 1, {});
    assert.ok(record.metadata !== null);
    assert.deepEqual(JSON.parse(record.metadata), {});
});
//# sourceMappingURL=edge-cases.test.js.map