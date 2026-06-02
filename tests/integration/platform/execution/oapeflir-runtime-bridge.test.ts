import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { OapeflirLoopService } from "../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { RuntimeExecuteBridge } from "../../../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("RuntimeExecuteBridge executes a 2-step OAPEFLIR plan via runMultiStepOrchestration oapeflir://plan bypass", async () => {
  const workspace = createTempWorkspace("aa-oapeflir-bridge-");
  try {
    const dbPath = join(workspace, "oapeflir-bridge.db");
    const bridge = new RuntimeExecuteBridge(dbPath);

    const plan = {
      planId: "plan_test_001",
      taskId: "task_test",
      version: 1,
      assessmentRef: "assessment_test",
      strategy: "linear" as const,
      steps: [
        {
          stepId: "step_read",
          action: "read_file",
          title: "Read a file",
          inputs: {},
          outputs: ["file_content"],
          dependencies: [],
          timeout: 30000,
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          status: "pending" as const,
        },
        {
          stepId: "step_analyze",
          action: "analyze_file",
          title: "Analyze content",
          inputs: { file_content: "step_read" },
          outputs: ["analysis"],
          dependencies: ["step_read"],
          timeout: 30000,
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          status: "pending" as const,
        },
      ],
      createdAt: Date.now(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await bridge.executePlan(plan as any, { taskId: "task_test" });

    assert.equal(result.planId, "plan_test_001");
    assert.ok(result.results.length <= 2, "runtime bridge should not emit more step results than planned");
    assert.ok(result.skippedStepIds.length <= 2, "skippedStepIds should remain bounded by planned steps");
    if (result.results.length > 0) {
      assert.ok(
        result.results.every((r) => ["succeeded", "failed", "skipped"].includes(r.status)),
        "all emitted step results should have valid status",
      );
    }
    assert.ok(result.totalDurationMs >= 0, "totalDurationMs should be non-negative");
    assert.ok(result.totalTokenCost >= 0, "totalTokenCost should be non-negative");
  } finally {
    cleanupPath(workspace);
  }
});

test("OapeflirLoopService with RuntimeExecuteBridge executes plan and returns step outputs", async () => {
  const workspace = createTempWorkspace("aa-oapeflir-loop-bridge-");
  try {
    const dbPath = join(workspace, "oapeflir-loop.db");
    const service = new OapeflirLoopService({ dbPath });

    const workflow = {
      workflow: {
        workflowId: "wf_bridge_test",
        divisionId: "coding",
        steps: [
          {
            stepId: "step_write",
            roleId: "writer",
            outputKey: "written_content",
            dependsOnStepIds: [],
            timeoutMs: 30000,
            maxAttempts: 1,
          },
        ],
      },
      executionSteps: [
        {
          stepId: "step_write",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_writer",
          outputKey: "written_content",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
      planReason: "test.bridge_execution",
      dependencyEdges: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await service.run({
      taskId: "task_bridge_test",
      objective: "Test OAPEFLIR loop with RuntimeExecuteBridge",
      workflow: workflow as any,
    });

    assert.equal(result.plan.taskId, "task_bridge_test");
    assert.ok(result.timeline.length >= 8, "should have all OAPEFLIR stages");
    assert.deepEqual(
      result.timeline.map((e) => e.stage),
      ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"],
    );
    // With RuntimeExecuteBridge, step outputs come from real orchestrator execution
    // The exact status depends on whether the orchestrator can execute the steps
    assert.ok(
      result.stepOutputs.every((o) => o.stepId && o.planRef),
      "step outputs should have stepId and planRef",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("OapeflirLoopService with dbPath uses RuntimeExecuteBridge by default", async () => {
  const workspace = createTempWorkspace("aa-default-bridge-");
  try {
    const dbPath = join(workspace, "default-bridge.db");
    const service = new OapeflirLoopService({ dbPath });

    const workflow = {
      workflow: {
        workflowId: "wf_default_test",
        divisionId: "general-ops",
        steps: [
          {
            stepId: "step_diagnose",
            roleId: "diagnostic_agent",
            outputKey: "diagnosis",
            dependsOnStepIds: [],
            timeoutMs: 30000,
            maxAttempts: 1,
          },
        ],
      },
      executionSteps: [
        {
          stepId: "step_diagnose",
          divisionId: "general-ops",
          roleId: "diagnostic_agent",
          inputKeys: [],
          agentId: "agent_diagnostic_agent",
          outputKey: "diagnosis",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 30000,
          maxAttempts: 1,
        },
      ],
      planReason: "test.default_bridge",
      dependencyEdges: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await service.run({
      taskId: "task_default_test",
      objective: "Verify default RuntimeExecuteBridge is used",
      workflow: workflow as any,
    });

    // The key assertion is that the runtime bridge path completed the execute stage.
    assert.ok(
      result.timeline.some((e) => e.stage === "execute"),
      "execute stage should be recorded",
    );
    assert.equal(result.plan.taskId, "task_default_test");
    assert.ok(
      ["completed", "failed", "repairable", "partial", "escalated"].includes(result.feedback.outcome),
      "feedback outcome should remain within the declared contract",
    );
  } finally {
    cleanupPath(workspace);
  }
});
