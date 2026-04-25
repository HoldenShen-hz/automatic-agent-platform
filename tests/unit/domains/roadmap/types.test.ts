import assert from "node:assert/strict";
import test from "node:test";

import type {
  RoadmapPhase,
  RoadmapStatus,
  SuccessCriterionMeasurementType,
  SuccessCriterionDefinition,
  SuccessCriterionMeasurement,
  SuccessCriterionEvaluation,
  PhaseGateDefinition,
  PhaseAdvanceDecision,
  RoadmapItem,
  CompletionRecord,
  Phase,
  Deliverable,
  PhaseProgress,
  AddRoadmapItemRequest,
  AddDeliverableRequest,
} from "../../../../src/domains/roadmap/types.js";

test("RoadmapPhase includes all phase values", () => {
  const phases: RoadmapPhase[] = [
    "phase1", "phase2", "phase3", "phase4", "phase5",
    "phase6", "phase7", "phase8a", "phase8b", "phase8c",
    "phase9a", "phase9b", "phase9c", "phase9d", "phase9e", "phase9f",
  ];

  for (const phase of phases) {
    const item: RoadmapItem = {
      itemId: `item_${phase}`,
      title: "Test Item",
      description: "Test description",
      phase,
      status: "pending",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    assert.equal(item.phase, phase);
  }
});

test("RoadmapStatus includes all status values", () => {
  const statuses: RoadmapStatus[] = ["pending", "in_progress", "completed", "deferred"];

  for (const status of statuses) {
    const item: RoadmapItem = {
      itemId: "item_test",
      title: "Test Item",
      description: "Test description",
      phase: "phase1",
      status,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    assert.equal(item.status, status);
  }
});

test("SuccessCriterionMeasurementType includes all measurement types", () => {
  const types: SuccessCriterionMeasurementType[] = [
    "boolean", "percentage", "count", "duration_ms", "custom",
  ];

  for (const type of types) {
    const criterion: SuccessCriterionDefinition = {
      criterionId: `criterion_${type}`,
      phase: "phase1",
      metricKey: "metric_test",
      title: "Test Criterion",
      measurementType: type,
      threshold: type === "boolean" ? true : type === "percentage" ? 0.95 : type === "count" ? 100 : type === "duration_ms" ? 5000 : "custom_value",
      required: true,
    };
    assert.equal(criterion.measurementType, type);
  }
});

test("SuccessCriterionDefinition has correct structure", () => {
  const criterion: SuccessCriterionDefinition = {
    criterionId: "criterion_1",
    phase: "phase1",
    metricKey: "test_metric",
    title: "Test Criterion",
    measurementType: "percentage",
    threshold: 0.95,
    operator: "gte",
    required: true,
  };

  assert.equal(criterion.criterionId, "criterion_1");
  assert.equal(criterion.phase, "phase1");
  assert.equal(criterion.metricKey, "test_metric");
  assert.equal(criterion.title, "Test Criterion");
  assert.equal(criterion.measurementType, "percentage");
  assert.equal(criterion.threshold, 0.95);
  assert.equal(criterion.operator, "gte");
  assert.equal(criterion.required, true);
});

test("SuccessCriterionDefinition operator is optional", () => {
  const criterion: SuccessCriterionDefinition = {
    criterionId: "criterion_no_op",
    phase: "phase2",
    metricKey: "test_metric",
    title: "No Operator",
    measurementType: "count",
    threshold: 10,
    required: false,
  };

  assert.equal(criterion.operator, undefined);
});

test("SuccessCriterionMeasurement has correct structure", () => {
  const measurement: SuccessCriterionMeasurement = {
    criterionId: "criterion_1",
    metricKey: "test_metric",
    measuredValue: 0.92,
    measuredAt: "2024-01-15T10:00:00Z",
    source: "metrics_system",
  };

  assert.equal(measurement.criterionId, "criterion_1");
  assert.equal(measurement.metricKey, "test_metric");
  assert.equal(measurement.measuredValue, 0.92);
  assert.equal(measurement.measuredAt, "2024-01-15T10:00:00Z");
  assert.equal(measurement.source, "metrics_system");
});

test("SuccessCriterionMeasurement accepts boolean measuredValue", () => {
  const measurement: SuccessCriterionMeasurement = {
    criterionId: "criterion_bool",
    metricKey: "is_complete",
    measuredValue: true,
    measuredAt: "2024-01-15T10:00:00Z",
    source: "manual",
  };

  assert.equal(measurement.measuredValue, true);
});

test("SuccessCriterionMeasurement accepts string measuredValue", () => {
  const measurement: SuccessCriterionMeasurement = {
    criterionId: "criterion_str",
    metricKey: "status",
    measuredValue: "green",
    measuredAt: "2024-01-15T10:00:00Z",
    source: "manual",
  };

  assert.equal(measurement.measuredValue, "green");
});

test("SuccessCriterionEvaluation has correct structure", () => {
  const evaluation: SuccessCriterionEvaluation = {
    criterionId: "criterion_1",
    passed: true,
    required: true,
    metricKey: "test_metric",
    threshold: 0.95,
    measuredValue: 0.97,
    operator: "gte",
  };

  assert.equal(evaluation.criterionId, "criterion_1");
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.required, true);
  assert.equal(evaluation.metricKey, "test_metric");
  assert.equal(evaluation.threshold, 0.95);
  assert.equal(evaluation.measuredValue, 0.97);
  assert.equal(evaluation.operator, "gte");
});

test("SuccessCriterionEvaluation measuredValue can be null", () => {
  const evaluation: SuccessCriterionEvaluation = {
    criterionId: "criterion_no_data",
    passed: false,
    required: true,
    metricKey: "test_metric",
    threshold: 0.95,
    measuredValue: null,
    operator: "gte",
  };

  assert.equal(evaluation.measuredValue, null);
  assert.equal(evaluation.passed, false);
});

test("PhaseGateDefinition has correct structure", () => {
  const gate: PhaseGateDefinition = {
    phase: "phase2",
    requiredItemIds: ["item_1", "item_2"],
    requiredCriteriaIds: ["criterion_1", "criterion_2"],
    blockOnDeferredItems: true,
  };

  assert.equal(gate.phase, "phase2");
  assert.deepEqual(gate.requiredItemIds, ["item_1", "item_2"]);
  assert.deepEqual(gate.requiredCriteriaIds, ["criterion_1", "criterion_2"]);
  assert.equal(gate.blockOnDeferredItems, true);
});

test("PhaseAdvanceDecision has correct structure", () => {
  const decision: PhaseAdvanceDecision = {
    phase: "phase1",
    nextPhase: "phase2",
    allowed: true,
    reasonCodes: ["all_criteria_met", "all_items_complete"],
    pendingItemIds: [],
    failedCriteriaIds: [],
  };

  assert.equal(decision.phase, "phase1");
  assert.equal(decision.nextPhase, "phase2");
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCodes.length, 2);
  assert.equal(decision.pendingItemIds.length, 0);
  assert.equal(decision.failedCriteriaIds.length, 0);
});

test("PhaseAdvanceDecision can have null nextPhase for final phase", () => {
  const decision: PhaseAdvanceDecision = {
    phase: "phase9f",
    nextPhase: null,
    allowed: true,
    reasonCodes: ["final_phase"],
    pendingItemIds: [],
    failedCriteriaIds: [],
  };

  assert.equal(decision.nextPhase, null);
});

test("PhaseAdvanceDecision can be not allowed", () => {
  const decision: PhaseAdvanceDecision = {
    phase: "phase1",
    nextPhase: "phase2",
    allowed: false,
    reasonCodes: ["items_incomplete"],
    pendingItemIds: ["item_1", "item_2"],
    failedCriteriaIds: ["criterion_1"],
  };

  assert.equal(decision.allowed, false);
  assert.equal(decision.pendingItemIds.length, 2);
  assert.equal(decision.failedCriteriaIds.length, 1);
});

test("RoadmapItem has correct structure", () => {
  const item: RoadmapItem = {
    itemId: "item_1",
    title: "Implement Feature X",
    description: "Implement feature X according to spec",
    phase: "phase1",
    status: "in_progress",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-10T00:00:00Z",
  };

  assert.equal(item.itemId, "item_1");
  assert.equal(item.title, "Implement Feature X");
  assert.equal(item.phase, "phase1");
  assert.equal(item.status, "in_progress");
  assert.equal(item.completedAt, undefined);
  assert.equal(item.deferredReason, undefined);
});

test("RoadmapItem can have completedAt when completed", () => {
  const item: RoadmapItem = {
    itemId: "item_completed",
    title: "Completed Item",
    description: "This item is done",
    phase: "phase1",
    status: "completed",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
    completedAt: "2024-01-15T00:00:00Z",
  };

  assert.equal(item.status, "completed");
  assert.equal(item.completedAt, "2024-01-15T00:00:00Z");
});

test("RoadmapItem can be deferred with reason", () => {
  const item: RoadmapItem = {
    itemId: "item_deferred",
    title: "Deferred Item",
    description: "This item is deferred",
    phase: "phase2",
    status: "deferred",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-20T00:00:00Z",
    deferredReason: "Waiting for dependency to be released",
  };

  assert.equal(item.status, "deferred");
  assert.equal(item.deferredReason, "Waiting for dependency to be released");
});

test("RoadmapItem can have completionRecord", () => {
  const item: RoadmapItem = {
    itemId: "item_with_record",
    title: "Item with Record",
    description: "Has completion record",
    phase: "phase1",
    status: "completed",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
    completedAt: "2024-01-15T00:00:00Z",
    completionRecord: {
      completedAt: "2024-01-15T00:00:00Z",
      notes: "Successfully completed all tasks",
      artifacts: ["artifact_1", "artifact_2"],
    },
  };

  assert.ok(item.completionRecord);
  assert.equal(item.completionRecord?.notes, "Successfully completed all tasks");
  assert.equal(item.completionRecord?.artifacts?.length, 2);
});

test("CompletionRecord has correct structure", () => {
  const record: CompletionRecord = {
    completedAt: "2024-01-15T12:00:00Z",
    notes: "Final completion notes",
    artifacts: ["artifact_doc", "artifact_report"],
  };

  assert.equal(record.completedAt, "2024-01-15T12:00:00Z");
  assert.equal(record.notes, "Final completion notes");
  assert.deepEqual(record.artifacts, ["artifact_doc", "artifact_report"]);
});

test("CompletionRecord notes and artifacts are optional", () => {
  const record: CompletionRecord = {
    completedAt: "2024-01-15T12:00:00Z",
  };

  assert.equal(record.completedAt, "2024-01-15T12:00:00Z");
  assert.equal(record.notes, undefined);
  assert.equal(record.artifacts, undefined);
});

test("Phase has correct structure", () => {
  const phase: Phase = {
    phaseId: "phase_1",
    phase: "phase1",
    name: "Foundation",
    description: "Establish foundation for the project",
    status: "completed",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-02-01T00:00:00Z",
  };

  assert.equal(phase.phaseId, "phase_1");
  assert.equal(phase.phase, "phase1");
  assert.equal(phase.name, "Foundation");
  assert.equal(phase.description, "Establish foundation for the project");
  assert.equal(phase.status, "completed");
});

test("Deliverable has correct structure", () => {
  const deliverable: Deliverable = {
    deliverableId: "deliverable_1",
    phaseId: "phase_1",
    title: "Architecture Document",
    description: "System architecture specification",
  };

  assert.equal(deliverable.deliverableId, "deliverable_1");
  assert.equal(deliverable.phaseId, "phase_1");
  assert.equal(deliverable.title, "Architecture Document");
  assert.equal(deliverable.completedAt, undefined);
});

test("Deliverable can be completed", () => {
  const deliverable: Deliverable = {
    deliverableId: "deliverable_done",
    phaseId: "phase_1",
    title: "Completed Deliverable",
    description: "This is done",
    completedAt: "2024-02-15T00:00:00Z",
  };

  assert.equal(deliverable.completedAt, "2024-02-15T00:00:00Z");
});

test("PhaseProgress has correct structure", () => {
  const progress: PhaseProgress = {
    phaseId: "phase_1",
    totalDeliverables: 10,
    completedDeliverables: 7,
    completionPercentage: 70,
  };

  assert.equal(progress.phaseId, "phase_1");
  assert.equal(progress.totalDeliverables, 10);
  assert.equal(progress.completedDeliverables, 7);
  assert.equal(progress.completionPercentage, 70);
});

test("PhaseProgress can be 100% complete", () => {
  const progress: PhaseProgress = {
    phaseId: "phase_done",
    totalDeliverables: 5,
    completedDeliverables: 5,
    completionPercentage: 100,
  };

  assert.equal(progress.completionPercentage, 100);
});

test("AddRoadmapItemRequest has correct structure", () => {
  const request: AddRoadmapItemRequest = {
    title: "New Roadmap Item",
    description: "Description of new item",
    phase: "phase3",
  };

  assert.equal(request.title, "New Roadmap Item");
  assert.equal(request.description, "Description of new item");
  assert.equal(request.phase, "phase3");
});

test("AddDeliverableRequest has correct structure", () => {
  const request: AddDeliverableRequest = {
    title: "New Deliverable",
    description: "Description of new deliverable",
  };

  assert.equal(request.title, "New Deliverable");
  assert.equal(request.description, "Description of new deliverable");
});
