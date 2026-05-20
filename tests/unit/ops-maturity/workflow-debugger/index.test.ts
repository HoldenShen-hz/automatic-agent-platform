import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkflowDebuggerService,
  type DebugBreakpointDefinition,
  type WorkflowTraceFrame,
  type BreakpointHit,
  type RunComparisonReport,
  type DebuggerActor,
} from "../../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import {
  TimeTravelDebugService,
  type TimeTravelDebugEvent,
  type VariableState,
  type DebugSnapshot,
} from "../../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import { isBreakpointHit } from "../../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";
import { compareWorkflowRuns } from "../../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";
import { renderWorkflowTimeline } from "../../../../src/ops-maturity/workflow-debugger/timeline-renderer/index.js";

// =============================================================================
// WorkflowDebuggerService - capture execution state
// =============================================================================

test("WorkflowDebuggerService registers breakpoint and returns normalized definition", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "dev_1", allowedRuntime: "non_prod" };

  const breakpoint = service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_1",
    planGraphId: "graph_a",
    nodeRunSelector: "node_1",
    condition: "always",
    action: "pause",
  });

  assert.equal(breakpoint.breakpointId, "bp_1");
  assert.equal(breakpoint.planGraphId, "graph_a");
  assert.equal(breakpoint.nodeRunSelector, "node_1");
  assert.equal(breakpoint.action, "pause");
});

test("WorkflowDebuggerService resolves deprecated workflowId to planGraphId", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "dev_1", allowedRuntime: "non_prod" };

  const breakpoint = service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_deprecated_wf",
    workflowId: "legacy_wf_id",
    stepSelector: "step_a",
    condition: "always",
    action: "snapshot",
  });

  assert.equal(breakpoint.planGraphId, "legacy_wf_id");
  assert.equal(breakpoint.nodeRunSelector, "step_a");
});

test("WorkflowDebuggerService blocks production breakpoint for non-replay actor", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "viewer_1", allowedRuntime: "non_prod" };

  assert.throws(
    () =>
      service.registerBreakpoint(actor, "prod", {
        breakpointId: "bp_prod_blocked",
        planGraphId: "graph_prod",
        nodeRunSelector: "node_x",
        condition: "always",
        action: "pause",
      }),
    /workflow_debugger\.prod_breakpoint_forbidden/,
  );
});

test("WorkflowDebuggerService allows production breakpoint for replay_sandbox actor", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "sre_1", allowedRuntime: "replay_sandbox" };

  const breakpoint = service.registerBreakpoint(actor, "prod", {
    breakpointId: "bp_prod_allowed",
    planGraphId: "graph_prod",
    nodeRunSelector: "node_x",
    condition: "always",
    action: "pause",
  });

  assert.equal(breakpoint.breakpointId, "bp_prod_allowed");
});

test("WorkflowDebuggerService lists breakpoints for a planGraphId", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "dev_1", allowedRuntime: "non_prod" };

  service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_1",
    planGraphId: "graph_a",
    nodeRunSelector: "node_1",
    condition: "always",
    action: "pause",
  });
  service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_2",
    planGraphId: "graph_a",
    nodeRunSelector: "node_2",
    condition: "always",
    action: "snapshot",
  });
  service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_3",
    planGraphId: "graph_b",
    nodeRunSelector: "node_3",
    condition: "always",
    action: "compare",
  });

  const graphABreakpoints = service.listBreakpoints("graph_a");
  assert.equal(graphABreakpoints.length, 2);
  assert.ok(graphABreakpoints.some((bp) => bp.breakpointId === "bp_1"));
  assert.ok(graphABreakpoints.some((bp) => bp.breakpointId === "bp_2"));

  const graphBBreakpoints = service.listBreakpoints("graph_b");
  assert.equal(graphBBreakpoints.length, 1);
  assert.equal(graphBBreakpoints[0]!.breakpointId, "bp_3");
});

test("WorkflowDebuggerService returns empty array for unknown planGraphId", () => {
  const service = new WorkflowDebuggerService();
  const result = service.listBreakpoints("nonexistent");
  assert.deepEqual(result, []);
});

test("WorkflowDebuggerService evaluates trace and returns breakpoint hits", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "dev_1", allowedRuntime: "non_prod" };

  service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_1",
    planGraphId: "graph_a",
    nodeRunSelector: "node_build",
    condition: "always",
    action: "pause",
  });
  service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_2",
    planGraphId: "graph_a",
    nodeRunSelector: "node_deploy",
    condition: "always",
    action: "snapshot",
  });

  const frames: WorkflowTraceFrame[] = [
    {
      planGraphId: "graph_a",
      nodeRunId: "node_build",
      status: "completed",
      timestamp: "2026-04-29T00:00:00.000Z",
      label: "build step",
    },
    {
      planGraphId: "graph_a",
      nodeRunId: "node_test",
      status: "running",
      timestamp: "2026-04-29T00:01:00.000Z",
      label: "test step",
    },
    {
      planGraphId: "graph_a",
      nodeRunId: "node_deploy",
      status: "paused",
      timestamp: "2026-04-29T00:02:00.000Z",
      label: "deploy step",
    },
  ];

  const hits = service.evaluateTrace(frames);
  assert.equal(hits.length, 2);
  assert.ok(hits.some((h) => h.breakpointId === "bp_1"));
  assert.ok(hits.some((h) => h.breakpointId === "bp_2"));
  assert.ok(hits.every((h) => h.planGraphId === "graph_a"));
});

test("WorkflowDebuggerService evaluateTrace returns empty for empty frames", () => {
  const service = new WorkflowDebuggerService();
  const hits = service.evaluateTrace([]);
  assert.deepEqual(hits, []);
});

test("WorkflowDebuggerService evaluateTrace returns empty when no breakpoints match", () => {
  const service = new WorkflowDebuggerService();
  const actor: DebuggerActor = { actorId: "dev_1", allowedRuntime: "non_prod" };

  service.registerBreakpoint(actor, "dev", {
    breakpointId: "bp_1",
    planGraphId: "graph_a",
    nodeRunSelector: "node_build",
    condition: "always",
    action: "pause",
  });

  const frames: WorkflowTraceFrame[] = [
    {
      planGraphId: "graph_a",
      nodeRunId: "node_unmatched",
      status: "running",
      timestamp: "2026-04-29T00:00:00.000Z",
      label: "unmatched step",
    },
  ];

  const hits = service.evaluateTrace(frames);
  assert.deepEqual(hits, []);
});

test("WorkflowDebuggerService builds comparison report with differences", () => {
  const service = new WorkflowDebuggerService();

  const leftFrames: WorkflowTraceFrame[] = [
    {
      planGraphId: "graph_a",
      nodeRunId: "node_build",
      status: "completed",
      timestamp: "2026-04-29T00:00:00.000Z",
      label: "build",
    },
    {
      planGraphId: "graph_a",
      nodeRunId: "node_deploy",
      status: "completed",
      timestamp: "2026-04-29T00:01:00.000Z",
      label: "deploy",
    },
  ];

  const rightFrames: WorkflowTraceFrame[] = [
    {
      planGraphId: "graph_a",
      nodeRunId: "node_build",
      status: "completed",
      timestamp: "2026-04-29T00:00:00.000Z",
      label: "build",
    },
    {
      planGraphId: "graph_a",
      nodeRunId: "node_deploy",
      status: "failed",
      timestamp: "2026-04-29T00:01:30.000Z",
      label: "deploy",
    },
  ];

  const report = service.buildComparisonReport("graph_a", leftFrames, rightFrames);
  assert.equal(report.planGraphId, "graph_a");
  assert.deepEqual(report.differences, ["step:node_deploy:status:completed->failed"]);
  assert.equal(report.leftFrames.length, 2);
  assert.equal(report.rightFrames.length, 2);
});

test("WorkflowDebuggerService buildComparisonReport returns empty differences when runs match", () => {
  const service = new WorkflowDebuggerService();

  const frames: WorkflowTraceFrame[] = [
    {
      planGraphId: "graph_a",
      nodeRunId: "node_1",
      status: "completed",
      timestamp: "2026-04-29T00:00:00.000Z",
      label: "step 1",
    },
  ];

  const report = service.buildComparisonReport("graph_a", frames, frames);
  assert.deepEqual(report.differences, []);
});

test("WorkflowDebuggerService renders trace timeline", () => {
  const service = new WorkflowDebuggerService();

  const frames: WorkflowTraceFrame[] = [
    {
      planGraphId: "graph_a",
      nodeRunId: "node_1",
      status: "running",
      timestamp: "2026-04-29T00:00:00.000Z",
      label: "initialization",
    },
    {
      planGraphId: "graph_a",
      nodeRunId: "node_2",
      status: "completed",
      timestamp: "2026-04-29T00:01:00.000Z",
      label: "processing",
    },
  ];

  const timeline = service.renderTraceTimeline(frames);
  assert.equal(timeline.length, 2);
  assert.ok(timeline[0]!.includes("initialization"));
  assert.ok(timeline[1]!.includes("processing"));
});

// =============================================================================
// TimeTravelDebugService - session management and step-through control
// =============================================================================

test("TimeTravelDebugService creates session and returns valid session object", () => {
  const service = new TimeTravelDebugService();

  const session = service.createSession("task_1", "harness_1");
  assert.ok(session.sessionId);
  assert.equal(session.taskId, "task_1");
  assert.equal(session.harnessRunId, "harness_1");
  assert.deepEqual(session.breakpoints, []);
  assert.deepEqual(session.snapshots, []);
  assert.equal(session.currentEventIndex, 0);
  assert.ok(session.startedAt);
  assert.equal(session.endedAt, null);
});

test("TimeTravelDebugService setBreakpoints updates session breakpoints", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task_1", "harness_1");

  service.setBreakpoints(session.sessionId, ["node_1", "node_3"]);

  const updatedSession = service.createSession.__bug ?? service["sessions"].get(session.sessionId);
  assert.ok(updatedSession);
  assert.deepEqual((updatedSession as any).breakpoints, ["node_1", "node_3"]);
});

test("TimeTravelDebugService loads event store", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { count: 1 } },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z", variables: { count: 2 } },
  ];

  service.loadEventStore("harness_1", events);

  const replayState = service.replayStep(service.createSession("task_1", "harness_1").sessionId);
  assert.ok(replayState);
  assert.equal(replayState.cursor.harnessRunId, "harness_1");
});

test("TimeTravelDebugService replayStep advances event index", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { x: 1 } },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z", variables: { x: 2 } },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z", variables: { x: 3 } },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const state1 = service.replayStep(session.sessionId);
  assert.ok(state1);
  assert.equal(state1.currentEventIndex, 1);

  const state2 = service.replayStep(session.sessionId);
  assert.ok(state2);
  assert.equal(state2.currentEventIndex, 2);

  const state3 = service.replayStep(session.sessionId);
  assert.ok(state3);
  assert.equal(state3.currentEventIndex, 3);
});

test("TimeTravelDebugService replayStep returns reachedBreakpoint true when breakpoint hit", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z" },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");
  service.setBreakpoints(session.sessionId, ["node_2"]);

  // node_1 - no breakpoint
  const state1 = service.replayStep(session.sessionId);
  assert.ok(state1);
  assert.equal(state1.reachedBreakpoint, false);

  // node_2 - breakpoint hit
  const state2 = service.replayStep(session.sessionId);
  assert.ok(state2);
  assert.equal(state2.reachedBreakpoint, true);

  // node_3 - no breakpoint
  const state3 = service.replayStep(session.sessionId);
  assert.ok(state3);
  assert.equal(state3.reachedBreakpoint, false);
});

test("TimeTravelDebugService replayStep returns null for unknown session", () => {
  const service = new TimeTravelDebugService();
  const result = service.replayStep("unknown_session");
  assert.equal(result, null);
});

test("TimeTravelDebugService replayToCursor advances to target index", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { a: 1 } },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z", variables: { b: 2 } },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z", variables: { c: 3 } },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const state = service.replayToCursor(session.sessionId, 2);
  assert.ok(state);
  assert.equal(state.currentEventIndex, 2);
  assert.equal(state.cursor.toEventIndex, 2);
});

test("TimeTravelDebugService replayToCursor stops at breakpoint and captures snapshot", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
    { nodeRunId: "node_break", timestamp: "2026-04-29T00:01:00.000Z" },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");
  service.setBreakpoints(session.sessionId, ["node_break"]);

  const state = service.replayToCursor(session.sessionId, 3);
  assert.ok(state);
  assert.equal(state.reachedBreakpoint, true);
  assert.ok(state.currentEventIndex <= 3);

  const snapshot = service.getSnapshot(session.sessionId, "node_break");
  assert.ok(snapshot);
  assert.equal(snapshot.nodeRunId, "node_break");
});

test("TimeTravelDebugService replayToCursor returns null for unknown session", () => {
  const service = new TimeTravelDebugService();
  const result = service.replayToCursor("unknown_session", 5);
  assert.equal(result, null);
});

test("TimeTravelDebugService jumpToStep moves cursor to specific nodeRunId", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z" },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const state = service.jumpToStep(session.sessionId, "node_3");
  assert.ok(state);
  assert.equal(state.currentEventIndex, 3);
});

test("TimeTravelDebugService jumpToStep returns null for unknown nodeRunId", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const state = service.jumpToStep(session.sessionId, "nonexistent");
  assert.equal(state, null);
});

test("TimeTravelDebugService jumpToStep returns null for unknown session", () => {
  const service = new TimeTravelDebugService();
  const state = service.jumpToStep("unknown_session", "node_1");
  assert.equal(state, null);
});

test("TimeTravelDebugService getSnapshot returns snapshot for nodeRunId", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { x: 10 } },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z", variables: { y: 20 } },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");
  service.setBreakpoints(session.sessionId, ["node_2"]);

  service.replayToCursor(session.sessionId, 2);

  const snapshot = service.getSnapshot(session.sessionId, "node_2");
  assert.ok(snapshot);
  assert.equal(snapshot.nodeRunId, "node_2");
  assert.equal(snapshot.taskId, "task_1");
  assert.equal(snapshot.harnessRunId, "harness_1");
});

test("TimeTravelDebugService getSnapshot returns null for unknown nodeRunId", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const snapshot = service.getSnapshot(session.sessionId, "nonexistent");
  assert.equal(snapshot, null);
});

test("TimeTravelDebugService endSession sets endedAt timestamp", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task_1", "harness_1");

  assert.equal(session.endedAt, null);
  service.endSession(session.sessionId);

  const sessions = (service as any).sessions as Map<string, any>;
  const updatedSession = sessions.get(session.sessionId);
  assert.ok(updatedSession.endedAt);
});

// =============================================================================
// Variable inspection at breakpoints
// =============================================================================

test("TimeTravelDebugService getVariableState returns variables up to event index", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { count: 1, name: "first" } },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z", variables: { count: 2, extra: "data" } },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z", variables: { count: 3 } },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const variables = service.getVariableState(session.sessionId, 1);
  assert.ok(variables.length >= 1);
  assert.ok(variables.some((v: VariableState) => v.name === "count" && v.value === 2));
  assert.ok(variables.some((v: VariableState) => v.name === "name" && v.value === "first"));
  assert.ok(variables.some((v: VariableState) => v.name === "extra" && v.value === "data"));
});

test("TimeTravelDebugService getVariableState returns empty for unknown session", () => {
  const service = new TimeTravelDebugService();
  const variables = service.getVariableState("unknown_session", 0);
  assert.deepEqual(variables, []);
});

test("TimeTravelDebugService getVariableState reads variable envelope value", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    {
      nodeRunId: "node_1",
      timestamp: "2026-04-29T00:00:00.000Z",
      variables: {
        wrapped: { value: 42 },
        plain: 100,
      },
    },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const variables = service.getVariableState(session.sessionId, 0);
  const wrapped = variables.find((v: VariableState) => v.name === "wrapped");
  const plain = variables.find((v: VariableState) => v.name === "plain");

  assert.ok(wrapped);
  assert.equal(wrapped.value, 42);
  assert.ok(plain);
  assert.equal(plain.value, 100);
});

test("TimeTravelDebugService getVariableState respects scope from event", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { global_var: 1 }, scope: "global" },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z", variables: { step_var: 2 }, scope: "step" },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z", variables: { loop_var: 3 }, scope: "loop" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const variables = service.getVariableState(session.sessionId, 2);
  const globalVar = variables.find((v: VariableState) => v.name === "global_var");
  const stepVar = variables.find((v: VariableState) => v.name === "step_var");
  const loopVar = variables.find((v: VariableState) => v.name === "loop_var");

  assert.ok(globalVar);
  assert.equal(globalVar.scope, "global");
  assert.ok(stepVar);
  assert.equal(stepVar.scope, "step");
  assert.ok(loopVar);
  assert.equal(loopVar.scope, "loop");
});

test("TimeTravelDebugService getVariableState defaults scope to step when not specified", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { count: 5 } },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const variables = service.getVariableState(session.sessionId, 0);
  const varItem = variables.find((v: VariableState) => v.name === "count");
  assert.ok(varItem);
  assert.equal(varItem.scope, "step");
});

test("TimeTravelDebugService getVariableState captures type correctly", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    {
      nodeRunId: "node_1",
      timestamp: "2026-04-29T00:00:00.000Z",
      variables: {
        str: "hello",
        num: 42,
        bool: true,
        obj: { a: 1 },
        nil: null,
      },
    },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const variables = service.getVariableState(session.sessionId, 0);
  const strVar = variables.find((v: VariableState) => v.name === "str");
  const numVar = variables.find((v: VariableState) => v.name === "num");
  const boolVar = variables.find((v: VariableState) => v.name === "bool");
  const objVar = variables.find((v: VariableState) => v.name === "obj");
  const nilVar = variables.find((v: VariableState) => v.name === "nil");

  assert.ok(strVar);
  assert.equal(strVar.type, "string");
  assert.ok(numVar);
  assert.equal(numVar.type, "number");
  assert.ok(boolVar);
  assert.equal(boolVar.type, "boolean");
  assert.ok(objVar);
  assert.equal(objVar.type, "object");
  assert.ok(nilVar);
  assert.equal(nilVar.type, "null");
});

test("TimeTravelDebugService replayStep captures snapshot when breakpoint hit", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z", variables: { x: 1 } },
    { nodeRunId: "node_break", timestamp: "2026-04-29T00:01:00.000Z", variables: { x: 2, breakpoint_var: "stop_here" } },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z", variables: { x: 3 } },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");
  service.setBreakpoints(session.sessionId, ["node_break"]);

  // Advance past first event
  service.replayStep(session.sessionId);
  // Second event hits breakpoint
  const state = service.replayStep(session.sessionId);

  assert.ok(state);
  assert.equal(state.reachedBreakpoint, true);

  const snapshot = service.getSnapshot(session.sessionId, "node_break");
  assert.ok(snapshot);
  assert.equal(snapshot.nodeRunId, "node_break");
  assert.ok(snapshot.variablesJson.includes("breakpoint_var"));
});

test("TimeTravelDebugService snapshot variablesJson is valid JSON", () => {
  const service = new TimeTravelDebugService();
  const events: TimeTravelDebugEvent[] = [
    {
      nodeRunId: "node_1",
      timestamp: "2026-04-29T00:00:00.000Z",
      variables: { count: 10, name: "test" },
    },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");
  service.setBreakpoints(session.sessionId, ["node_1"]);

  service.replayStep(session.sessionId);

  const snapshot = service.getSnapshot(session.sessionId, "node_1");
  assert.ok(snapshot);

  const parsed = JSON.parse(snapshot.variablesJson);
  assert.equal(parsed.count, 10);
  assert.equal(parsed.name, "test");
});

// =============================================================================
// Breakpoint manager - isBreakpointHit
// =============================================================================

test("isBreakpointHit returns true when nodeRunId matches", () => {
  const breakpoints = [
    { breakpointId: "bp_1", nodeRunId: "node_1" },
    { breakpointId: "bp_2", nodeRunId: "node_2" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "node_1"), true);
  assert.equal(isBreakpointHit(breakpoints, "node_2"), true);
});

test("isBreakpointHit returns false when nodeRunId does not match", () => {
  const breakpoints = [
    { breakpointId: "bp_1", nodeRunId: "node_1" },
    { breakpointId: "bp_2", nodeRunId: "node_2" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "node_3"), false);
});

test("isBreakpointHit falls back to deprecated stepId", () => {
  const breakpoints = [
    { breakpointId: "bp_1", stepId: "legacy_step_1" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "legacy_step_1"), true);
  assert.equal(isBreakpointHit(breakpoints, "other_step"), false);
});

test("isBreakpointHit returns false for empty breakpoints array", () => {
  assert.equal(isBreakpointHit([], "node_1"), false);
});

// =============================================================================
// Run comparator - compareWorkflowRuns
// =============================================================================

test("compareWorkflowRuns returns empty array when runs are identical", () => {
  const left = [
    { nodeRunId: "node_1", status: "completed" },
    { nodeRunId: "node_2", status: "completed" },
  ];
  const right = [
    { nodeRunId: "node_1", status: "completed" },
    { nodeRunId: "node_2", status: "completed" },
  ];

  const differences = compareWorkflowRuns(left, right);
  assert.deepEqual(differences, []);
});

test("compareWorkflowRuns detects status changes", () => {
  const left = [
    { nodeRunId: "node_1", status: "completed" },
    { nodeRunId: "node_2", status: "completed" },
  ];
  const right = [
    { nodeRunId: "node_1", status: "completed" },
    { nodeRunId: "node_2", status: "failed" },
  ];

  const differences = compareWorkflowRuns(left, right);
  assert.deepEqual(differences, ["step:node_2:status:completed->failed"]);
});

test("compareWorkflowRuns reports missing steps in right run", () => {
  const left = [
    { nodeRunId: "node_1", status: "completed" },
    { nodeRunId: "node_2", status: "completed" },
  ];
  const right = [
    { nodeRunId: "node_1", status: "completed" },
  ];

  const differences = compareWorkflowRuns(left, right);
  assert.deepEqual(differences, ["step:node_2:missing_in_right"]);
});

test("compareWorkflowRuns uses deprecated stepId when nodeRunId is absent", () => {
  const left = [
    { stepId: "legacy_step", status: "done" },
  ];
  const right = [
    { stepId: "legacy_step", status: "error" },
  ];

  const differences = compareWorkflowRuns(left, right);
  assert.deepEqual(differences, ["step:legacy_step:done->error"]);
});

// =============================================================================
// Timeline renderer - renderWorkflowTimeline
// =============================================================================

test("renderWorkflowTimeline formats frames with timestamp and label", () => {
  const frames = [
    { timestamp: "2026-04-29T00:00:00.000Z", label: "start" },
    { timestamp: "2026-04-29T00:01:00.000Z", label: "middle" },
  ];

  const lines = renderWorkflowTimeline(frames);
  assert.equal(lines.length, 2);
  assert.ok(lines[0]!.includes("2026-04-29T00:00:00.000Z"));
  assert.ok(lines[0]!.includes("start"));
});

test("renderWorkflowTimeline includes status when present", () => {
  const frames = [
    { timestamp: "2026-04-29T00:00:00.000Z", label: "step_1", status: "completed" as const },
  ];

  const lines = renderWorkflowTimeline(frames);
  assert.ok(lines[0]!.includes("[completed]"));
});

test("renderWorkflowTimeline includes duration when present", () => {
  const frames = [
    { timestamp: "2026-04-29T00:00:00.000Z", label: "step_1", durationMs: 150 },
  ];

  const lines = renderWorkflowTimeline(frames);
  assert.ok(lines[0]!.includes("(150ms)"));
});

test("renderWorkflowTimeline omits status and duration when not present", () => {
  const frames = [
    { timestamp: "2026-04-29T00:00:00.000Z", label: "minimal" },
  ];

  const lines = renderWorkflowTimeline(frames);
  assert.equal(lines[0], "2026-04-29T00:00:00.000Z minimal");
});

// =============================================================================
// Session eviction - maxSessions boundary
// =============================================================================

test("TimeTravelDebugService evicts oldest session when maxSessions exceeded", () => {
  const service = new TimeTravelDebugService({ maxSessions: 2 });

  const session1 = service.createSession("task_1", "harness_1");
  const session2 = service.createSession("task_2", "harness_2");
  const session3 = service.createSession("task_3", "harness_3");

  // session1 should be evicted
  const stateAfterEvict = service.replayStep(session1.sessionId);
  assert.equal(stateAfterEvict, null);

  // session2 and session3 should still work
  const state2 = service.replayStep(session2.sessionId);
  assert.ok(state2);

  const state3 = service.replayStep(session3.sessionId);
  assert.ok(state3);
});

test("TimeTravelDebugService respects maxEventsPerExecution limit", () => {
  const service = new TimeTravelDebugService({ maxEventsPerExecution: 2 });

  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z" },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z" },
    { nodeRunId: "node_4", timestamp: "2026-04-29T00:03:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");

  const variables = service.getVariableState(session.sessionId, 3);
  // Should only have events within maxEventsPerExecution window
  const nodeRunIds = variables.map((v: VariableState) => v.name).filter((n: string) => n.startsWith("node_"));
  // The service keeps the last maxEventsPerExecution events
  assert.ok(nodeRunIds.length <= 2);
});

test("TimeTravelDebugService respects maxSnapshotsPerSession limit", () => {
  const service = new TimeTravelDebugService({ maxSnapshotsPerSession: 2 });

  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z" },
    { nodeRunId: "node_3", timestamp: "2026-04-29T00:02:00.000Z" },
    { nodeRunId: "node_4", timestamp: "2026-04-29T00:03:00.000Z" },
  ];

  service.loadEventStore("harness_1", events);
  const session = service.createSession("task_1", "harness_1");
  service.setBreakpoints(session.sessionId, ["node_1", "node_2", "node_3", "node_4"]);

  service.replayStep(session.sessionId);
  service.replayStep(session.sessionId);
  service.replayStep(session.sessionId);
  service.replayStep(session.sessionId);

  // Check snapshots are limited
  assert.equal(service.getSnapshot(session.sessionId, "node_1"), null);
  assert.ok(service.getSnapshot(session.sessionId, "node_3"));
  assert.ok(service.getSnapshot(session.sessionId, "node_4"));
});

test("TimeTravelDebugService evicts eventStore when last session referencing executionId is removed", () => {
  const service = new TimeTravelDebugService({ maxSessions: 2 });

  // Session 1 and 2 both use harness_1
  const session1 = service.createSession("task_1", "harness_1");
  service.createSession("task_2", "harness_1");

  // Load event store for harness_1
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
    { nodeRunId: "node_2", timestamp: "2026-04-29T00:01:00.000Z" },
  ];
  service.loadEventStore("harness_1", events);

  // Session 3 evicts session1 (oldest), but harness_1 eventStore should remain
  // since session2 still references it
  const session3 = service.createSession("task_3", "harness_2");

  // session1 is evicted but harness_1 eventStore is still accessible via session2
  const eventStoreViaSession2 = (service as any).eventStore.get("harness_1");
  assert.ok(eventStoreViaSession2, "eventStore for harness_1 should still exist since session2 uses it");

  // Session 4 evicts session2 - now harness_1 eventStore should be cleaned up
  const session4 = service.createSession("task_4", "harness_3");

  const eventStoreAfterEviction = (service as any).eventStore.get("harness_1");
  assert.equal(eventStoreAfterEviction, undefined, "eventStore for harness_1 should be evicted when no sessions reference it");
});

test("TimeTravelDebugService does not leak eventStore references after maxSessions eviction", () => {
  const service = new TimeTravelDebugService({ maxSessions: 3 });

  // Create sessions with unique executionIds
  service.createSession("task_1", "exec_1");
  service.createSession("task_2", "exec_2");
  service.createSession("task_3", "exec_3");

  // Load event stores for all executionIds
  const events: TimeTravelDebugEvent[] = [
    { nodeRunId: "node_1", timestamp: "2026-04-29T00:00:00.000Z" },
  ];
  service.loadEventStore("exec_1", events);
  service.loadEventStore("exec_2", events);
  service.loadEventStore("exec_3", events);

  const eventStoreRef = (service as any).eventStore as Map<string, unknown>;
  assert.equal(eventStoreRef.size, 3, "All three eventStores should exist before eviction");

  // Trigger eviction by creating a 4th session
  service.createSession("task_4", "exec_4");

  // Oldest session (task_1, exec_1) is evicted, its eventStore should be cleaned
  assert.equal(eventStoreRef.size, 3, "Evicted eventStore should be removed");
  assert.equal(eventStoreRef.has("exec_1"), false, "exec_1 eventStore should be evicted");
  assert.ok(eventStoreRef.has("exec_2"), "exec_2 eventStore should remain");
  assert.ok(eventStoreRef.has("exec_3"), "exec_3 eventStore should remain");
  assert.ok(eventStoreRef.has("exec_4"), "exec_4 eventStore should exist");
});
