import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowDebuggerService } from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";

test("integration: runtime trace flows through breakpoint evaluation and replay comparison", () => {
  const service = new WorkflowDebuggerService();
  service.registerBreakpoint(
    {
      actorId: "sre_1",
      canDebugProduction: true,
    },
    "prod",
    {
      breakpointId: "bp_release_deploy",
      workflowId: "wf_release",
      stepSelector: "deploy",
      condition: "always",
      action: "compare",
    },
  );

  const leftFrames = [
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
  const rightFrames = [
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
  ];

  assert.equal(service.evaluateTrace(leftFrames).length, 1);
  const report = service.buildComparisonReport("wf_release", leftFrames, rightFrames);
  assert.deepEqual(report.differences, ["step:deploy:paused->failed"]);
  assert.deepEqual(service.renderTraceTimeline(leftFrames), [
    "2026-04-20T00:00:00.000Z build done",
    "2026-04-20T00:01:00.000Z deploy paused",
  ]);
});
