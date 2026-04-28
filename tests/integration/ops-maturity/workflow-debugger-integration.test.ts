/**
 * Integration Test: Workflow Debugger
 *
 * Tests workflow debugger breakpoint evaluation, trace comparison,
 * and timeline rendering using the debugger service.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowDebuggerService, type WorkflowTraceFrame } from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";

function makeTraceFrame(overrides: Partial<WorkflowTraceFrame> = {}): WorkflowTraceFrame {
  return {
    workflowId: "wf_test",
    stepId: "step_001",
    status: "done",
    timestamp: "2026-04-20T00:00:00.000Z",
    label: "step completed",
    ...overrides,
  };
}

test("integration: debugger registers and lists breakpoints", () => {
  const service = new WorkflowDebuggerService();

  service.registerBreakpoint(
    { actorId: "dev_1", allowedRuntime: "non_prod" },
    "dev",
    {
      breakpointId: "bp_001",
      workflowId: "wf_release",
      stepSelector: "deploy",
      condition: "always",
      action: "pause",
    },
  );

  const breakpoints = service.listBreakpoints("wf_release");
  assert.equal(breakpoints.length, 1, "Should have 1 breakpoint");
  assert.equal(breakpoints[0]!.breakpointId, "bp_001");
  assert.equal(breakpoints[0]!.stepSelector, "deploy");
});

test("integration: debugger rejects production breakpoint without permission", () => {
  const service = new WorkflowDebuggerService();

  assert.throws(
    () =>
      service.registerBreakpoint(
        { actorId: "dev_1", allowedRuntime: "non_prod" },
        "prod",
        {
          breakpointId: "bp_prod_001",
          workflowId: "wf_critical",
          stepSelector: "rollback",
          condition: "always",
          action: "compare",
        },
      ),
    (err: Error) => err.message.includes("prod_breakpoint_forbidden"),
    "Should reject production breakpoint without permission",
  );
});

test("integration: debugger evaluates trace and identifies breakpoint hits", () => {
  const service = new WorkflowDebuggerService();

  service.registerBreakpoint(
    { actorId: "sre_1", allowedRuntime: "replay_sandbox" },
    "prod",
    {
      breakpointId: "bp_eval_001",
      workflowId: "wf_invoice",
      stepSelector: "process_payment",
      condition: "always",
      action: "pause",
    },
  );

  const frames: WorkflowTraceFrame[] = [
    makeTraceFrame({ workflowId: "wf_invoice", stepId: "validate", status: "done", label: "validation done" }),
    makeTraceFrame({ workflowId: "wf_invoice", stepId: "process_payment", status: "paused", label: "payment paused" }),
    makeTraceFrame({ workflowId: "wf_invoice", stepId: "notify", status: "pending", label: "notification pending" }),
  ];

  const hits = service.evaluateTrace(frames);
  assert.equal(hits.length, 1, "Should have 1 breakpoint hit");
  assert.equal(hits[0]!.breakpointId, "bp_eval_001");
  assert.equal(hits[0]!.stepId, "process_payment");
  assert.equal(hits[0]!.action, "pause");
});

test("integration: debugger builds comparison report between two runs", () => {
  const service = new WorkflowDebuggerService();

  const leftFrames: WorkflowTraceFrame[] = [
    makeTraceFrame({ stepId: "build", status: "done", label: "build ok" }),
    makeTraceFrame({ stepId: "test", status: "done", label: "tests ok" }),
    makeTraceFrame({ stepId: "deploy", status: "done", label: "deploy ok" }),
  ];

  const rightFrames: WorkflowTraceFrame[] = [
    makeTraceFrame({ stepId: "build", status: "done", label: "build ok" }),
    makeTraceFrame({ stepId: "test", status: "failed", label: "tests failed" }),
    makeTraceFrame({ stepId: "deploy", status: "skipped", label: "deploy skipped" }),
  ];

  const report = service.buildComparisonReport("wf_release", leftFrames, rightFrames);

  assert.equal(report.workflowId, "wf_release");
  assert.ok(report.differences.length > 0, "Should detect differences");
  assert.ok(report.differences.some((d) => d.includes("test")), "Should mention test step difference");
});

test("integration: debugger renders trace timeline in order", () => {
  const service = new WorkflowDebuggerService();

  const frames: WorkflowTraceFrame[] = [
    makeTraceFrame({ stepId: "init", timestamp: "2026-04-20T00:00:00.000Z", label: "initialize" }),
    makeTraceFrame({ stepId: "fetch", timestamp: "2026-04-20T00:00:01.000Z", label: "fetch data" }),
    makeTraceFrame({ stepId: "process", timestamp: "2026-04-20T00:00:02.000Z", label: "process data" }),
    makeTraceFrame({ stepId: "save", timestamp: "2026-04-20T00:00:03.000Z", label: "save result" }),
  ];

  const timeline = service.renderTraceTimeline(frames);

  assert.equal(timeline.length, 4, "Should render all 4 frames");
  assert.ok(timeline[0]!.includes("initialize"), "First frame should be init");
  assert.ok(timeline[3]!.includes("save result"), "Last frame should be save");
});

test("integration: empty trace returns empty results", () => {
  const service = new WorkflowDebuggerService();

  service.registerBreakpoint(
    { actorId: "tester", allowedRuntime: "non_prod" },
    "dev",
    {
      breakpointId: "bp_empty",
      workflowId: "wf_empty",
      stepSelector: "start",
      condition: "always",
      action: "snapshot",
    },
  );

  const hits = service.evaluateTrace([]);
  assert.equal(hits.length, 0, "Empty trace should return no hits");

  const report = service.buildComparisonReport("wf_empty", [], []);
  assert.equal(report.differences.length, 0, "Empty comparison should have no differences");
  assert.deepEqual(report.leftFrames, []);
  assert.deepEqual(report.rightFrames, []);
});
