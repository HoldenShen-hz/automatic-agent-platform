import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { RuntimeExecuteBridge } from "../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";

test("E2E: OAPEFLIR loop completes all 8 stages in sequence — happy path", async () => {
  const harness = createE2EHarness("e2e-oapeflir-");
  try {
    const service = new OapeflirLoopService({
      executeBridge: new RuntimeExecuteBridge(harness.dbPath),
    });

    const result = await service.run({
      taskId: "task_e2e_happy",
      objective: "E2E test: verify all 8 OAPEFLIR stages complete",
      workflow: {
        workflow: {
          workflowId: "wf_e2e_happy",
          divisionId: "coding",
          steps: [
            {
              stepId: "step_e2e",
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
            stepId: "step_e2e",
            divisionId: "coding",
            roleId: "writer",
            inputKeys: [],
            agentId: "agent_writer",
            outputKey: "result",
            outputSchemaPath: null,
            dependsOnStepIds: [],
            dependencyTypes: {},
            timeoutMs: 5000,
            maxAttempts: 1,
          },
        ],
        planReason: "e2e.happy_path",
        dependencyEdges: [],
      },
    });

    assert.deepEqual(
      result.timeline.map((entry) => entry.stage),
      ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"],
    );
    for (const stage of ["observe", "assess", "plan", "execute", "feedback"] as const) {
      assert.equal(result.timeline.find((entry) => entry.stage === stage)?.status, "completed");
    }
    for (const stage of ["learn", "improve", "release"] as const) {
      assert.equal(result.timeline.find((entry) => entry.stage === stage)?.status, "skipped");
    }
    assert.equal(result.plan.taskId, "task_e2e_happy");
    assert.ok(result.stepOutputs.length > 0);
  } finally {
    harness.cleanup();
  }
});

test("E2E: OAPEFLIR loop with failure signal triggers learn/improve path", async () => {
  const harness = createE2EHarness("e2e-oapeflir-failure-");
  try {
    const service = new OapeflirLoopService({
      executeBridge: new RuntimeExecuteBridge(harness.dbPath),
    });

    const result = await service.run({
      taskId: "task_e2e_failure",
      objective: "E2E test: failure signal triggers F→L→I chain",
      workflow: {
        workflow: {
          workflowId: "wf_e2e_failure",
          divisionId: "coding",
          steps: [],
        },
        executionSteps: [
          {
            stepId: "step_failure",
            divisionId: "coding",
            roleId: "writer",
            inputKeys: [],
            agentId: "agent_writer",
            outputKey: "result",
            outputSchemaPath: null,
            dependsOnStepIds: [],
            dependencyTypes: {},
            timeoutMs: 5000,
            maxAttempts: 1,
          },
        ],
        planReason: "e2e.failure_path",
        dependencyEdges: [],
      },
      feedbackSignals: [
        {
          signalId: "sig_e2e_failure",
          taskId: "task_e2e_failure",
          source: "execution",
          category: "failure",
          severity: "error",
          payload: {
            summary: "E2E simulated schema validation failure",
            reasonCode: "schema_loop.detected",
          },
          stepOutputRefs: ["step_failure"],
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

    assert.equal(result.timeline.find((entry) => entry.stage === "learn")?.status, "completed");
    assert.equal(result.timeline.find((entry) => entry.stage === "improve")?.status, "completed");
    assert.equal(result.timeline.find((entry) => entry.stage === "release")?.status, "skipped");
    assert.ok(result.learningObjects.length > 0);
    assert.equal(result.rolloutRecord, null);
    assert.equal(result.replanDecision.shouldReplan, true);
  } finally {
    harness.cleanup();
  }
});
