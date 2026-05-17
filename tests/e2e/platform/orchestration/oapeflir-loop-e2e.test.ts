import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { buildFromStepResults } from "../../../../src/platform/five-plane-orchestration/oapeflir/handoff-builder.js";

function createWorkflow() {
  return {
    workflow: {
      workflowId: "wf-oapeflir-e2e",
      divisionId: "coding",
      steps: [
        {
          stepId: "step-1",
          roleId: "writer",
          outputKey: "result",
          dependsOnStepIds: [],
          timeoutMs: 5000,
          maxAttempts: 1,
        },
      ],
    },
    executionSteps: [
      {
        stepId: "step-1",
        divisionId: "coding",
        roleId: "writer",
        inputKeys: [],
        agentId: "agent-writer",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 5000,
        maxAttempts: 1,
      },
    ],
    planReason: "e2e.oapeflir",
    dependencyEdges: [],
  };
}

test("E2E OAPEFLIR: run completes the canonical stage timeline", async () => {
  const service = new OapeflirLoopService();

  const result = await service.run({
    taskId: "task-oapeflir-happy",
    objective: "Run the OAPEFLIR loop end to end.",
    workflow: createWorkflow(),
  });

  assert.deepEqual(
    result.timeline.map((record) => record.stage),
    ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"],
  );
  assert.ok(result.stepOutputs.length > 0);
});

test("E2E OAPEFLIR: failure feedback triggers learning and replanning signals", async () => {
  const service = new OapeflirLoopService();

  const result = await service.run({
    taskId: "task-oapeflir-failure",
    objective: "Run the loop with a repair signal.",
    workflow: createWorkflow(),
    feedbackSignals: [
      {
        signalId: "sig-failure",
        taskId: "task-oapeflir-failure",
        source: "execution",
        category: "failure",
        severity: "error",
        payload: { reasonCode: "schema_loop.detected" },
        stepOutputRefs: ["step-1"],
        timestamp: Date.now(),
        feedbackTrustScore: 0.5,
        trustFactors: {
          sourceReliability: 0.5,
          historicalAccuracy: 0.5,
          authenticatedSource: false,
          attackSurfaceExposure: 0.5,
          holdoutOverlap: 0,
        },
      },
    ],
  });

  assert.equal(result.replanDecision.shouldReplan, true);
  assert.equal(result.timeline.find((record) => record.stage === "learn")?.status, "completed");
  assert.equal(result.timeline.find((record) => record.stage === "improve")?.status, "completed");
});

test("E2E OAPEFLIR: handoff builder preserves facts and state for the next agent", () => {
  const handoff = buildFromStepResults({
    taskId: "task-oapeflir-handoff",
    fromAgentId: "agent-a",
    toAgentId: "agent-b",
    currentPhase: "feedback",
    blockers: ["awaiting validation"],
    remainingBudgetUsd: 0.25,
    latestSummary: "Completed execution and prepared a handoff.",
    completedSteps: [
      {
        stepId: "step-1",
        action: "read",
        title: "Read input",
        inputs: {},
        outputs: ["result"],
        dependencies: [],
        status: "done",
        timeout: 5000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    stepOutputs: [
      {
        stepId: "step-1",
        planRef: "plan-1",
        status: "succeeded",
        userFacingResult: { summary: "Read and summarized the file", artifacts: ["artifact-1"] },
        systemTelemetry: {
          durationMs: 100,
          tokensUsed: 50,
          modelId: "test-model",
          retryCount: 0,
          validationPassed: true,
        },
      },
    ],
    primaryRefs: ["artifact-1"],
  });

  assert.equal(handoff.fromAgentId, "agent-a");
  assert.equal(handoff.toAgentId, "agent-b");
  assert.equal(handoff.state.currentPhase, "feedback");
  assert.deepEqual(handoff.fact.artifactRefs, ["artifact-1"]);
});
