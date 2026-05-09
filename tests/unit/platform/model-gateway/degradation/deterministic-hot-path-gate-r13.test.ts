import assert from "node:assert/strict";
import test from "node:test";

import {
  DeterministicHotPathGate,
} from "../../../../../src/platform/model-gateway/degradation/deterministic-hot-path-gate.js";
import {
  ResponsibilityBoundaryService,
  resetResponsibilityBoundaryService,
} from "../../../../../src/platform/contracts/types/responsibility-boundary.js";

test("DeterministicHotPathGate blocks AI hot path when responsibility boundary requires human accountability", () => {
  resetResponsibilityBoundaryService();
  const boundaryService = new ResponsibilityBoundaryService();
  const boundary = boundaryService.createBoundary({
    taskId: "task-1",
    executionId: "exec-1",
    boundaryType: "human_in_the_loop",
    operatingMode: "human_accountable",
    stageRef: "stage-1",
    createdBy: "admin",
    description: "Human accountable boundary",
  });

  const gate = new DeterministicHotPathGate();
  const decision = gate.evaluate({
    routeId: "route-1",
    latencyClass: "normal",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    responsibilityBoundaryId: boundary.boundaryId,
    responsibilityBoundaryService: boundaryService,
    actorType: "ai_agent",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.routeMode, "deterministic_hot_path_only");
  assert.equal(decision.reasonCode, "hot_path.responsibility_boundary_blocked");
});

test("DeterministicHotPathGate allows human operator to proceed through responsibility boundary", () => {
  const boundaryService = new ResponsibilityBoundaryService();
  const boundary = boundaryService.createBoundary({
    taskId: "task-2",
    executionId: "exec-2",
    boundaryType: "human_in_the_loop",
    operatingMode: "human_accountable",
    stageRef: "stage-2",
    createdBy: "admin",
    description: "Human accountable boundary",
  });

  const gate = new DeterministicHotPathGate();
  const decision = gate.evaluate({
    routeId: "route-2",
    latencyClass: "normal",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    responsibilityBoundaryId: boundary.boundaryId,
    responsibilityBoundaryService: boundaryService,
    actorType: "human_operator",
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "hot_path.allowed");
});
