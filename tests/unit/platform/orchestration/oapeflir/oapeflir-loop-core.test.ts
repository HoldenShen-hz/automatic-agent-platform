import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService, type OapeflirLoopInput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.js";

function makeInput(overrides: Partial<OapeflirLoopInput> = {}): OapeflirLoopInput {
  return {
    taskId: overrides.taskId ?? "task-1",
    objective: overrides.objective ?? "inspect repository state",
    workflow: overrides.workflow ?? {
      workflow: {
        workflowId: "workflow-1",
        divisionId: "coding",
        steps: [],
      },
      executionSteps: [{
        stepId: "step-1",
        divisionId: "coding",
        roleId: "operator",
        inputKeys: [],
        agentId: "agent_operator",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1_000,
        maxAttempts: 1,
      }],
      planReason: "workflow.single_step_execution",
      dependencyEdges: [],
    },
    feedbackSignals: overrides.feedbackSignals,
    blockerSummaries: overrides.blockerSummaries,
    fileRefs: overrides.fileRefs,
    stepOutputs: overrides.stepOutputs,
    constraintPack: overrides.constraintPack,
    effectivePolicy: overrides.effectivePolicy,
  };
}

test("OapeflirLoopService constructs with default dependencies", () => {
  const service = new OapeflirLoopService();

  assert.ok(service);
  assert.equal(typeof service.run, "function");
});

test("OapeflirLoopInput accepts canonical workflow payloads", () => {
  const input = makeInput({
    blockerSummaries: ["missing approval"],
    fileRefs: ["src/index.ts"],
  });

  assert.equal(input.taskId, "task-1");
  assert.equal(input.workflow.executionSteps[0]?.stepId, "step-1");
  assert.deepEqual(input.blockerSummaries, ["missing approval"]);
  assert.deepEqual(input.fileRefs, ["src/index.ts"]);
});
