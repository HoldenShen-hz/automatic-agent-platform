import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkflowDebuggerService,
  WebSocketDebugStreamService,
  type DebugBreakpointDefinition,
  type WorkflowTraceFrame,
  type BreakpointHit,
  type RunComparisonReport,
} from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import { isBreakpointHit } from "../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";
import { compareWorkflowRuns, buildRunComparison, buildSideEffectDiff, hasSideEffectDifferences, type RunSnapshot, type SideEffectRecord } from "../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";
import { renderWorkflowTimeline, renderWorkflowTimelineMarkdown, type TimelineFrame } from "../../../src/ops-maturity/workflow-debugger/timeline-renderer/index.js";

test("workflow-debugger: register breakpoint in non-prod environment", () => {
  const service = new WorkflowDebuggerService();
  const breakpoint: DebugBreakpointDefinition = {
    breakpointId: "bp-001",
    planGraphId: "wf-001",
    nodeRunSelector: "step-1",
    condition: "cost > 10",
    action: "pause",
  };

  const registered = service.registerBreakpoint(
    { actorId: "dev-user", allowedRuntime: "non_prod" },
    "dev",
    breakpoint,
  );

  assert.strictEqual(registered.breakpointId, "bp-001");
  assert.strictEqual(registered.planGraphId, "wf-001");
});

test("workflow-debugger: register breakpoint in prod requires replay_sandbox", () => {
  const service = new WorkflowDebuggerService();
  const breakpoint: DebugBreakpointDefinition = {
    breakpointId: "bp-prod",
    planGraphId: "wf-prod",
    nodeRunSelector: "step-1",
    condition: "always",
    action: "snapshot",
  };

  assert.throws(
    () => service.registerBreakpoint(
      { actorId: "prod-user", allowedRuntime: "non_prod" },
      "prod",
      breakpoint,
    ),
    /workflow_debugger.prod_breakpoint_forbidden/,
  );
});

test("workflow-debugger: register breakpoint in prod with replay_sandbox allowed", () => {
  const service = new WorkflowDebuggerService();
  const breakpoint: DebugBreakpointDefinition = {
    breakpointId: "bp-prod-ok",
    planGraphId: "wf-prod-ok",
    nodeRunSelector: "step-1",
    condition: "always",
    action: "snapshot",
  };

  const registered = service.registerBreakpoint(
    { actorId: "sandbox-user", allowedRuntime: "replay_sandbox" },
    "prod",
    breakpoint,
  );

  assert.strictEqual(registered.breakpointId, "bp-prod-ok");
});

test("workflow-debugger: list breakpoints for plan graph", () => {
  const service = new WorkflowDebuggerService();
  service.registerBreakpoint(
    { actorId: "dev", allowedRuntime: "non_prod" },
    "dev",
    { breakpointId: "bp-1", planGraphId: "wf-001", nodeRunSelector: "step-1", condition: "", action: "pause" },
  );
  service.registerBreakpoint(
    { actorId: "dev", allowedRuntime: "non_prod" },
    "dev",
    { breakpointId: "bp-2", planGraphId: "wf-001", nodeRunSelector: "step-2", condition: "", action: "snapshot" },
  );

  const breakpoints = service.listBreakpoints("wf-001");

  assert.strictEqual(breakpoints.length, 2);
});

test("workflow-debugger: evaluate trace with no frames returns empty", () => {
  const service = new WorkflowDebuggerService();

  const hits = service.evaluateTrace([]);

  assert.strictEqual(hits.length, 0);
});

test("workflow-debugger: evaluate trace finds matching breakpoints", () => {
  const service = new WorkflowDebuggerService();
  service.registerBreakpoint(
    { actorId: "dev", allowedRuntime: "non_prod" },
    "dev",
    { breakpointId: "bp-hit", planGraphId: "wf-trace", nodeRunSelector: "step-target", condition: "", action: "pause" },
  );

  const frames: WorkflowTraceFrame[] = [
    {
      planGraphId: "wf-trace",
      nodeRunId: "step-other",
      status: "completed",
      timestamp: "2026-04-29T00:01:00Z",
      label: "Other step",
    },
    {
      planGraphId: "wf-trace",
      nodeRunId: "step-target",
      status: "running",
      timestamp: "2026-04-29T00:02:00Z",
      label: "Target step",
    },
  ];

  const hits = service.evaluateTrace(frames);

  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].breakpointId, "bp-hit");
  assert.strictEqual(hits[0].nodeRunId, "step-target");
});

test("workflow-debugger: build comparison report detects differences", () => {
  const service = new WorkflowDebuggerService();
  const leftFrames: WorkflowTraceFrame[] = [
    {
      planGraphId: "wf-compare",
      nodeRunId: "step-1",
      status: "completed",
      decision: "accept",
      cost: 5.0,
      durationMs: 100,
      timestamp: "2026-04-29T00:01:00Z",
      label: "Step 1",
    },
  ];
  const rightFrames: WorkflowTraceFrame[] = [
    {
      planGraphId: "wf-compare",
      nodeRunId: "step-1",
      status: "failed",
      decision: "retry",
      cost: 8.0,
      durationMs: 200,
      timestamp: "2026-04-29T00:01:30Z",
      label: "Step 1",
    },
  ];

  const report = service.buildComparisonReport("wf-compare", leftFrames, rightFrames);

  assert.strictEqual(report.regressionDetected, true);
  assert.ok(report.differences.length > 0);
  assert.ok(report.differences.some(d => d.includes("status:")));
  assert.ok(report.differences.some(d => d.includes("decision:")));
});

test("workflow-debugger: build comparison report with identical frames", () => {
  const service = new WorkflowDebuggerService();
  const frames: WorkflowTraceFrame[] = [
    {
      planGraphId: "wf-identical",
      nodeRunId: "step-1",
      status: "completed",
      timestamp: "2026-04-29T00:01:00Z",
      label: "Step 1",
    },
  ];

  const report = service.buildComparisonReport("wf-identical", frames, frames);

  assert.strictEqual(report.regressionDetected, false);
  assert.strictEqual(report.differences.length, 0);
});

test("workflow-debugger: render trace timeline", () => {
  const service = new WorkflowDebuggerService();
  const frames: WorkflowTraceFrame[] = [
    { planGraphId: "wf", nodeRunId: "s1", status: "queued", timestamp: "2026-04-29T00:01:00Z", label: "Start" },
    { planGraphId: "wf", nodeRunId: "s2", status: "running", timestamp: "2026-04-29T00:02:00Z", label: "Middle" },
    { planGraphId: "wf", nodeRunId: "s3", status: "completed", timestamp: "2026-04-29T00:03:00Z", label: "End" },
  ];

  const timeline = service.renderTraceTimeline(frames);

  assert.strictEqual(timeline.length, 3);
  assert.ok(timeline[0].includes("Start"));
  assert.ok(timeline[2].includes("End"));
});

test("breakpoint-manager: isBreakpointHit detects matching node", () => {
  const breakpoints = [
    { breakpointId: "bp-1", nodeRunId: "step-1" },
    { breakpointId: "bp-2", nodeRunId: "step-2" },
  ];

  assert.strictEqual(isBreakpointHit(breakpoints, "step-1"), true);
  assert.strictEqual(isBreakpointHit(breakpoints, "step-2"), true);
  assert.strictEqual(isBreakpointHit(breakpoints, "step-3"), false);
});

test("breakpoint-manager: isBreakpointHit falls back to stepId", () => {
  const breakpoints = [
    { breakpointId: "bp-1", stepId: "legacy-step-1" },
  ];

  assert.strictEqual(isBreakpointHit(breakpoints, "legacy-step-1"), true);
  assert.strictEqual(isBreakpointHit(breakpoints, "other-step"), false);
});

test("run-comparator: compareWorkflowRuns detects status change", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "s1", status: "completed" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "s1", status: "failed" },
  ];

  const diffs = compareWorkflowRuns(left, right);

  assert.ok(diffs.some(d => d.includes("status:")));
});

test("run-comparator: compareWorkflowRuns detects cost delta", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "s1", cost: 5.0 },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "s1", cost: 10.0 },
  ];

  const diffs = compareWorkflowRuns(left, right);

  assert.ok(diffs.some(d => d.includes("cost:")));
});

test("run-comparator: compareWorkflowRuns detects missing steps", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "s1" },
    { nodeRunId: "s2" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "s1" },
  ];

  const diffs = compareWorkflowRuns(left, right);

  assert.ok(diffs.some(d => d.includes("missing_in_right")));
});

test("run-comparator: buildRunComparison provides detailed diff", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "s1", status: "completed", decision: "accept", cost: 5, durationMs: 100 },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "s1", status: "failed", decision: "retry", cost: 8, durationMs: 150 },
  ];

  const comparison = buildRunComparison(left, right);

  assert.strictEqual(comparison.length, 1);
  assert.strictEqual(comparison[0].statusChanged, true);
  assert.strictEqual(comparison[0].leftStatus, "completed");
  assert.strictEqual(comparison[0].rightStatus, "failed");
  assert.strictEqual(comparison[0].decisionChanged, true);
  assert.strictEqual(comparison[0].costDelta, 3);
  assert.strictEqual(comparison[0].durationDeltaMs, 50);
});

test("run-comparator: buildSideEffectDiff detects added effects", () => {
  const expected: RunSnapshot[] = [
    {
      nodeRunId: "s1",
      sideEffects: [
        { effectId: "e1", effectType: "file_write", targetResource: "/tmp/out.txt", outcome: "created", timestamp: "2026-04-29T00:00:00Z" },
      ],
    },
  ];
  const actual: RunSnapshot[] = [
    {
      nodeRunId: "s1",
      sideEffects: [
        { effectId: "e1", effectType: "file_write", targetResource: "/tmp/out.txt", outcome: "created", timestamp: "2026-04-29T00:00:00Z" },
        { effectId: "e2", effectType: "api_call", targetResource: "https://api.example.com", outcome: "accessed", timestamp: "2026-04-29T00:00:01Z" },
      ],
    },
  ];

  const diffs = buildSideEffectDiff(expected, actual);

  assert.strictEqual(diffs[0].addedEffects.length, 1);
  assert.strictEqual(diffs[0].addedEffects[0].effectId, "e2");
});

test("run-comparator: buildSideEffectDiff detects missing effects", () => {
  const expected: RunSnapshot[] = [
    {
      nodeRunId: "s1",
      sideEffects: [
        { effectId: "e1", effectType: "file_write", targetResource: "/tmp/out.txt", outcome: "created", timestamp: "2026-04-29T00:00:00Z" },
        { effectId: "e2", effectType: "cleanup", targetResource: "/tmp/temp", outcome: "deleted", timestamp: "2026-04-29T00:00:02Z" },
      ],
    },
  ];
  const actual: RunSnapshot[] = [
    {
      nodeRunId: "s1",
      sideEffects: [
        { effectId: "e1", effectType: "file_write", targetResource: "/tmp/out.txt", outcome: "created", timestamp: "2026-04-29T00:00:00Z" },
      ],
    },
  ];

  const diffs = buildSideEffectDiff(expected, actual);

  assert.strictEqual(diffs[0].missingEffects.length, 1);
  assert.strictEqual(diffs[0].missingEffects[0].effectId, "e2");
});

test("run-comparator: buildSideEffectDiff detects modified effects", () => {
  const expected: RunSnapshot[] = [
    {
      nodeRunId: "s1",
      sideEffects: [
        { effectId: "e1", effectType: "file_write", targetResource: "/tmp/out.txt", outcome: "created", timestamp: "2026-04-29T00:00:00Z" },
      ],
    },
  ];
  const actual: RunSnapshot[] = [
    {
      nodeRunId: "s1",
      sideEffects: [
        { effectId: "e1", effectType: "file_write", targetResource: "/tmp/different.txt", outcome: "created", timestamp: "2026-04-29T00:00:00Z" },
      ],
    },
  ];

  const diffs = buildSideEffectDiff(expected, actual);

  assert.strictEqual(diffs[0].modifiedEffects.length, 1);
  assert.strictEqual(diffs[0].modifiedEffects[0].effectId, "e1");
});

test("run-comparator: hasSideEffectDifferences returns true when diffs exist", () => {
  const diff = {
    nodeRunId: "s1",
    expectedEffects: [] as readonly SideEffectRecord[],
    actualEffects: [{ effectId: "e1", effectType: "api", targetResource: "url", outcome: "accessed" as const, timestamp: "2026-04-29T00:00:00Z" }],
    addedEffects: [{ effectId: "e1", effectType: "api", targetResource: "url", outcome: "accessed" as const, timestamp: "2026-04-29T00:00:00Z" }],
    missingEffects: [],
    modifiedEffects: [],
    diffSummary: "+1 added",
  };

  assert.strictEqual(hasSideEffectDifferences(diff), true);
});

test("run-comparator: hasSideEffectDifferences returns false for identical", () => {
  const diff = {
    nodeRunId: "s1",
    expectedEffects: [] as readonly SideEffectRecord[],
    actualEffects: [] as readonly SideEffectRecord[],
    addedEffects: [],
    missingEffects: [],
    modifiedEffects: [],
    diffSummary: "side_effects:identical",
  };

  assert.strictEqual(hasSideEffectDifferences(diff), false);
});

test("timeline-renderer: renderWorkflowTimeline formats frames", () => {
  const frames: TimelineFrame[] = [
    { timestamp: "2026-04-29T00:01:00Z", label: "Start", status: "queued" },
    { timestamp: "2026-04-29T00:02:00Z", label: "Process", status: "running", durationMs: 500 },
    { timestamp: "2026-04-29T00:03:00Z", label: "End", status: "completed" },
  ];

  const lines = renderWorkflowTimeline(frames);

  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].includes("Start"));
  assert.ok(lines[0].includes("[queued]"));
  assert.ok(lines[1].includes("(500ms)"));
});

test("timeline-renderer: renderWorkflowTimelineMarkdown creates markdown", () => {
  const frames: TimelineFrame[] = [
    { timestamp: "2026-04-29T00:01:00Z", label: "Step 1", status: "completed" },
  ];

  const markdown = renderWorkflowTimelineMarkdown("Test Workflow", frames);

  assert.ok(markdown.startsWith("# Test Workflow"));
  assert.ok(markdown.includes("- 2026-04-29T00:01:00Z Step 1"));
});

test("websocket-debug-stream: subscribe creates subscription", () => {
  const service = new WebSocketDebugStreamService();

  const sub = service.subscribe("wf-001", "user-001");

  assert.strictEqual(sub.workflowId, "wf-001");
  assert.strictEqual(sub.actorId, "user-001");
  assert.ok(sub.subscribedAt.length > 0);
});

test("websocket-debug-stream: unsubscribe removes subscription", () => {
  const service = new WebSocketDebugStreamService();
  service.subscribe("wf-001", "user-001");

  const removed = service.unsubscribe("wf-001", "user-001");

  assert.strictEqual(removed, true);
  assert.strictEqual(service.getSubscriptions("wf-001").length, 0);
});

test("websocket-debug-stream: addListener and broadcast", () => {
  const service = new WebSocketDebugStreamService();
  let received: unknown = null;

  service.addListener("wf-001", (msg) => {
    received = msg;
  });

  service.broadcast("wf-001", {
    type: "breakpoint_hit",
    planGraphId: "wf-001",
    timestamp: "2026-04-29T00:00:00Z",
    payload: { breakpointId: "bp-1" },
  });

  assert.ok(received !== null);
});

test("websocket-debug-stream: notifyBreakpointHit sends correct message", () => {
  const service = new WebSocketDebugStreamService();
  let lastMessage: unknown = null;

  service.addListener("wf-001", (msg) => {
    lastMessage = msg;
  });

  service.notifyBreakpointHit("wf-001", "wf-001", {
    breakpointId: "bp-1",
    planGraphId: "wf-001",
    nodeRunId: "step-1",
    action: "pause",
    timestamp: "2026-04-29T00:00:00Z",
  });

  const msg = lastMessage as { type: string; payload: { breakpointId: string } };
  assert.strictEqual(msg.type, "breakpoint_hit");
  assert.strictEqual(msg.payload.breakpointId, "bp-1");
});

test("websocket-debug-stream: getSubscriptions returns all subscribers", () => {
  const service = new WebSocketDebugStreamService();
  service.subscribe("wf-001", "user-1");
  service.subscribe("wf-001", "user-2");

  const subs = service.getSubscriptions("wf-001");

  assert.strictEqual(subs.length, 2);
});
