import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiOperationsStartupPlan,
  buildFivePlaneRuntimeCatalog,
  buildPlatformRootDemoSummary,
  buildPlatformRootSummary,
} from "../../../src/index.js";
import type { PlatformStartupTargetKind } from "../../../src/index.js";

test("root entry re-exports the current startup builders", () => {
  const targetKinds: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];

  assert.equal(typeof buildFivePlaneRuntimeCatalog, "function");
  assert.equal(typeof buildAiOperationsStartupPlan, "function");
  assert.deepEqual(targetKinds, ["summary", "demo", "api", "console", "worker"]);
});

test("buildPlatformRootDemoSummary publishes the current neutral contract surface", () => {
  const summary = buildPlatformRootDemoSummary({
    task: {
      id: "task_demo_1",
      status: "done",
      outputJson: JSON.stringify({ answer: "ok" }),
    },
    workflow: {
      status: "completed",
      currentStepIndex: 1,
    },
    execution: {
      id: "exec_demo_1",
      status: "completed",
      traceId: "trace_demo_1",
    },
    session: {
      id: "sess_demo_1",
      status: "closed",
    },
    stepOutputs: [{ stepId: "intake_triage" }],
    events: [{ eventType: "workflow:step_completed", eventTier: "tier_1" }],
  });

  assert.equal(summary.contractSurface, "platform_root_demo_summary_v1");
  assert.deepEqual(summary.runRef, {
    taskId: "task_demo_1",
    executionId: "exec_demo_1",
    sessionId: "sess_demo_1",
    traceId: "trace_demo_1",
  });
  assert.deepEqual(summary.lifecycle, {
    taskStatus: "done",
    workflowStatus: "completed",
    executionStatus: "completed",
    sessionStatus: "closed",
    currentStepIndex: 1,
  });
  assert.deepEqual(summary.result, {
    output: { answer: "ok" },
    stepOutputCount: 1,
  });
  assert.deepEqual(summary.events, [{ eventType: "workflow:step_completed", eventTier: "tier_1" }]);
});

test("buildPlatformRootSummary preserves fallback sections when one builder fails", () => {
  const summary = buildPlatformRootSummary({
    buildAiOperationsRuntimeCatalog: () => {
      throw new Error("ai ops unavailable");
    },
  });

  assert.ok(Array.isArray(summary.domains.startupOrder));
  assert.ok(summary.aiOperations.totalCapabilityCount > 0);
  assert.equal(summary.aiOperations.capabilityCounts.modelGateway, 0);
  assert.equal(summary.aiOperations.capabilityCounts.harness, 0);
});
