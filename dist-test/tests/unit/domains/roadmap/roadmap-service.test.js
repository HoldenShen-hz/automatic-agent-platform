import assert from "node:assert/strict";
import test from "node:test";
import { ARCHITECTURE_ROADMAP_TEMPLATE, RoadmapService } from "../../../../src/domains/roadmap/roadmap-service.js";
test("RoadmapService addRoadmapItem creates item with pending status", () => {
    const service = new RoadmapService();
    const item = service.addRoadmapItem({
        title: "Core execution engine",
        description: "Implement core task execution engine",
        phase: "phase1",
    });
    assert.ok(item.itemId.startsWith("roadmap_"));
    assert.equal(item.title, "Core execution engine");
    assert.equal(item.phase, "phase1");
    assert.equal(item.status, "pending");
    assert.ok(item.createdAt);
    assert.ok(item.updatedAt);
});
test("RoadmapService getRoadmap returns all items when no phase filter", () => {
    const service = new RoadmapService();
    service.addRoadmapItem({ title: "Item 1", description: "Desc 1", phase: "phase1" });
    service.addRoadmapItem({ title: "Item 2", description: "Desc 2", phase: "phase2" });
    service.addRoadmapItem({ title: "Item 3", description: "Desc 3", phase: "phase1" });
    const items = service.getRoadmap();
    assert.equal(items.length, 3);
});
test("RoadmapService getRoadmap filters by phase", () => {
    const service = new RoadmapService();
    service.addRoadmapItem({ title: "Foundation Item", description: "Desc", phase: "phase1" });
    service.addRoadmapItem({ title: "Growth Item", description: "Desc", phase: "phase2" });
    service.addRoadmapItem({ title: "Another Foundation", description: "Desc", phase: "phase1" });
    const phase1Items = service.getRoadmap("phase1");
    assert.equal(phase1Items.length, 2);
    assert.ok(phase1Items.every((item) => item.phase === "phase1"));
    const phase2Items = service.getRoadmap("phase2");
    assert.equal(phase2Items.length, 1);
    assert.equal(phase2Items[0].title, "Growth Item");
});
test("RoadmapService updateRoadmapItemStatus updates status", () => {
    const service = new RoadmapService();
    const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase1" });
    const updated = service.updateRoadmapItemStatus(item.itemId, "in_progress");
    assert.equal(updated.status, "in_progress");
    assert.ok(updated.updatedAt >= item.createdAt);
    // Verify persisted
    const retrieved = service.getRoadmap()[0];
    assert.equal(retrieved.status, "in_progress");
});
test("RoadmapService completeRoadmapItem marks as completed", () => {
    const service = new RoadmapService();
    const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase1" });
    const completed = service.completeRoadmapItem(item.itemId, {
        completedAt: "2026-04-21T10:00:00Z",
        notes: "Delivered successfully",
        artifacts: ["artifact1", "artifact2"],
    });
    assert.equal(completed.status, "completed");
    assert.equal(completed.completedAt, "2026-04-21T10:00:00Z");
    assert.equal(completed.completionRecord?.notes, "Delivered successfully");
    assert.deepEqual(completed.completionRecord?.artifacts, ["artifact1", "artifact2"]);
});
test("RoadmapService deferRoadmapItem marks as deferred with reason", () => {
    const service = new RoadmapService();
    const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase2" });
    const deferred = service.deferRoadmapItem(item.itemId, "Waiting for dependency");
    assert.equal(deferred.status, "deferred");
    assert.equal(deferred.deferredReason, "Waiting for dependency");
});
test("RoadmapService listRoadmapItemsByStatus filters correctly", () => {
    const service = new RoadmapService();
    const item1 = service.addRoadmapItem({ title: "Pending 1", description: "D", phase: "phase1" });
    const item2 = service.addRoadmapItem({ title: "Pending 2", description: "D", phase: "phase1" });
    const item3 = service.addRoadmapItem({ title: "In Progress", description: "D", phase: "phase2" });
    service.updateRoadmapItemStatus(item3.itemId, "in_progress");
    const pendingItems = service.listRoadmapItemsByStatus("pending");
    assert.equal(pendingItems.length, 2);
    assert.ok(pendingItems.every((item) => item.status === "pending"));
    const inProgressItems = service.listRoadmapItemsByStatus("in_progress");
    assert.equal(inProgressItems.length, 1);
    assert.equal(inProgressItems[0].itemId, item3.itemId);
    const completedItems = service.listRoadmapItemsByStatus("completed");
    assert.equal(completedItems.length, 0);
});
test("RoadmapService getRoadmap returns items sorted by createdAt", () => {
    const service = new RoadmapService();
    const item1 = service.addRoadmapItem({ title: "First", description: "D", phase: "phase1" });
    const item2 = service.addRoadmapItem({ title: "Second", description: "D", phase: "phase1" });
    const item3 = service.addRoadmapItem({ title: "Third", description: "D", phase: "phase1" });
    const items = service.getRoadmap();
    assert.equal(items[0].itemId, item1.itemId);
    assert.equal(items[1].itemId, item2.itemId);
    assert.equal(items[2].itemId, item3.itemId);
});
test("RoadmapService throws ValidationError for non-existent item", () => {
    const service = new RoadmapService();
    assert.throws(() => service.updateRoadmapItemStatus("non_existent", "in_progress"), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "roadmap.item_not_found";
        }
        return false;
    });
    assert.throws(() => service.completeRoadmapItem("non_existent", { completedAt: nowUtc() }), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "roadmap.item_not_found";
        }
        return false;
    });
    assert.throws(() => service.deferRoadmapItem("non_existent", "reason"), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "roadmap.item_not_found";
        }
        return false;
    });
});
test("RoadmapService seeds architecture roadmap phases 8 and 9 from the canonical template", () => {
    const service = new RoadmapService();
    const seeded = service.seedArchitectureRoadmap();
    assert.equal(seeded.length, ARCHITECTURE_ROADMAP_TEMPLATE.length);
    assert.equal(service.getRoadmap("phase8a").some((item) => item.title === "Harness core loop"), true);
    assert.equal(service.getRoadmap("phase9f").some((item) => item.title === "Vertical domains 9f"), true);
    assert.deepEqual(service.listArchitecturePhases(), [
        "phase8a",
        "phase8b",
        "phase8c",
        "phase9a",
        "phase9b",
        "phase9c",
        "phase9d",
        "phase9e",
        "phase9f",
    ]);
});
test("RoadmapService seedArchitectureRoadmap skips duplicates", () => {
    const service = new RoadmapService();
    const first = service.seedArchitectureRoadmap();
    const second = service.seedArchitectureRoadmap();
    assert.equal(first.length, ARCHITECTURE_ROADMAP_TEMPLATE.length);
    assert.equal(second.length, 0);
});
test("RoadmapService registerSuccessCriterion registers and retrieves criterion", () => {
    const service = new RoadmapService();
    const criterion = {
        criterionId: "crit_latency",
        phase: "phase1",
        metricKey: "latency_p50",
        title: "P50 Latency",
        measurementType: "duration_ms",
        threshold: 100,
        operator: "lte",
        required: true,
    };
    const registered = service.registerSuccessCriterion(criterion);
    assert.equal(registered.criterionId, "crit_latency");
});
test("RoadmapService registerPhaseGate registers phase gate", () => {
    const service = new RoadmapService();
    const gate = {
        phase: "phase2",
        requiredItemIds: ["item_1"],
        requiredCriteriaIds: ["crit_1"],
        blockOnDeferredItems: false,
    };
    const registered = service.registerPhaseGate(gate);
    assert.equal(registered.phase, "phase2");
    assert.deepEqual(registered.requiredItemIds, ["item_1"]);
});
test("RoadmapService recordSuccessMeasurement records measurement", () => {
    const service = new RoadmapService();
    service.registerSuccessCriterion({
        criterionId: "crit_coverage",
        phase: "phase1",
        metricKey: "coverage",
        title: "Coverage",
        measurementType: "percentage",
        threshold: 80,
        operator: "gte",
        required: true,
    });
    const measurement = service.recordSuccessMeasurement({
        criterionId: "crit_coverage",
        metricKey: "coverage",
        measuredValue: 85,
        source: "test",
    });
    assert.equal(measurement.criterionId, "crit_coverage");
    assert.equal(measurement.measuredValue, 85);
    assert.ok(measurement.measuredAt);
});
test("RoadmapService recordSuccessMeasurement accepts optional measuredAt", () => {
    const service = new RoadmapService();
    service.registerSuccessCriterion({
        criterionId: "crit_count",
        phase: "phase1",
        metricKey: "count",
        title: "Count",
        measurementType: "count",
        threshold: 10,
        operator: "gte",
        required: true,
    });
    const measurement = service.recordSuccessMeasurement({
        criterionId: "crit_count",
        metricKey: "count",
        measuredValue: 5,
        source: "test",
        measuredAt: "2026-04-21T10:00:00Z",
    });
    assert.equal(measurement.measuredAt, "2026-04-21T10:00:00Z");
});
test("RoadmapService evaluatePhaseAdvance returns decision for phase", () => {
    const service = new RoadmapService();
    const item = service.addRoadmapItem({ title: "Item 1", description: "Desc", phase: "phase1" });
    service.completeRoadmapItem(item.itemId, { completedAt: "2026-04-21T10:00:00Z" });
    service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: [item.itemId],
        requiredCriteriaIds: [],
        blockOnDeferredItems: false,
    });
    const decision = service.evaluatePhaseAdvance("phase1");
    assert.equal(decision.phase, "phase1");
    assert.equal(decision.allowed, true);
    assert.equal(decision.nextPhase, "phase2");
});
test("RoadmapService evaluatePhaseAdvance blocks when items not completed", () => {
    const service = new RoadmapService();
    // Create items but don't register a gate - the issue is the default gate has no required items
    // so actually advance is allowed when no gate is registered
    // We need to set up a gate with required items
    const item = service.addRoadmapItem({ title: "Item 1", description: "Desc", phase: "phase1" });
    service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: [item.itemId], // Require this item to be completed
        requiredCriteriaIds: [],
        blockOnDeferredItems: false,
    });
    // Don't complete the item - advance should be blocked
    const decision = service.evaluatePhaseAdvance("phase1");
    assert.equal(decision.allowed, false);
    assert.ok(decision.pendingItemIds.includes(item.itemId));
});
test("RoadmapService evaluatePhaseAdvance considers deferred items when gate blocks on deferred", () => {
    const service = new RoadmapService();
    const item = service.addRoadmapItem({ title: "Item 1", description: "Desc", phase: "phase1" });
    service.deferRoadmapItem(item.itemId, "Waiting");
    service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: [],
        requiredCriteriaIds: [],
        blockOnDeferredItems: true,
    });
    const decision = service.evaluatePhaseAdvance("phase1");
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasonCodes.some((r) => r.includes("deferred_item")));
});
test("RoadmapService seedArchitectureRoadmap does not duplicate items", () => {
    const service = new RoadmapService();
    // Add an item with same title as a template item before seeding
    service.addRoadmapItem({
        title: "Harness core loop",
        description: "Custom description",
        phase: "phase8a",
    });
    const seeded = service.seedArchitectureRoadmap();
    // Should skip because item with same title exists
    assert.equal(seeded.length, ARCHITECTURE_ROADMAP_TEMPLATE.length - 1);
});
function nowUtc() {
    return new Date().toISOString();
}
//# sourceMappingURL=roadmap-service.test.js.map