import assert from "node:assert/strict";
import test from "node:test";

import * as roadmapIndex from "../../../../src/domains/roadmap/index.js";

test("roadmap index module exports RoadmapService", () => {
  assert.ok(roadmapIndex.RoadmapService !== undefined);
  assert.equal(typeof roadmapIndex.RoadmapService, "function");
});

test("roadmap index module exports types", () => {
  assert.ok(roadmapIndex.CompletionRecord !== undefined);
  assert.ok(roadmapIndex.PhaseGateDefinition !== undefined);
  assert.ok(roadmapIndex.RoadmapPhase !== undefined);
  assert.ok(roadmapIndex.RoadmapItem !== undefined);
  assert.ok(roadmapIndex.SuccessCriterionDefinition !== undefined);
  assert.ok(roadmapIndex.SuccessCriterionMeasurement !== undefined);
  assert.ok(roadmapIndex.SuccessCriterionEvaluation !== undefined);
  assert.ok(roadmapIndex.PhaseAdvanceDecision !== undefined);
  assert.ok(roadmapIndex.RoadmapStatus !== undefined);
  assert.ok(roadmapIndex.SuccessCriterionMeasurementType !== undefined);
  assert.ok(roadmapIndex.Phase !== undefined);
  assert.ok(roadmapIndex.Deliverable !== undefined);
  assert.ok(roadmapIndex.PhaseProgress !== undefined);
  assert.ok(roadmapIndex.AddRoadmapItemRequest !== undefined);
  assert.ok(roadmapIndex.AddDeliverableRequest !== undefined);
});

test("roadmap index module exports PhaseDeliveryService", () => {
  assert.ok(roadmapIndex.PhaseDeliveryService !== undefined);
  assert.equal(typeof roadmapIndex.PhaseDeliveryService, "function");
});

test("roadmap index module exports SuccessCriteriaService", () => {
  assert.ok(roadmapIndex.SuccessCriteriaService !== undefined);
  assert.equal(typeof roadmapIndex.SuccessCriteriaService, "function");
});
