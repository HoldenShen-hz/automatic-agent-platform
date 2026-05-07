/**
 * E2E OAPEFLIR Full-Loop Tests
 *
 * End-to-end tests verifying the 8-stage OAPEFLIR loop can run
 * from Observe through Release without crashing.
 *
 * G3: "无 OAPEFLIR E2E 测试 — 不知 8 阶段能否端到端跑通"
 * This file provides the minimal E2E verification: the loop completes
 * all 8 stages in sequence without throwing.
 *
 * Note: Full stage-output validation is covered in integration tests.
 * These E2E tests focus on proving the loop can execute without crashes
 * and produces a complete stage timeline.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import type { DualChannelStepOutput } from "../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";

test("E2E: OAPEFLIR loop completes all 8 stages in sequence — happy path", async () => {
  const workspace = createTempWorkspace("e2e-oapeflir-");

  try {
    const service = new OapeflirLoopService();
    const stepOutputs: DualChannelStepOutput[] = [
      {
        stepId: "step_e2e",
        planRef: "plan_e2e_happy",
        userFacingResult: {
          summary: "E2E consumed caller-supplied canonical step output",
          artifacts: [],
        },
        systemTelemetry: {
          durationMs: 1,
          tokensUsed: 1,
          modelId: "e2e-deterministic",
          retryCount: 0,
          validationPassed: true,
        },
      },
    ];

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
      stepOutputs,
    });

    // Core G3 assertion: all 8 stages appear in the timeline
    const stages = result.timeline.map((e) => e.stage);
    assert.deepEqual(
      stages,
      ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"],
      "All 8 OAPEFLIR stages must be present",
    );

    // Core stages (observe→assess→plan→execute→feedback) must be completed
    for (const stage of ["observe", "assess", "plan", "execute", "feedback"] as const) {
      const entry = result.timeline.find((e) => e.stage === stage);
      assert.equal(entry?.status, "completed", `Stage ${stage} must be completed`);
    }

    // In happy path (no failure signals), learn/improve/release are correctly skipped
    for (const stage of ["learn", "improve", "release"] as const) {
      const entry = result.timeline.find((e) => e.stage === stage);
      assert.equal(entry?.status, "skipped", `Stage ${stage} must be skipped in happy path`);
    }

    // Timeline must be sequential (each stage starts after the previous one)
    for (let i = 1; i < result.timeline.length; i++) {
      assert.ok(
        result.timeline[i]!.startedAt >= result.timeline[i - 1]!.completedAt,
        `Stage ${result.timeline[i]!.stage} must start after ${result.timeline[i - 1]!.stage} finishes`,
      );
    }

    // Plan must reference the task
    assert.equal(result.plan.taskId, "task_e2e_happy");

    // Execute stage must have step outputs
    assert.ok(result.stepOutputs.length > 0, "Execute stage must produce step outputs");

    // Outcome must be complete (no failure signals in happy path)
    assert.equal(result.outcome.nextAction, "complete");
  } finally {
    cleanupPath(workspace);
  }
});

test("E2E: OAPEFLIR loop consumes caller-supplied step outputs on feedback path", async () => {
  const workspace = createTempWorkspace("e2e-oapeflir-failure-");

  try {
    const service = new OapeflirLoopService();
    const stepOutputs: DualChannelStepOutput[] = [
      {
        stepId: "step_failure",
        planRef: "plan_e2e_failure",
        userFacingResult: {
          summary: "Failure-path caller output",
          artifacts: [],
        },
        systemTelemetry: {
          durationMs: 1,
          tokensUsed: 1,
          modelId: "e2e-deterministic",
          retryCount: 0,
          validationPassed: true,
        },
      },
    ];

    const result = await service.run({
      taskId: "task_e2e_failure",
      objective: "E2E test: feedback path still consumes caller-supplied outputs",
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
      stepOutputs,
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
        },
      ],
    });

    const executeEntry = result.timeline.find((e) => e.stage === "execute");
    assert.ok(executeEntry, "Execute stage must be present");
    assert.equal(executeEntry!.status, "completed");
    assert.equal(result.stepOutputs.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});
