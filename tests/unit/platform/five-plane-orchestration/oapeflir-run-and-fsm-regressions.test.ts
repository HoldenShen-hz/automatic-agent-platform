import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { StageTransitionFSM } from "../../../../src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

test("run delegates to produceStageRationale instead of bypassing the active OAPEFLIR path", async () => {
  const service = new OapeflirLoopService();
  const expected = { marker: "delegated" };
  let called = 0;

  (service as unknown as {
    produceStageRationale: (input: unknown) => Promise<unknown>;
  }).produceStageRationale = async (input: unknown) => {
    called++;
    assert.deepEqual(input, { taskId: "task_1" });
    return expected;
  };

  const result = await service.run({ taskId: "task_1" } as never);

  assert.equal(called, 1);
  assert.equal(result, expected);
});

test("StageTransitionFSM allows feedback-driven replan back to plan and updates current stage", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  const transition = fsm.canTransitionTo("plan");
  assert.equal(transition.allowed, true);
  assert.equal(transition.reasonCode, "fsm.feedback_driven_replan");

  fsm.recordStageEntry("plan");
  assert.equal(fsm.getCurrentStage(), "plan");
});
