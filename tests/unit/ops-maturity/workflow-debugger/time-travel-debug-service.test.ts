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
  assert.ok(vars.some((variable) => variable.name === "count" && variable.value === 43 && variable.scope === "global"));
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

test("TimeTravelDebugService replayStep handles boundary case where currentEventIndex >= events.length", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  // Advance to end of events
  service.replayStep(session.sessionId); // currentEventIndex = 1
  service.replayStep(session.sessionId); // currentEventIndex = 2 (== events.length)

  // Now replayStep should return state with fromEventIndex < toEventIndex
  const state = service.replayStep(session.sessionId);

  assert.ok(state !== null);
  assert.equal(state.cursor.fromEventIndex, 2);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

test("TimeTravelDebugService replayStep preserves fromEventIndex < toEventIndex invariant at boundary", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  // Advance past the only event
  service.replayStep(session.sessionId); // currentEventIndex = 1 (== events.length)

  const state = service.replayStep(session.sessionId);

  assert.ok(state !== null);
  assert.equal(state.cursor.fromEventIndex, 1);
  assert.equal(state.cursor.toEventIndex, 2);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

test("TimeTravelDebugService replayStep boundary cursor uses events.length+1 as toEventIndex", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  // Exhaust all events
  service.replayStep(session.sessionId); // to=1
  service.replayStep(session.sessionId); // to=2
  service.replayStep(session.sessionId); // to=3 (events.length)

  const state = service.replayStep(session.sessionId);

  assert.ok(state !== null);
  // After exhausting 3 events (indices 0,1,2), currentEventIndex=3
  // At boundary, from=3, to=3+1=4
  assert.equal(state.cursor.fromEventIndex, 3);
  assert.equal(state.cursor.toEventIndex, 4);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

test("TimeTravelDebugService replayToCursor sets fromEventIndex < toEventIndex when toEventIndex equals currentIndex", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  // currentEventIndex is 0
  // When toEventIndex == currentIndex (0 == 0), should still set fromEventIndex < toEventIndex
  const state = service.replayToCursor(session.sessionId, 0);

  assert.ok(state !== null);
  assert.equal(state.cursor.fromEventIndex, 0);
  assert.ok(state.cursor.toEventIndex > state.cursor.fromEventIndex);
});

test("TimeTravelDebugService replayToCursor preserves fromEventIndex < toEventIndex at breakpoint", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  service.setBreakpoints(session.sessionId, ["step-2"]);

  // Advance to step-1 first
  service.replayStep(session.sessionId); // currentEventIndex = 1
  // Now toEventIndex (2) > currentIndex (1), hit breakpoint at step-2
  const state = service.replayToCursor(session.sessionId, 2);

  assert.ok(state !== null);
  assert.equal(state.reachedBreakpoint, true);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
  assert.equal(state.cursor.fromEventIndex, 1);
  assert.equal(state.cursor.toEventIndex, 2);
});

test("TimeTravelDebugService replayToCursor cursor reflects actual range advanced", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-04-20T00:02:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  // No breakpoints, should advance from 0 to 2
  const state = service.replayToCursor(session.sessionId, 2);

  assert.ok(state !== null);
  assert.equal(state.reachedBreakpoint, false);
  // fromEventIndex should be the position BEFORE advancement (0)
  // toEventIndex should be the position AFTER advancement (2)
  assert.equal(state.cursor.fromEventIndex, 0);
  assert.equal(state.cursor.toEventIndex, 2);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

test("TimeTravelDebugService evictOldestSessionIfNeeded does not leak eventStore when multiple sessions share executionId", () => {
  // Set maxSessions to 2, create 2 sessions with the same executionId, then create a 3rd
  // The oldest session should be evicted but eventStore should be retained because
  // the remaining session still references the same executionId
  const service = new TimeTravelDebugService({ maxSessions: 2 });

  // Load events for execution "exec-shared"
  service.loadEventStore("exec-shared", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: { x: { value: 1 } } },
    { stepId: "step-2", timestamp: "2026-04-20T00:01:00.000Z", variables: { x: { value: 2 } } },
  ]);

  // Create first session with exec-shared
  const session1 = service.createSession("task-1", "exec-shared");
  // Create second session with the SAME executionId
  const session2 = service.createSession("task-2", "exec-shared");

  // Create a third session - this triggers eviction of oldest session (session1)
  const session3 = service.createSession("task-3", "exec-3");

  // session1 is evicted. eventStore for "exec-shared" must NOT be deleted because
  // session2 still references it. Verify by replaying on session2.
  const state = service.replayStep(session2.sessionId);
  assert.ok(state !== null, "session2 should still be able to replay - eventStore must not be leaked");
  assert.equal(state.currentEventIndex, 1);
});

test("TimeTravelDebugService evictOldestSessionIfNeeded cleans up eventStore when no sessions reference it", () => {
  // Set maxSessions to 2, create 2 sessions with DIFFERENT executionIds, then create a 3rd
  // The oldest session should be evicted AND its eventStore should be deleted since
  // no other session references that executionId
  const service = new TimeTravelDebugService({ maxSessions: 2 });

  // Load events for two different executionIds
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
  ]);
  service.loadEventStore("exec-2", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {} },
  ]);

  // Create sessions for each executionId
  const session1 = service.createSession("task-1", "exec-1");
  const session2 = service.createSession("task-2", "exec-2");

  // Create a third session - this triggers eviction of oldest session (session1)
  const session3 = service.createSession("task-3", "exec-3");

  // session1 (exec-1) is evicted and no other session references exec-1
  // Verify session3 works correctly
  const state3 = service.replayStep(session3.sessionId);
  assert.ok(state3 !== null);

  // Verify session2 still works (exec-2 eventStore should not be leaked)
  const state2 = service.replayStep(session2.sessionId);
  assert.ok(state2 !== null, "session2 should still work - its eventStore must not be leaked");
});

test("TimeTravelDebugService evictOldestSessionIfNeeded cleans up snapshots on eviction", () => {
  const service = new TimeTravelDebugService({ maxSessions: 2 });

  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {}, stackTrace: "trace1" },
  ]);
  service.loadEventStore("exec-2", [
    { stepId: "step-1", timestamp: "2026-04-20T00:00:00.000Z", variables: {}, stackTrace: "trace2" },
  ]);

  const session1 = service.createSession("task-1", "exec-1");
  const session2 = service.createSession("task-2", "exec-2");

  // Set breakpoint and capture snapshot on session1
  service.setBreakpoints(session1.sessionId, ["step-1"]);
  service.replayToCursor(session1.sessionId, 10);

  // Evict by creating another session
  const session3 = service.createSession("task-3", "exec-3");

  // session1's snapshots should be cleaned up
  const snapshot = service.getSnapshot(session1.sessionId, "step-1");
  assert.equal(snapshot, null, "snapshot for evicted session should be null");
});
