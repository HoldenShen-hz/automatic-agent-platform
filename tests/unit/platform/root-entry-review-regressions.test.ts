import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiOperationsStartupPlan,
  buildFivePlaneRuntimeCatalog,
  buildPlatformRootDemoSummary,
  buildPlatformRootSummary,
} from "../../../src/index.js";
import type {
  HarnessRun,
  HarnessRunStatus,
  NodeRun,
  PlanGraphBundle,
  PlatformStartupTargetKind,
} from "../../../src/index.js";
import type {
  HarnessRun as CanonicalHarnessRun,
  HarnessRunStatus as CanonicalHarnessRunStatus,
  NodeRun as CanonicalNodeRun,
  PlanGraphBundle as CanonicalPlanGraphBundle,
} from "../../../src/platform/contracts/executable-contracts/index.js";

type Assert<T extends true> = T;

type _HarnessRunReexportMatches = Assert<HarnessRun extends CanonicalHarnessRun ? true : false>;
type _HarnessRunStatusReexportMatches = Assert<HarnessRunStatus extends CanonicalHarnessRunStatus ? true : false>;
type _NodeRunReexportMatches = Assert<NodeRun extends CanonicalNodeRun ? true : false>;
type _PlanGraphBundleReexportMatches = Assert<PlanGraphBundle extends CanonicalPlanGraphBundle ? true : false>;
type _PlatformStartupTargetKindMatches = Assert<PlatformStartupTargetKind extends "summary" | "demo" | "api" | "console" | "worker" ? true : false>;

void (true as _HarnessRunReexportMatches);
void (true as _HarnessRunStatusReexportMatches);
void (true as _NodeRunReexportMatches);
void (true as _PlanGraphBundleReexportMatches);
void (true as _PlatformStartupTargetKindMatches);

test("root entry re-exports startup builders on the top-level surface", () => {
  assert.equal(typeof buildFivePlaneRuntimeCatalog, "function");
  assert.equal(typeof buildAiOperationsStartupPlan, "function");
});

test("buildPlatformRootDemoSummary publishes canonical-neutral output instead of legacy record envelopes", () => {
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
  assert.equal("task" in (summary as Record<string, unknown>), false);
  assert.equal("workflow" in (summary as Record<string, unknown>), false);
  assert.equal("execution" in (summary as Record<string, unknown>), false);
  assert.equal("session" in (summary as Record<string, unknown>), false);
});

test("buildPlatformRootSummary keeps other sections available when one builder fails", () => {
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
