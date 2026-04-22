import assert from "node:assert/strict";
import test from "node:test";

import { SuccessCriteriaService } from "../../../../src/domains/roadmap/success-criteria-service.js";
import type { RoadmapPhase, SuccessCriterionDefinition } from "../../../../src/domains/roadmap/types.js";

test("SuccessCriteriaService registers and retrieves criterion definitions", () => {
  const service = new SuccessCriteriaService();
  const definition: SuccessCriterionDefinition = {
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "execution_latency_p50",
    title: "P50 Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  };

  service.registerCriterion(definition);
  const definitions = service.listDefinitions();

  assert.equal(definitions.length, 1);
  assert.equal(definitions[0]?.criterionId, "crit_1");
});

test("SuccessCriteriaService filters definitions by phase", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "metric_1",
    title: "Phase 1 Criterion",
    measurementType: "percentage",
    threshold: 80,
    required: true,
  });
  service.registerCriterion({
    criterionId: "crit_2",
    phase: "phase2",
    metricKey: "metric_2",
    title: "Phase 2 Criterion",
    measurementType: "percentage",
    threshold: 80,
    required: true,
  });

  const phase1Defs = service.listDefinitions("phase1");
  const phase2Defs = service.listDefinitions("phase2");

  assert.equal(phase1Defs.length, 1);
  assert.equal(phase2Defs.length, 1);
  assert.equal(phase1Defs[0]?.criterionId, "crit_1");
  assert.equal(phase2Defs[0]?.criterionId, "crit_2");
});

test("SuccessCriteriaService records measurements", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "execution_latency_p50",
    title: "P50 Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });

  const measurement = service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "execution_latency_p50",
    measuredValue: 85,
    source: "test",
  });

  assert.equal(measurement.criterionId, "crit_1");
  assert.equal(measurement.measuredValue, 85);
  assert.ok(measurement.measuredAt);
});

test("SuccessCriteriaService evaluates criterion as passed when threshold met", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "latency",
    measuredValue: 85,
    source: "test",
  });

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.measuredValue, 85);
  assert.equal(evaluation.threshold, 100);
  assert.equal(evaluation.operator, "lte");
});

test("SuccessCriteriaService evaluates criterion as failed when threshold not met", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "latency",
    measuredValue: 150,
    source: "test",
  });

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.measuredValue, 150);
});

test("SuccessCriteriaService uses gte operator by default", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "coverage",
    title: "Coverage",
    measurementType: "percentage",
    threshold: 80,
    required: true,
    // No operator specified - should default to gte
  });
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "coverage",
    measuredValue: 85,
    source: "test",
  });

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.operator, "gte");
  assert.equal(evaluation.passed, true);
});

test("SuccessCriteriaService evaluates eq operator correctly", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "status",
    title: "Status",
    measurementType: "custom",
    threshold: "healthy",
    operator: "eq",
    required: true,
  });
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "status",
    measuredValue: "healthy",
    source: "test",
  });

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.passed, true);
});

test("SuccessCriteriaService evaluates neq operator correctly", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "status",
    title: "Status",
    measurementType: "custom",
    threshold: "error",
    operator: "neq",
    required: true,
  });
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "status",
    measuredValue: "healthy",
    source: "test",
  });

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.passed, true);
});

test("SuccessCriteriaService returns failed for null measurement", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  // No measurements recorded

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.measuredValue, null);
});

test("SuccessCriteriaService throws for unknown criterion", () => {
  const service = new SuccessCriteriaService();

  assert.throws(
    () => service.evaluateCriterion("unknown"),
    /success_criteria.definition_not_found/,
  );
});

test("SuccessCriteriaService evaluates phase criteria", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  service.registerCriterion({
    criterionId: "crit_2",
    phase: "phase1",
    metricKey: "coverage",
    title: "Coverage",
    measurementType: "percentage",
    threshold: 80,
    operator: "gte",
    required: true,
  });
  service.registerCriterion({
    criterionId: "crit_3",
    phase: "phase2",
    metricKey: "throughput",
    title: "Throughput",
    measurementType: "count",
    threshold: 1000,
    operator: "gte",
    required: false,
  });

  const phase1Evaluations = service.evaluatePhaseCriteria("phase1");

  assert.equal(phase1Evaluations.length, 2);
  assert.ok(phase1Evaluations.some((e) => e.criterionId === "crit_1"));
  assert.ok(phase1Evaluations.some((e) => e.criterionId === "crit_2"));
  assert.ok(!phase1Evaluations.some((e) => e.criterionId === "crit_3"));
});

test("SuccessCriteriaService registers and retrieves phase gates", () => {
  const service = new SuccessCriteriaService();
  const gate = {
    phase: "phase1" as RoadmapPhase,
    requiredItemIds: ["item_1", "item_2"],
    requiredCriteriaIds: ["crit_1"],
    blockOnDeferredItems: true,
  };

  service.registerPhaseGate(gate);

  const decision = service.evaluatePhaseAdvance("phase1", ["item_1", "item_2"], []);

  assert.equal(decision.phase, "phase1");
  assert.equal(decision.allowed, true);
});

test("SuccessCriteriaService blocks phase advance with pending items", () => {
  const service = new SuccessCriteriaService();
  const gate = {
    phase: "phase1" as RoadmapPhase,
    requiredItemIds: ["item_1", "item_2"],
    requiredCriteriaIds: [],
    blockOnDeferredItems: false,
  };

  service.registerPhaseGate(gate);

  const decision = service.evaluatePhaseAdvance("phase1", ["item_1"], []);

  assert.equal(decision.allowed, false);
  assert.ok(decision.pendingItemIds.includes("item_2"));
  assert.ok(decision.reasonCodes.some((r) => r.includes("item_2")));
});

test("SuccessCriteriaService blocks phase advance with failed required criteria", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  // Record failing measurement
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "latency",
    measuredValue: 200, // Exceeds threshold
    source: "test",
  });

  const gate = {
    phase: "phase1" as RoadmapPhase,
    requiredItemIds: [],
    requiredCriteriaIds: ["crit_1"],
    blockOnDeferredItems: false,
  };
  service.registerPhaseGate(gate);

  const decision = service.evaluatePhaseAdvance("phase1", [], []);

  assert.equal(decision.allowed, false);
  assert.ok(decision.failedCriteriaIds.includes("crit_1"));
});

test("SuccessCriteriaService blocks phase advance with deferred items when configured", () => {
  const service = new SuccessCriteriaService();
  const gate = {
    phase: "phase1" as RoadmapPhase,
    requiredItemIds: ["item_1"],
    requiredCriteriaIds: [],
    blockOnDeferredItems: true,
  };

  service.registerPhaseGate(gate);

  const decision = service.evaluatePhaseAdvance("phase1", ["item_1"], ["deferred_item_1"]);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some((r) => r.includes("deferred_item")));
});

test("SuccessCriteriaService advances to next phase when all criteria met", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "latency",
    measuredValue: 50,
    source: "test",
  });

  const gate = {
    phase: "phase1" as RoadmapPhase,
    requiredItemIds: ["item_1"],
    requiredCriteriaIds: ["crit_1"],
    blockOnDeferredItems: false,
  };
  service.registerPhaseGate(gate);

  const decision = service.evaluatePhaseAdvance("phase1", ["item_1"], []);

  assert.equal(decision.allowed, true);
  assert.equal(decision.nextPhase, "phase2");
});

test("SuccessCriteriaService returns null nextPhase at final phase", () => {
  const service = new SuccessCriteriaService();
  const gate = {
    phase: "phase4" as RoadmapPhase,
    requiredItemIds: [],
    requiredCriteriaIds: [],
    blockOnDeferredItems: false,
  };

  service.registerPhaseGate(gate);

  const decision = service.evaluatePhaseAdvance("phase4", [], []);

  assert.equal(decision.allowed, true);
  assert.equal(decision.nextPhase, null);
});

test("SuccessCriteriaService uses latest measurement for evaluation", () => {
  const service = new SuccessCriteriaService();
  service.registerCriterion({
    criterionId: "crit_1",
    phase: "phase1",
    metricKey: "latency",
    title: "Latency",
    measurementType: "duration_ms",
    threshold: 100,
    operator: "lte",
    required: true,
  });
  // Record older measurement with explicit older timestamp
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "latency",
    measuredValue: 150,
    source: "test_old",
    measuredAt: "2026-04-21T10:00:00Z",
  });
  // Record newer measurement with explicit newer timestamp
  service.recordMeasurement({
    criterionId: "crit_1",
    metricKey: "latency",
    measuredValue: 80,
    source: "test_new",
    measuredAt: "2026-04-22T10:00:00Z",
  });

  const evaluation = service.evaluateCriterion("crit_1");

  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.measuredValue, 80);
});
