import assert from "node:assert/strict";
import test from "node:test";

import {
  PhaseDeliveryService,
  RoadmapService,
  SuccessCriteriaService,
} from "../../../../src/domains/roadmap/index.js";
import type {
  AddDeliverableRequest,
  AddRoadmapItemRequest,
  CompletionRecord,
  Deliverable,
  Phase,
  PhaseAdvanceDecision,
  PhaseGateDefinition,
  PhaseProgress,
  RoadmapItem,
  RoadmapPhase,
  RoadmapStatus,
  SuccessCriterionDefinition,
  SuccessCriterionEvaluation,
  SuccessCriterionMeasurement,
  SuccessCriterionMeasurementType,
} from "../../../../src/domains/roadmap/index.js";

function assertTypeExport<T>(_value: T): true {
  return true;
}

test("roadmap index module exports RoadmapService", () => {
  assert.equal(typeof RoadmapService, "function");
});

test("roadmap index module re-exports types for compile-time consumers", () => {
  assert.equal(
    assertTypeExport<
      | CompletionRecord
      | PhaseGateDefinition
      | RoadmapPhase
      | RoadmapItem
      | SuccessCriterionDefinition
      | SuccessCriterionMeasurement
      | SuccessCriterionEvaluation
      | PhaseAdvanceDecision
      | RoadmapStatus
      | SuccessCriterionMeasurementType
      | Phase
      | Deliverable
      | PhaseProgress
      | AddRoadmapItemRequest
      | AddDeliverableRequest
      | null
    >(null),
    true,
  );
});

test("roadmap index module exports PhaseDeliveryService", () => {
  assert.equal(typeof PhaseDeliveryService, "function");
});

test("roadmap index module exports SuccessCriteriaService", () => {
  assert.equal(typeof SuccessCriteriaService, "function");
});
