/**
 * E2E Workflow Debugger Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { WorkflowDebuggerService } from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import { isBreakpointHit } from "../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";
import { TimeTravelDebugService } from "../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import { buildRunComparison } from "../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";

test("E2E Debugger: breakpoint matcher identifies matching step IDs", async () => {
  const harness = createE2EHarness("aa-e2e-debug-bp-");
  try {
    const hit = isBreakpointHit([{ breakpointId: "bp_e2e_001", stepId: "step_2" }], "step_2");
    assert.equal(hit, true);
  } finally {
    harness.cleanup();
  }
});

test("E2E Debugger: TimeTravelDebugService reconstructs replay state at breakpoint", async () => {
  const harness = createE2EHarness("aa-e2e-debug-timetravel-");
  try {
    const service = new TimeTravelDebugService();
    const session = service.createSession("task_e2e_001", "exec_e2e_001");
    service.loadEventStore("exec_e2e_001", [
      { stepId: "step_0", timestamp: "2026-05-01T10:00:00Z", variables: { a: 1 } },
      { stepId: "step_1", timestamp: "2026-05-01T10:01:00Z", variables: { b: 2 } },
      { stepId: "step_2", timestamp: "2026-05-01T10:02:00Z", variables: { c: 3 } },
    ]);
    service.setBreakpoints(session.sessionId, ["step_1"]);

    const replay = service.replayToCursor(session.sessionId, 3);

    assert.ok(replay, "Should return replay state");
    assert.equal(replay?.reachedBreakpoint, true);
    assert.equal(replay?.currentEventIndex, 2);
  } finally {
    harness.cleanup();
  }
});

test("E2E Debugger: run comparator identifies differences between two runs", async () => {
  const harness = createE2EHarness("aa-e2e-debug-compare-");
  try {
    const diff = buildRunComparison(
      [
        { stepId: "step_0", status: "completed", outputHash: "a" },
        { stepId: "step_1", status: "completed", outputHash: "b" },
      ],
      [
        { stepId: "step_0", status: "completed", outputHash: "a" },
        { stepId: "step_1", status: "failed", outputHash: "c" },
      ],
    );

    assert.equal(diff.length, 2);
    assert.equal(diff[1]?.statusChanged, true);
    assert.equal(diff[1]?.outputChanged, true);
  } finally {
    harness.cleanup();
  }
});

test("E2E Debugger: WorkflowDebuggerService manages breakpoints and comparison reports", async () => {
  const harness = createE2EHarness("aa-e2e-debugger-");
  try {
    const service = new WorkflowDebuggerService();

    const breakpoint = service.registerBreakpoint(
      { actorId: "debugger", allowedRuntime: "replay_sandbox" },
      "dev",
      {
        breakpointId: "bp_session_001",
        workflowId: "task_e2e_debug",
        stepSelector: "step_1",
        condition: "always",
        action: "pause",
      },
    );
    const breakpoints = service.listBreakpoints("task_e2e_debug");
    const report = service.buildComparisonReport(
      "task_e2e_debug",
      [{ stepId: "step_1", status: "completed", timestamp: "2026-05-01T10:00:00Z", label: "left" }],
      [{ stepId: "step_1", status: "failed", timestamp: "2026-05-01T10:01:00Z", label: "right" }],
    );

    assert.equal(breakpoint.breakpointId, "bp_session_001");
    assert.equal(breakpoints.length, 1);
    assert.equal(report.regressionDetected, true);
    assert.ok(report.differences.length > 0);
  } finally {
    harness.cleanup();
  }
});
