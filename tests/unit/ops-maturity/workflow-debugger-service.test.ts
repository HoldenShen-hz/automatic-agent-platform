import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowDebuggerService } from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";

test("WorkflowDebuggerService blocks unauthorized production breakpoints", () => {
  const service = new WorkflowDebuggerService();

  assert.throws(() => {
    service.registerBreakpoint(
      {
        actorId: "viewer_1",
        canDebugProduction: false,
      },
      "prod",
      {
        breakpointId: "bp_prod_1",
        workflowId: "wf_release",
        stepSelector: "deploy",
        condition: "always",
        action: "pause",
      },
    );
  }, /workflow_debugger\.prod_breakpoint_forbidden/);
});

test("WorkflowDebuggerService evaluates trace hits and compares replayable snapshots", () => {
  const service = new WorkflowDebuggerService();
  service.registerBreakpoint(
    {
      actorId: "sre_1",
      canDebugProduction: true,
    },
    "prod",
    {
      breakpointId: "bp_prod_2",
      workflowId: "wf_release",
      stepSelector: "deploy",
      condition: "always",
      action: "snapshot",
    },
  );

  const frames = [
    {
      workflowId: "wf_release",
      stepId: "build",
      status: "done",
      timestamp: "2026-04-20T00:00:00.000Z",
      label: "build done",
    },
    {
      workflowId: "wf_release",
      stepId: "deploy",
      status: "paused",
      timestamp: "2026-04-20T00:01:00.000Z",
      label: "deploy paused",
    },
  ];

  const hits = service.evaluateTrace(frames);
  assert.deepEqual(hits.map((item) => item.breakpointId), ["bp_prod_2"]);
  assert.deepEqual(service.renderTraceTimeline(frames), [
    "2026-04-20T00:00:00.000Z build done",
    "2026-04-20T00:01:00.000Z deploy paused",
  ]);

  const report = service.buildComparisonReport(
    "wf_release",
    frames,
    [
      {
        workflowId: "wf_release",
        stepId: "build",
        status: "done",
        timestamp: "2026-04-20T00:00:00.000Z",
        label: "build done",
      },
      {
        workflowId: "wf_release",
        stepId: "deploy",
        status: "failed",
        timestamp: "2026-04-20T00:01:30.000Z",
        label: "deploy failed",
      },
    ],
  );
  assert.deepEqual(report.differences, ["step:deploy:paused->failed"]);
});
