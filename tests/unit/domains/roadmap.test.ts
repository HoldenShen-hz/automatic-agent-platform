import assert from "node:assert/strict";
import test from "node:test";

import { RoadmapService } from "../../../src/domains/roadmap/roadmap-service.js";
import type {
  CompletionRecord,
  PhaseGateDefinition,
  RoadmapPhase,
  SuccessCriterionDefinition,
  SuccessCriterionMeasurement,
} from "../../../src/domains/roadmap/types.js";

test("RoadmapService registerSuccessCriterion delegates to SuccessCriteriaService", () => {
  const service = new RoadmapService();
  const definition: SuccessCriterionDefinition = {
    criterionId: "crit_integration_1",
    phase: "phase8a",
    metricKey: "test_metric",
    title: "Integration Test Criterion",
    measurementType: "percentage",
    threshold: 90,
    operator: "gte",
    required: true,
  };

  const result = service.registerSuccessCriterion(definition);

  assert.equal(result.criterionId, "crit_integration_1");
  assert.equal(result.phase, "phase8a");
});

test("RoadmapService registerPhaseGate delegates to SuccessCriteriaService", () => {
  const service = new RoadmapService();
  const gate: PhaseGateDefinition = {
    phase: "phase8a",
    requiredItemIds: ["roadmap_item_1"],
    requiredCriteriaIds: ["crit_1"],
    blockOnDeferredItems: true,
  };

  const result = service.registerPhaseGate(gate);

  assert.equal(result.phase, "phase8a");
  assert.equal(result.blockOnDeferredItems, true);
});

test("RoadmapService recordSuccessMeasurement creates measurement with timestamp", () => {
  const service = new RoadmapService();
  service.registerSuccessCriterion({
    criterionId: "crit_meas_1",
    phase: "phase8a",
    metricKey: "coverage",
    title: "Coverage",
    measurementType: "percentage",
    threshold: 80,
    required: true,
  });

  const measurement = service.recordSuccessMeasurement({
    criterionId: "crit_meas_1",
    metricKey: "coverage",
    measuredValue: 85,
    source: "test",
  });

  assert.equal(measurement.criterionId, "crit_meas_1");
  assert.equal(measurement.measuredValue, 85);
  assert.ok(measurement.measuredAt);
});

test("RoadmapService recordSuccessMeasurement uses provided measuredAt", () => {
  const service = new RoadmapService();
  service.registerSuccessCriterion({
    criterionId: "crit_meas_2",
    phase: "phase8a",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    required: true,
  });

  const measurement = service.recordSuccessMeasurement({
    criterionId: "crit_meas_2",
    metricKey: "latency",
    measuredValue: 50,
    source: "test",
    measuredAt: "2026-04-23T12:00:00Z",
  });

  assert.equal(measurement.measuredAt, "2026-04-23T12:00:00Z");
});

test("RoadmapService evaluatePhaseAdvance allows advance when criteria met", () => {
  const service = new RoadmapService();

  service.registerSuccessCriterion({
    criterionId: "crit_phase_adv_1",
    phase: "phase8a",
    metricKey: "coverage",
    title: "Coverage",
    measurementType: "percentage",
    threshold: 80,
    operator: "gte",
    required: true,
  });

  service.registerPhaseGate({
    phase: "phase8a",
    requiredItemIds: [],
    requiredCriteriaIds: ["crit_phase_adv_1"],
    blockOnDeferredItems: false,
  });

  service.recordSuccessMeasurement({
    criterionId: "crit_phase_adv_1",
    metricKey: "coverage",
    measuredValue: 85,
    source: "test",
  });

  const item = service.addRoadmapItem({
    title: "Test Item",
    description: "Test Description",
    phase: "phase8a",
  });
  service.updateRoadmapItemStatus(item.itemId, "completed");

  const decision = service.evaluatePhaseAdvance("phase8a");

  assert.equal(decision.allowed, true);
  assert.equal(decision.nextPhase, "phase8b");
});

test("RoadmapService evaluatePhaseAdvance blocks when criteria not met", () => {
  const service = new RoadmapService();

  service.registerSuccessCriterion({
    criterionId: "crit_block_1",
    phase: "phase8a",
    metricKey: "coverage",
    title: "Coverage",
    measurementType: "percentage",
    threshold: 80,
    operator: "gte",
    required: true,
  });

  service.registerPhaseGate({
    phase: "phase8a",
    requiredItemIds: [],
    requiredCriteriaIds: ["crit_block_1"],
    blockOnDeferredItems: false,
  });

  // Record failing measurement
  service.recordSuccessMeasurement({
    criterionId: "crit_block_1",
    metricKey: "coverage",
    measuredValue: 50, // Below threshold
    source: "test",
  });

  const decision = service.evaluatePhaseAdvance("phase8a");

  assert.equal(decision.allowed, false);
  assert.ok(decision.failedCriteriaIds.includes("crit_block_1"));
});

test("RoadmapService evaluatePhaseAdvance reports pending items", () => {
  const service = new RoadmapService();
  const item1 = service.addRoadmapItem({
    title: "Item 1",
    description: "Desc",
    phase: "phase8a",
  });
  const item2 = service.addRoadmapItem({
    title: "Item 2",
    description: "Desc",
    phase: "phase8a",
  });

  service.updateRoadmapItemStatus(item1.itemId, "completed");
  // item2 remains pending

  service.registerPhaseGate({
    phase: "phase8a",
    requiredItemIds: [item1.itemId, item2.itemId],
    requiredCriteriaIds: [],
    blockOnDeferredItems: false,
  });

  const decision = service.evaluatePhaseAdvance("phase8a");

  assert.equal(decision.allowed, false);
  assert.ok(decision.pendingItemIds.includes(item2.itemId));
});

test("RoadmapService evaluatePhaseAdvance blocks deferred items when configured", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({
    title: "Deferred Item",
    description: "Desc",
    phase: "phase8a",
  });
  // Mark item as completed first
  service.updateRoadmapItemStatus(item.itemId, "completed");

  // Add a deferred item
  const deferredItem = service.addRoadmapItem({
    title: "Will be deferred",
    description: "Desc",
    phase: "phase8a",
  });
  service.deferRoadmapItem(deferredItem.itemId, "Blocked by dependency");

  service.registerPhaseGate({
    phase: "phase8a",
    requiredItemIds: [item.itemId],
    requiredCriteriaIds: [],
    blockOnDeferredItems: true,
  });

  // Item is completed but there is a deferred item
  const decision = service.evaluatePhaseAdvance("phase8a");

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some((r) => r.includes("deferred")));
});

test("RoadmapService evaluatePhaseAdvance returns null nextPhase for final phase", () => {
  const service = new RoadmapService();

  service.registerPhaseGate({
    phase: "phase9f",
    requiredItemIds: [],
    requiredCriteriaIds: [],
    blockOnDeferredItems: false,
  });

  const decision = service.evaluatePhaseAdvance("phase9f");

  assert.equal(decision.allowed, true);
  assert.equal(decision.nextPhase, null);
});

test("RoadmapService completeRoadmapItem with minimal completion record", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({
    title: "Test",
    description: "Test",
    phase: "phase1",
  });

  const minimalRecord: CompletionRecord = {
    completedAt: "2026-04-23T10:00:00Z",
  };

  const completed = service.completeRoadmapItem(item.itemId, minimalRecord);

  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, "2026-04-23T10:00:00Z");
  assert.equal(completed.completionRecord?.notes, undefined);
  assert.equal(completed.completionRecord?.artifacts, undefined);
});

test("RoadmapService completeRoadmapItem with full completion record", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({
    title: "Test",
    description: "Test",
    phase: "phase1",
  });

  const fullRecord: CompletionRecord = {
    completedAt: "2026-04-23T10:00:00Z",
    notes: "All done",
    artifacts: ["artifact1", "artifact2", "artifact3"],
  };

  const completed = service.completeRoadmapItem(item.itemId, fullRecord);

  assert.equal(completed.status, "completed");
  assert.equal(completed.completionRecord?.notes, "All done");
  assert.deepEqual(completed.completionRecord?.artifacts, ["artifact1", "artifact2", "artifact3"]);
});

test("RoadmapService updateRoadmapItemStatus throws for non-existent item", () => {
  const service = new RoadmapService();

  assert.throws(
    () => service.updateRoadmapItemStatus("non_existent_item", "in_progress"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "roadmap.item_not_found";
      }
      return false;
    },
  );
});

test("RoadmapService completeRoadmapItem throws for non-existent item", () => {
  const service = new RoadmapService();

  assert.throws(
    () => service.completeRoadmapItem("non_existent_item", { completedAt: "2026-04-23T10:00:00Z" }),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "roadmap.item_not_found";
      }
      return false;
    },
  );
});

test("RoadmapService deferRoadmapItem throws for non-existent item", () => {
  const service = new RoadmapService();

  assert.throws(
    () => service.deferRoadmapItem("non_existent_item", "some reason"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "roadmap.item_not_found";
      }
      return false;
    },
  );
});

test("RoadmapService getRoadmap sorts items by createdAt ascending", () => {
  const service = new RoadmapService();
  const item1 = service.addRoadmapItem({ title: "First", description: "D", phase: "phase1" });
  const item2 = service.addRoadmapItem({ title: "Second", description: "D", phase: "phase1" });
  const item3 = service.addRoadmapItem({ title: "Third", description: "D", phase: "phase1" });

  const items = service.getRoadmap();

  assert.equal(items[0]!.itemId, item1.itemId);
  assert.equal(items[1]!.itemId, item2.itemId);
  assert.equal(items[2]!.itemId, item3.itemId);
});

test("RoadmapService getRoadmap filtered returns sorted items", () => {
  const service = new RoadmapService();
  service.addRoadmapItem({ title: "Phase2 Item", description: "D", phase: "phase2" });
  const item2 = service.addRoadmapItem({ title: "Phase1 First", description: "D", phase: "phase1" });
  const item3 = service.addRoadmapItem({ title: "Phase1 Second", description: "D", phase: "phase1" });

  const phase1Items = service.getRoadmap("phase1");

  assert.equal(phase1Items.length, 2);
  assert.equal(phase1Items[0]!.itemId, item2.itemId);
  assert.equal(phase1Items[1]!.itemId, item3.itemId);
});

test("RoadmapService listRoadmapItemsByStatus returns empty for non-existent status", () => {
  const service = new RoadmapService();
  service.addRoadmapItem({ title: "Item", description: "D", phase: "phase1" });

  const completedItems = service.listRoadmapItemsByStatus("completed");

  assert.equal(completedItems.length, 0);
});

test("RoadmapService listRoadmapItemsByStatus returns deferred items", () => {
  const service = new RoadmapService();
  const item1 = service.addRoadmapItem({ title: "Deferred Item", description: "D", phase: "phase1" });
  service.deferRoadmapItem(item1.itemId, "Waiting on dependency");

  const deferredItems = service.listRoadmapItemsByStatus("deferred");

  assert.equal(deferredItems.length, 1);
  assert.equal(deferredItems[0]!.itemId, item1.itemId);
  assert.equal(deferredItems[0]!.deferredReason, "Waiting on dependency");
});

test("RoadmapService seedArchitectureRoadmap skips duplicates", () => {
  const service = new RoadmapService();
  // Add one of the items first
  service.addRoadmapItem({
    title: "Harness core loop",
    description: "Close VI-1/2/3 and ship the unified Harness protocol.",
    phase: "phase8a",
  });

  const seeded = service.seedArchitectureRoadmap();

  // Should seed 15 items (16 total - 7 completed - 1 duplicate = 8 seeded, but completed items also return seeded)
  // Actually the seed returns items that were seeded, including completed ones
  // phase8a was pre-added so it skips, leaving 15 to seed
  assert.equal(seeded.length, 15);
  // The pre-added item should still exist
  assert.equal(service.getRoadmap("phase8a").length, 1);
});

test("RoadmapService seedArchitectureRoadmap returns all items when none exist", () => {
  const service = new RoadmapService();
  const seeded = service.seedArchitectureRoadmap();

  // 7 completed + 9 non-completed = 16 items seeded
  assert.equal(seeded.length, 16);
});

test("RoadmapService listArchitecturePhases returns unique phases", () => {
  const service = new RoadmapService();
  const phases = service.listArchitecturePhases();

  // 7 completed phases + 9 non-completed phases = 16 phases
  assert.equal(phases.length, 16);
  assert.ok(phases.includes("phase8a"));
  assert.ok(phases.includes("phase8b"));
  assert.ok(phases.includes("phase8c"));
  assert.ok(phases.includes("phase9a"));
  assert.ok(phases.includes("phase9f"));
});

test("RoadmapService handles all roadmap phases", () => {
  const service = new RoadmapService();
  const phases: RoadmapPhase[] = [
    "phase1",
    "phase2",
    "phase3",
    "phase4",
    "phase5",
    "phase6",
    "phase7",
    "phase8a",
    "phase8b",
    "phase8c",
    "phase9a",
    "phase9b",
    "phase9c",
    "phase9d",
    "phase9e",
    "phase9f",
  ];

  for (const phase of phases) {
    const item = service.addRoadmapItem({
      title: `Item for ${phase}`,
      description: `Description for ${phase}`,
      phase,
    });
    assert.equal(item.phase, phase);
  }

  assert.equal(service.getRoadmap().length, 16);
});

test("RoadmapService updateRoadmapItemStatus can set back to pending", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase1" });

  service.updateRoadmapItemStatus(item.itemId, "in_progress");
  const updated = service.updateRoadmapItemStatus(item.itemId, "pending");

  assert.equal(updated.status, "pending");
});

test("RoadmapService recordSuccessMeasurement accepts boolean measuredValue", () => {
  const service = new RoadmapService();
  service.registerSuccessCriterion({
    criterionId: "crit_bool",
    phase: "phase8a",
    metricKey: "is_healthy",
    title: "Health Check",
    measurementType: "boolean",
    threshold: true,
    operator: "eq",
    required: true,
  });

  const measurement = service.recordSuccessMeasurement({
    criterionId: "crit_bool",
    metricKey: "is_healthy",
    measuredValue: true,
    source: "test",
  });

  assert.equal(measurement.measuredValue, true);
});

test("RoadmapService recordSuccessMeasurement accepts string measuredValue", () => {
  const service = new RoadmapService();
  service.registerSuccessCriterion({
    criterionId: "crit_string",
    phase: "phase8a",
    metricKey: "status",
    title: "Status",
    measurementType: "custom",
    threshold: "active",
    operator: "eq",
    required: true,
  });

  const measurement = service.recordSuccessMeasurement({
    criterionId: "crit_string",
    metricKey: "status",
    measuredValue: "active",
    source: "test",
  });

  assert.equal(measurement.measuredValue, "active");
});
