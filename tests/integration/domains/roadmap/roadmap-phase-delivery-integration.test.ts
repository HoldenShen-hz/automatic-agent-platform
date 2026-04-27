/**
 * Integration Test: Roadmap Phase Delivery Pipeline
 *
 * Tests integration between RoadmapService and SuccessCriteriaService
 * for roadmap item lifecycle, and PhaseDeliveryService for phase deliverables.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RoadmapService } from "../../../src/domains/roadmap/roadmap-service.js";
import { PhaseDeliveryService } from "../../../src/domains/roadmap/phase-delivery-service.js";
import type { PhaseAdvanceDecision } from "../../../src/domains/roadmap/types.js";

function createRoadmapService(): RoadmapService {
  return new RoadmapService();
}

function createPhaseDeliveryService(): PhaseDeliveryService {
  return new PhaseDeliveryService();
}

test("integration: RoadmapService item lifecycle end-to-end", () => {
  const roadmapService = createRoadmapService();

  const item = roadmapService.addRoadmapItem({
    title: "Core execution foundation",
    description: "Build core platform kernel",
    phase: "phase1",
  });

  assert.ok(item.itemId.startsWith("roadmap_"));
  assert.equal(item.status, "pending");

  const inProgress = roadmapService.updateRoadmapItemStatus(item.itemId, "in_progress");
  assert.equal(inProgress.status, "in_progress");

  const completed = roadmapService.completeRoadmapItem(item.itemId, {
    completedAt: "2026-04-21T10:00:00Z",
    notes: "Delivered successfully",
  });
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt);
  assert.equal(completed.completionRecord?.notes, "Delivered successfully");
});

test("integration: RoadmapService phase advance evaluation with gate", () => {
  const roadmapService = createRoadmapService();

  roadmapService.registerPhaseGate({
    phase: "phase2",
    requiredItemIds: [],
    requiredCriteriaIds: [],
    blockOnDeferredItems: false,
  });

  const item = roadmapService.addRoadmapItem({
    title: "Model gateway integration",
    description: "Integrate model gateway",
    phase: "phase2",
  });

  // Initially allowed since no required items registered
  let decision = roadmapService.evaluatePhaseAdvance("phase2");
  assert.equal(decision.allowed, true);

  // After deferring, still allowed since gate doesn't block on deferred and no required items
  roadmapService.deferRoadmapItem(item.itemId, "Waiting for dependency");
  decision = roadmapService.evaluatePhaseAdvance("phase2");
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some((r) => r.includes("deferred")));
});

test("integration: PhaseDeliveryService creates phases and deliverables", () => {
  const phaseService = createPhaseDeliveryService();

  const phase = phaseService.createPhase("phase1");
  assert.equal(phase.phase, "phase1");
  assert.equal(phase.name, "Foundation");
  assert.equal(phase.status, "pending");

  const deliverable = phaseService.addDeliverableToPhase(phase.phaseId, {
    title: "Core Engine",
    description: "Implement core execution engine",
  });

  assert.ok(deliverable.deliverableId.startsWith("deliverable_"));
  assert.equal(deliverable.title, "Core Engine");
  assert.equal(deliverable.completedAt, undefined);

  const completed = phaseService.markDeliverableComplete(phase.phaseId, deliverable.deliverableId);
  assert.ok(completed.completedAt);
});

test("integration: PhaseDeliveryService computes deliverable progress", () => {
  const phaseService = createPhaseDeliveryService();

  const phase = phaseService.createPhase("phase1");
  const d1 = phaseService.addDeliverableToPhase(phase.phaseId, { title: "D1", description: "D1" });
  const d2 = phaseService.addDeliverableToPhase(phase.phaseId, { title: "D2", description: "D2" });
  const d3 = phaseService.addDeliverableToPhase(phase.phaseId, { title: "D3", description: "D3" });

  phaseService.markDeliverableComplete(phase.phaseId, d1.deliverableId);
  phaseService.markDeliverableComplete(phase.phaseId, d2.deliverableId);

  const progress = phaseService.getPhaseProgress(phase.phaseId);

  assert.equal(progress.totalDeliverables, 3);
  assert.equal(progress.completedDeliverables, 2);
  assert.equal(progress.completionPercentage, 67); // 2/3 rounded
});

test("integration: Success criteria measurement affects phase advance", () => {
  const roadmapService = createRoadmapService();

  roadmapService.registerSuccessCriterion({
    criterionId: "crit-latency",
    phase: "phase1",
    metricKey: "latency_p50",
    title: "P50 Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });

  // Record passing measurement
  roadmapService.recordSuccessMeasurement({
    criterionId: "crit-latency",
    metricKey: "latency_p50",
    measuredValue: 85,
    source: "integration-test",
  });

  const passingDecision = roadmapService.evaluatePhaseAdvance("phase1");
  assert.equal(passingDecision.allowed, true);

  // Record failing measurement
  roadmapService.recordSuccessMeasurement({
    criterionId: "crit-latency",
    metricKey: "latency_p50",
    measuredValue: 150,
    source: "integration-test",
  });

  const failingDecision = roadmapService.evaluatePhaseAdvance("phase1");
  assert.equal(failingDecision.allowed, false);
  assert.ok(failingDecision.failedCriteriaIds.includes("crit-latency"));
});

test("integration: Seed architecture roadmap creates all phases", () => {
  const roadmapService = createRoadmapService();

  const seeded = roadmapService.seedArchitectureRoadmap();

  assert.ok(seeded.length > 0);
  // All phases should have at least one item
  for (const phase of roadmapService.listArchitecturePhases()) {
    const items = roadmapService.getRoadmap(phase);
    assert.ok(items.length > 0, `Expected items in phase ${phase}`);
  }
});

test("integration: PhaseDeliveryService lists all phases in order", () => {
  const phaseService = createPhaseDeliveryService();

  phaseService.createPhase("phase1");
  phaseService.createPhase("phase2");
  phaseService.createPhase("phase3");

  const phases = phaseService.listPhases();

  assert.equal(phases.length, 3);
  assert.equal(phases[0]?.phase, "phase1");
  assert.equal(phases[1]?.phase, "phase2");
  assert.equal(phases[2]?.phase, "phase3");
});

test("integration: PhaseDeliveryService throws for duplicate phase", () => {
  const phaseService = createPhaseDeliveryService();

  phaseService.createPhase("phase8a");

  assert.throws(
    () => phaseService.createPhase("phase8a"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "phase_delivery.phase_exists";
      }
      return false;
    },
  );
});

test("integration: RoadmapService items can be filtered by status", () => {
  const roadmapService = createRoadmapService();

  roadmapService.addRoadmapItem({ title: "Pending", description: "D", phase: "phase1" });
  const inProgress = roadmapService.addRoadmapItem({ title: "InProgress", description: "D", phase: "phase1" });
  roadmapService.addRoadmapItem({ title: "Completed", description: "D", phase: "phase1" });

  roadmapService.updateRoadmapItemStatus(inProgress.itemId, "in_progress");

  const pending = roadmapService.listRoadmapItemsByStatus("pending");
  const inProgressItems = roadmapService.listRoadmapItemsByStatus("in_progress");

  assert.equal(pending.length, 2);
  assert.equal(inProgressItems.length, 1);
  assert.equal(inProgressItems[0]?.title, "InProgress");
});

test("integration: PhaseDeliveryService and RoadmapService track independent concerns", () => {
  const roadmapService = createRoadmapService();
  const phaseService = createPhaseDeliveryService();

  // RoadmapService tracks items
  const roadmapItem = roadmapService.addRoadmapItem({
    title: "Roadmap Item",
    description: "Item tracked by roadmap",
    phase: "phase1",
  });
  roadmapService.completeRoadmapItem(roadmapItem.itemId, { completedAt: "2026-04-21T10:00:00Z" });

  // PhaseDeliveryService tracks deliverables (independent concern)
  const phase = phaseService.createPhase("phase1");
  const deliverable = phaseService.addDeliverableToPhase(phase.phaseId, {
    title: "Deliverable",
    description: "Deliverable tracked by phase service",
  });

  const roadmapItems = roadmapService.getRoadmap("phase1");
  const phaseProgress = phaseService.getPhaseProgress(phase.phaseId);

  assert.equal(roadmapItems.length, 1);
  assert.equal(phaseProgress.totalDeliverables, 1);
  assert.equal(roadmapItems[0]?.itemId, roadmapItem.itemId);
  assert.equal(deliverable.deliverableId, deliverable.deliverableId);
});