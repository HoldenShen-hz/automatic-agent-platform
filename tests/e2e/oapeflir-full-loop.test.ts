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

import { OapeflirLoopService } from "../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { RuntimeExecuteBridge } from "../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";

test("E2E: OAPEFLIR loop completes all 8 stages in sequence — happy path", async () => {
  const harness = createE2EHarness("e2e-oapeflir-");
  try {
    // ADR-029 fix: OAPEFLIR Execute phase must route through HarnessRuntime via
    // RuntimeExecuteBridge, which calls runMultiStepOrchestration (the canonical
    // execution path). This replaces the DeterministicE2EBridge which bypassed
    // HarnessRuntime and violated ADR-029 architecture layering.
    const executeBridge = new RuntimeExecuteBridge(harness.dbPath);
    const service = new OapeflirLoopService({ executeBridge });

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
// @ts-ignore
    assert.equal(result.outcome.nextAction, "complete");
  } finally {
    harness.cleanup();
  }
});

test("E2E: OAPEFLIR loop with failure signal triggers learn/improve/release chain", async () => {
  const harness = createE2EHarness("e2e-oapeflir-failure-");
  try {
    // ADR-029 fix: OAPEFLIR Execute phase must route through HarnessRuntime via
    // RuntimeExecuteBridge, which calls runMultiStepOrchestration (the canonical
    // execution path). This replaces the DeterministicE2EBridge which bypassed
    // HarnessRuntime and violated ADR-029 architecture layering.
    const executeBridge = new RuntimeExecuteBridge(harness.dbPath);
    const service = new OapeflirLoopService({ executeBridge });

    const result = await service.run({
      taskId: "task_e2e_failure",
      objective: "E2E test: failure signal triggers F→L→I→R chain",
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

    // learn/improve/release must complete (not skip) when failure signal is present
    const learnEntry = result.timeline.find((e) => e.stage === "learn");
    assert.ok(learnEntry, "Learn stage must be present");
    assert.equal(learnEntry!.status, "completed", "Learn stage must complete with failure signal");

    const improveEntry = result.timeline.find((e) => e.stage === "improve");
    assert.ok(improveEntry, "Improve stage must be present");
    assert.equal(improveEntry!.status, "completed", "Improve stage must complete with failure signal");

    const releaseEntry = result.timeline.find((e) => e.stage === "release");
    assert.ok(releaseEntry, "Release stage must be present");
    assert.equal(releaseEntry!.status, "completed", "Release stage must complete with failure signal");

    // Learning objects must be produced
    assert.ok(result.learningObjects.length > 0, "Must produce at least one learning object");

    // Rollout record must be in shadow mode
    assert.ok(result.rolloutRecord, "Rollout record must be created");
    assert.equal(result.rolloutRecord!.status, "shadow", "Rollout must start in shadow mode");

    // Replan decision must be triggered
    assert.equal(result.replanDecision.shouldReplan, true, "Replan must be triggered on failure");
  } finally {
    harness.cleanup();
  }
});
