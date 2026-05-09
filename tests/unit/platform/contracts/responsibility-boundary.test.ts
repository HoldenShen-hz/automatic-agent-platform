import assert from "node:assert/strict";
import test from "node:test";

import { ResponsibilityBoundaryService } from "../../../../src/platform/contracts/types/responsibility-boundary.js";

test("ResponsibilityBoundaryService blocks mutating actions in advisory_only mode", () => {
  const service = new ResponsibilityBoundaryService();
  const boundary = service.createBoundary({
    taskId: "task-1",
    boundaryType: "human_in_the_loop",
    operatingMode: "advisory_only",
    stageRef: "plan",
    createdBy: "system",
    description: "advice only boundary",
  });

  assert.throws(
    () =>
      service.recordTransfer({
        boundaryId: boundary.boundaryId,
        fromActor: "agent-1",
        fromActorType: "ai_agent",
        toActor: "agent-2",
        toActorType: "ai_agent",
        action: "override",
        reason: "attempted autonomous override",
      }),
    /responsibility_boundary\.advisory_only_blocks_action:override/,
  );
});

test("ResponsibilityBoundaryService requires human actor for human_accountable actions", () => {
  const service = new ResponsibilityBoundaryService();
  const boundary = service.createBoundary({
    taskId: "task-2",
    boundaryType: "human_in_the_loop",
    operatingMode: "human_accountable",
    stageRef: "execute",
    createdBy: "system",
    description: "human accountability boundary",
  });

  assert.throws(
    () =>
      service.recordTransfer({
        boundaryId: boundary.boundaryId,
        fromActor: "agent-1",
        fromActorType: "ai_agent",
        toActor: "agent-2",
        toActorType: "ai_agent",
        action: "approve",
        reason: "autonomous approval should fail",
      }),
    /responsibility_boundary\.human_accountable_requires_human:approve/,
  );

  const transfer = service.recordTransfer({
    boundaryId: boundary.boundaryId,
    fromActor: "agent-1",
    fromActorType: "ai_agent",
    toActor: "operator-1",
    toActorType: "human_operator",
    action: "approve",
    reason: "human approval is permitted",
  });
  assert.equal(transfer.toActorType, "human_operator");
});
