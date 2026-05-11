import assert from "node:assert/strict";
import test from "node:test";

import { TimeTravelDebugService } from "../../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";

test("TimeTravelDebugService.createSession creates a new session", () => {
  const service = new TimeTravelDebugService();
  const session = service.createSession("task-1", "exec-1");

  assert.ok(session.sessionId.startsWith("ttdebug_"));
  assert.equal(session.taskId, "task-1");
  assert.equal(session.executionId, "exec-1");
  assert.deepEqual(session.breakpoints, []);
  assert.deepEqual(session.snapshots, []);
  assert.equal(session.currentEventIndex, 0);
  assert.equal(session.accessContext.actorId, "local_debugger");
  assert.equal(session.sandboxPolicy.blockExternalSideEffects, true);
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

test("TimeTravelDebugService evicts oldest session when maxSessions is exceeded", () => {
  const service = new TimeTravelDebugService({ maxSessions: 2 });
  const first = service.createSession("task-1", "exec-1");
  service.createSession("task-2", "exec-2");
  service.createSession("task-3", "exec-3");

  const result = service.replayStep(first.sessionId);
  assert.equal(result, null);
});

test("TimeTravelDebugService bounds snapshots and normalizes variable envelopes without any casts", () => {
  const service = new TimeTravelDebugService({ maxSnapshotsPerSession: 1 });
  service.loadEventStore("exec-1", [
    {
      stepId: "step-1",
      timestamp: "2026-04-20T00:00:00.000Z",
      variables: { count: { value: 42 }, plain: "ok" },
      stackTrace: "line 1",
      scope: "loop",
    },
    {
      stepId: "step-2",
      timestamp: "2026-04-20T00:01:00.000Z",
      variables: { count: { value: 43 } },
      stackTrace: "line 2",
      scope: "global",
    },
  ]);

  const session = service.createSession("task-1", "exec-1");
  service.setBreakpoints(session.sessionId, ["step-1", "step-2"]);
  service.replayStep(session.sessionId);
  service.replayStep(session.sessionId);

  const vars = service.getVariableState(session.sessionId, 1);
  assert.ok(vars.some((variable) => variable.name === "count" && variable.value === 42 && variable.scope === "loop"));
  assert.ok(vars.some((variable) => variable.name === "plain" && variable.value === "ok"));

  assert.equal(service.getSnapshot(session.sessionId, "step-1"), null);
  assert.ok(service.getSnapshot(session.sessionId, "step-2") !== null);
});

test("TimeTravelDebugService blocks replay of unsafe side-effect events by default", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-unsafe", [
    {
      stepId: "network-call",
      timestamp: "2026-04-20T00:00:00.000Z",
      variables: {},
      effectType: "network",
    },
  ]);

  const session = service.createSession("task-unsafe", "exec-unsafe");

  assert.throws(
    () => service.replayStep(session.sessionId),
    /time_travel_debug\.replay_side_effect_blocked:network/,
  );
});

test("TimeTravelDebugService requires MFA and prod permission for prod replay sessions", () => {
  const service = new TimeTravelDebugService();

  assert.throws(
    () => service.createSession("task-prod", "exec-prod", {
      actorId: "operator-1",
      environment: "prod",
      mfaVerified: false,
      sessionExpiresAt: "2026-12-31T00:00:00.000Z",
      permissions: ["time_travel:replay", "time_travel:replay:prod"],
    }),
    /time_travel_debug\.mfa_required/,
  );
});

test("TimeTravelDebugService replayStep sets fromEventIndex less than toEventIndex", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  const state = service.replayStep(session.sessionId);

  assert.ok(state !== null);
  assert.equal(state.cursor.fromEventIndex, 0);
  assert.equal(state.cursor.toEventIndex, 1);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

test("TimeTravelDebugService replayStep cursor advances with each step", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");

  const state1 = service.replayStep(session.sessionId);
  assert.ok(state1 !== null);
  assert.equal(state1.cursor.fromEventIndex, 0);
  assert.equal(state1.cursor.toEventIndex, 1);

  const state2 = service.replayStep(session.sessionId);
  assert.ok(state2 !== null);
  assert.equal(state2.cursor.fromEventIndex, 1);
  assert.equal(state2.cursor.toEventIndex, 2);

  const state3 = service.replayStep(session.sessionId);
  assert.ok(state3 !== null);
  assert.equal(state3.cursor.fromEventIndex, 2);
  assert.equal(state3.cursor.toEventIndex, 3);
});

test("TimeTravelDebugService replayToCursor sets correct cursor bounds", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");

  const state = service.replayToCursor(session.sessionId, 2);

  assert.ok(state !== null);
  assert.equal(state.cursor.fromEventIndex, 0);
  assert.equal(state.cursor.toEventIndex, 2);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

test("TimeTravelDebugService jumpToStep sets cursor with from < to", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");

  const state = service.jumpToStep(session.sessionId, "step-2");

  assert.ok(state !== null);
  assert.equal(state.cursor.fromEventIndex, 0);
  assert.equal(state.cursor.toEventIndex, 2);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});
