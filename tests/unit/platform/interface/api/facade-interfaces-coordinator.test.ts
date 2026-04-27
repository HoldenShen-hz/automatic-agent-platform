/**
 * Unit tests for Coordinator Selection facade types
 * Tests src/platform/interface/api/facade-interfaces.ts - Coordinator types
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  CoordinatorSelectionInput,
  CoordinatorSelectionEvaluation,
  CoordinatorSelectionDecision,
  CoordinatorLoadBalancingSummary,
  ApiDelegationService,
} from "../../../../../src/platform/interface/api/facade-interfaces.js";

test("CoordinatorSelectionInput allows all optional fields", () => {
  const input: CoordinatorSelectionInput = {
    queueName: "default",
    preferredRegion: "us-east-1",
    tenantId: "tenant-123",
    requestKey: "req-key-abc",
  };
  assert.equal(input.queueName, "default");
  assert.equal(input.preferredRegion, "us-east-1");
  assert.equal(input.tenantId, "tenant-123");
  assert.equal(input.requestKey, "req-key-abc");
});

test("CoordinatorSelectionInput allows empty object", () => {
  const input: CoordinatorSelectionInput = {};
  assert.equal(input.queueName, undefined);
  assert.equal(input.preferredRegion, undefined);
});

test("CoordinatorSelectionInput allows null values", () => {
  const input: CoordinatorSelectionInput = {
    queueName: null,
    preferredRegion: null,
    tenantId: null,
    requestKey: null,
  };
  assert.equal(input.queueName, null);
  assert.equal(input.preferredRegion, null);
});

test("CoordinatorSelectionEvaluation structure is correct", () => {
  const evaluation: CoordinatorSelectionEvaluation = {
    coordinatorId: "coord-1",
    eligible: true,
    score: 95.5,
    reasonCode: "preferred_region",
  };
  assert.equal(evaluation.coordinatorId, "coord-1");
  assert.equal(evaluation.eligible, true);
  assert.equal(evaluation.score, 95.5);
  assert.equal(evaluation.reasonCode, "preferred_region");
});

test("CoordinatorSelectionEvaluation allows null score and reasonCode", () => {
  const evaluationNull: CoordinatorSelectionEvaluation = {
    coordinatorId: "coord-2",
    eligible: false,
    score: null,
    reasonCode: null,
  };
  assert.equal(evaluationNull.score, null);
  assert.equal(evaluationNull.reasonCode, null);
});

test("CoordinatorSelectionDecision structure is correct for selected outcome", () => {
  const decision: CoordinatorSelectionDecision = {
    outcome: "selected",
    selectedCoordinatorId: "coord-1",
    reasonCode: "best_score",
    evaluations: [
      { coordinatorId: "coord-1", eligible: true, score: 100, reasonCode: "best_score" },
      { coordinatorId: "coord-2", eligible: true, score: 80, reasonCode: "ok" },
    ],
  };
  assert.equal(decision.outcome, "selected");
  assert.equal(decision.selectedCoordinatorId, "coord-1");
  assert.equal(decision.evaluations.length, 2);
});

test("CoordinatorSelectionDecision structure is correct for no_candidate outcome", () => {
  const decision: CoordinatorSelectionDecision = {
    outcome: "no_candidate",
    selectedCoordinatorId: null,
    reasonCode: "no_eligible_coordinators",
    evaluations: [],
  };
  assert.equal(decision.outcome, "no_candidate");
  assert.equal(decision.selectedCoordinatorId, null);
  assert.equal(decision.evaluations.length, 0);
});

test("CoordinatorLoadBalancingSummary structure is correct", () => {
  const summary: CoordinatorLoadBalancingSummary = {
    generatedAt: "2026-04-26T10:00:00.000Z",
    coordinatorCount: 10,
    activeCount: 7,
    drainingCount: 2,
    offlineCount: 1,
    totalCapacity: 1000,
    totalActiveDispatchCount: 250,
    totalBacklogCount: 150,
    regions: ["us-east-1", "us-west-2", "eu-west-1"],
    hotCoordinatorIds: ["coord-1", "coord-2"],
  };
  assert.equal(summary.coordinatorCount, 10);
  assert.equal(summary.activeCount, 7);
  assert.equal(summary.drainingCount, 2);
  assert.equal(summary.offlineCount, 1);
  assert.equal(summary.regions.length, 3);
  assert.equal(summary.hotCoordinatorIds.length, 2);
});

test("CoordinatorLoadBalancingSummary allows empty arrays", () => {
  const summary: CoordinatorLoadBalancingSummary = {
    generatedAt: "2026-04-26T10:00:00.000Z",
    coordinatorCount: 0,
    activeCount: 0,
    drainingCount: 0,
    offlineCount: 0,
    totalCapacity: 0,
    totalActiveDispatchCount: 0,
    totalBacklogCount: 0,
    regions: [],
    hotCoordinatorIds: [],
  };
  assert.equal(summary.coordinatorCount, 0);
  assert.equal(summary.regions.length, 0);
  assert.equal(summary.hotCoordinatorIds.length, 0);
});

test("ApiDelegationService interface defines required methods", () => {
  const service = {} as ApiDelegationService;
  assert.equal(typeof service.buildSummary, "function");
  assert.equal(typeof service.selectCoordinator, "function");
});

test("CoordinatorSelectionDecision evaluations maintain order", () => {
  const evaluations: CoordinatorSelectionEvaluation[] = [
    { coordinatorId: "c1", eligible: true, score: 100, reasonCode: "best" },
    { coordinatorId: "c2", eligible: true, score: 90, reasonCode: "good" },
    { coordinatorId: "c3", eligible: false, score: null, reasonCode: "offline" },
  ];
  const decision: CoordinatorSelectionDecision = {
    outcome: "selected",
    selectedCoordinatorId: "c1",
    reasonCode: "best",
    evaluations,
  };
  assert.equal(decision.evaluations[0]?.coordinatorId, "c1");
  assert.equal(decision.evaluations[1]?.coordinatorId, "c2");
  assert.equal(decision.evaluations[2]?.coordinatorId, "c3");
});
