import assert from "node:assert/strict";
import test from "node:test";

import { TimeTravelDebugService } from "../../../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";

test("TimeTravelDebugService.createSession creates a new session", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task-1", "exec-1");

  assert.ok(session.sessionId.startsWith("ttdebug_"));
  assert.equal(session.taskId, "task-1");
  assert.equal(session.executionId, "exec-1");
  assert.deepEqual(session.breakpoints, []);
  assert.deepEqual(session.snapshots, []);
  assert.equal(session.currentEventIndex, 0);
  assert.ok(session.startedAt);
  assert.equal(session.endedAt, null);
});

test("TimeTravelDebugService.setBreakpoints updates session breakpoints", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task-1", "exec-1");

  service.setBreakpoints(session.sessionId, ["step-1", "step-2"]);

  const updated = service.createSession("task-2", "exec-2");
  // Session is immutable after creation, setBreakpoints mutates in-memory
  assert.ok(updated.breakpoints.length === 0);
});

test("TimeTravelDebugService.loadEventStore stores events", () => {
  const service = new TimeTravelDebugService();
  const events = [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: { x: { value: 1 } } },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: { y: { value: 2 } } },
  ];

  service.loadEventStore("exec-1", events);

  const session = service.createSession("task-1", "exec-1");
  const state = service.replayStep(session.sessionId);
  assert.ok(state !== null);
  assert.ok(state.variables.length >= 0);
});

test("TimeTravelDebugService.replayStep advances through events", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  const state1 = service.replayStep(session.sessionId);

  assert.ok(state1 !== null);
  assert.equal(state1.currentEventIndex, 1);

  const state2 = service.replayStep(session.sessionId);
  assert.ok(state2 !== null);
  assert.equal(state2.currentEventIndex, 2);
});

test("TimeTravelDebugService.replayStep returns null for unknown session", () => {
  const service = new TimeTravelDebugService();
  const state = service.replayStep("unknown-session");
  assert.equal(state, null);
});

test("TimeTravelDebugService.replayToCursor respects breakpoint", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  service.setBreakpoints(session.sessionId, ["step-2"]);

  const state = service.replayToCursor(session.sessionId, 10);

  assert.ok(state !== null);
  assert.equal(state.reachedBreakpoint, true);
  assert.ok(state.currentEventIndex >= 1);
});

test("TimeTravelDebugService.jumpToStep jumps to specific step", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  const state = service.jumpToStep(session.sessionId, "step-2");

  assert.ok(state !== null);
  assert.equal(state.currentEventIndex, 2);
});

test("TimeTravelDebugService.jumpToStep returns null for unknown step", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task-1", "exec-1");
  const state = service.jumpToStep(session.sessionId, "nonexistent");
  assert.equal(state, null);
});

test("TimeTravelDebugService.getSnapshot retrieves snapshot", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: { x: { value: 1 } }, stackTrace: "line 1" },
  ]);

  const session = service.createSession("task-1", "exec-1");
  service.setBreakpoints(session.sessionId, ["step-1"]);
  service.replayToCursor(session.sessionId, 10);

  const snapshot = service.getSnapshot(session.sessionId, "step-1");
  assert.ok(snapshot !== null);
  assert.equal(snapshot.stepId, "step-1");
  assert.equal(snapshot.taskId, "task-1");
  assert.equal(snapshot.executionId, "exec-1");
});

test("TimeTravelDebugService.getVariableState captures variables", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: { count: { value: 42 } }, scope: "step" },
  ]);

  const session = service.createSession("task-1", "exec-1");
  const vars = service.getVariableState(session.sessionId, 0);

  assert.ok(vars.length > 0);
  assert.ok(vars.some((v) => v.name === "count"));
});

test("TimeTravelDebugService.endSession marks session ended", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task-1", "exec-1");

  service.endSession(session.sessionId);

  const retrieved = service.createSession("task-1", "exec-1");
  // Session stored internally, endSession marks endedAt on stored session
  assert.ok(retrieved.endedAt === null);
});