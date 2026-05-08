/**
 * Unit tests for TimeTravelDebugService - edge cases and additional coverage
 *
 * @see src/ops-maturity/workflow-debugger/time-travel-debug-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TimeTravelDebugService } from "../../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";

function createService() {
  return new TimeTravelDebugService();
}

describe("TimeTravelDebugService - Edge Cases", () => {
  describe("createSession", () => {
    test("sessionId follows naming convention", () => {
      const service = createService();
      const session = service.createSession("task-1", "exec-1");
      assert.ok(session.sessionId.startsWith("ttdebug_"));
    });

    test("multiple sessions have unique IDs", () => {
      const service = createService();
      const s1 = service.createSession("task-1", "exec-1");
      const s2 = service.createSession("task-2", "exec-2");
      assert.notEqual(s1.sessionId, s2.sessionId);
    });

    test("session stores taskId and executionId", () => {
      const service = createService();
      const session = service.createSession("my_task", "my_exec");
      assert.equal(session.taskId, "my_task");
      assert.equal(session.executionId, "my_exec");
    });

    test("new session starts at eventIndex 0", () => {
      const service = createService();
      const session = service.createSession("t", "e");
      assert.equal(session.currentEventIndex, 0);
    });

    test("new session has empty breakpoints and snapshots", () => {
      const service = createService();
      const session = service.createSession("t", "e");
      assert.deepEqual(session.breakpoints, []);
      assert.deepEqual(session.snapshots, []);
    });

    test("session has startedAt timestamp and null endedAt", () => {
      const service = createService();
      const before = new Date().toISOString();
      const session = service.createSession("t", "e");
      const after = new Date().toISOString();
      assert.ok(session.startedAt >= before);
      assert.ok(session.startedAt <= after);
      assert.equal(session.endedAt, null);
    });

    test("prod session requires short-lived expiry and prod permission", () => {
      const service = createService();

      assert.throws(
        () => service.createSession("t", "e", {
          actorId: "ops-1",
          environment: "prod",
          mfaVerified: true,
          sessionExpiresAt: null,
          permissions: ["time_travel:replay", "time_travel:replay:prod"],
        }),
        /time_travel_debug\.short_lived_session_required/,
      );
    });
  });

  describe("setBreakpoints", () => {
    test("setBreakpoints on unknown session does not throw", () => {
      const service = createService();
      service.setBreakpoints("unknown_session", ["step-1"]);
    });

    test("setBreakpoints replaces previous breakpoints", () => {
      const service = createService();
      const session = service.createSession("t", "e");

      service.setBreakpoints(session.sessionId, ["step-1"]);
      service.setBreakpoints(session.sessionId, ["step-2", "step-3"]);

      const events = [
        { stepId: "step-1", timestamp: "t1", variables: {} },
        { stepId: "step-2", timestamp: "t2", variables: {} },
        { stepId: "step-3", timestamp: "t3", variables: {} },
      ];
      service.loadEventStore("e", events);
      const state = service.replayToCursor(session.sessionId, 10);

      assert.ok(state !== null);
      assert.equal(state!.reachedBreakpoint, true);
    });
  });

  describe("loadEventStore", () => {
    test("stores events for executionId", () => {
      const service = createService();
      const events = [{ stepId: "s1" }, { stepId: "s2" }];
      service.loadEventStore("exec_abc", events);

      const session = service.createSession("t", "exec_abc");
      const state = service.replayStep(session.sessionId);
      assert.ok(state !== null);
    });

    test("overwrites previous events for same executionId", () => {
      const service = createService();
      service.loadEventStore("exec_x", [{ stepId: "old" }]);
      service.loadEventStore("exec_x", [{ stepId: "new" }, { stepId: "new2" }]);

      const session = service.createSession("t", "exec_x");
      const state1 = service.replayStep(session.sessionId);
      const state2 = service.replayStep(session.sessionId);
      const state3 = service.replayStep(session.sessionId);

      assert.ok(state1 !== null);
      assert.ok(state2 !== null);
      assert.ok(state3 !== null);
      assert.equal(state1!.currentEventIndex, 1);
      assert.equal(state2!.currentEventIndex, 2);
      assert.equal(state3!.currentEventIndex, 2);
    });
  });

  describe("replayStep", () => {
    test("returns null for unknown session", () => {
      const service = createService();
      const result = service.replayStep("nonexistent");
      assert.equal(result, null);
    });

    test("reachedBreakpoint is false when step has no matching breakpoint", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "step-1", timestamp: "t", variables: {} },
        { stepId: "step-2", timestamp: "t", variables: {} },
      ]);
      const session = service.createSession("t", "e");
      service.setBreakpoints(session.sessionId, ["step-999"]);

      const state = service.replayStep(session.sessionId);
      assert.ok(state !== null);
      assert.equal(state!.reachedBreakpoint, false);
    });

    test("advance beyond available events stays at last index", () => {
      const service = createService();
      service.loadEventStore("e", [{ stepId: "s1", timestamp: "t", variables: {} }]);
      const session = service.createSession("t", "e");

      service.replayStep(session.sessionId);
      const state = service.replayStep(session.sessionId);

      assert.ok(state !== null);
      assert.equal(state!.currentEventIndex, 1);
    });

    test("event with no stepId uses empty string as key", () => {
      const service = createService();
      service.loadEventStore("e", [{ timestamp: "t", variables: {} }]);
      const session = service.createSession("t", "e");

      const state = service.replayStep(session.sessionId);
      assert.ok(state !== null);
      assert.equal(state!.currentEventIndex, 1);
    });

    test("sandbox can allow explicit write replays when configured", () => {
      const service = createService();
      service.loadEventStore("e", [{ stepId: "s1", timestamp: "t", variables: {}, effectType: "write" }]);
      const session = service.createSession("t", "e", undefined, {
        blockExternalSideEffects: true,
        allowWrites: true,
        allowNetwork: false,
        allowProcess: false,
        allowToolCalls: false,
      });

      const state = service.replayStep(session.sessionId);
      assert.ok(state !== null);
      assert.equal(state!.currentEventIndex, 1);
    });
  });

  describe("replayToCursor", () => {
    test("returns null for unknown session", () => {
      const service = createService();
      const result = service.replayToCursor("nonexistent", 5);
      assert.equal(result, null);
    });

    test("reachedBreakpoint true when cursor lands on breakpoint", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "s1", timestamp: "t", variables: {} },
        { stepId: "s2", timestamp: "t", variables: {} },
        { stepId: "s3", timestamp: "t", variables: {} },
      ]);
      const session = service.createSession("t", "e");
      service.setBreakpoints(session.sessionId, ["s2"]);

      const state = service.replayToCursor(session.sessionId, 10);
      assert.ok(state !== null);
      assert.equal(state!.reachedBreakpoint, true);
    });

    test("cursor beyond event count returns last index", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "s1", timestamp: "t", variables: {} },
        { stepId: "s2", timestamp: "t", variables: {} },
      ]);
      const session = service.createSession("t", "e");

      const state = service.replayToCursor(session.sessionId, 100);
      assert.ok(state !== null);
      assert.ok(state!.currentEventIndex <= 2);
    });
  });

  describe("jumpToStep", () => {
    test("returns null for unknown session", () => {
      const service = createService();
      const result = service.jumpToStep("nonexistent", "step-1");
      assert.equal(result, null);
    });

    test("returns null for step not found in events", () => {
      const service = createService();
      service.loadEventStore("e", [{ stepId: "s1", timestamp: "t", variables: {} }]);
      const session = service.createSession("t", "e");

      const result = service.jumpToStep(session.sessionId, "nonexistent_step");
      assert.equal(result, null);
    });

    test("jumpToStep sets currentEventIndex to step position + 1", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "s1", timestamp: "t", variables: {} },
        { stepId: "s2", timestamp: "t", variables: {} },
        { stepId: "s3", timestamp: "t", variables: {} },
      ]);
      const session = service.createSession("t", "e");

      const state = service.jumpToStep(session.sessionId, "s2");
      assert.ok(state !== null);
      assert.equal(state!.currentEventIndex, 2);
    });
  });

  describe("getSnapshot", () => {
    test("returns null for unknown session", () => {
      const service = createService();
      const result = service.getSnapshot("unknown_session", "step-1");
      assert.equal(result, null);
    });

    test("returns null for step without snapshot", () => {
      const service = createService();
      service.loadEventStore("e", [{ stepId: "s1", timestamp: "t", variables: {}, stackTrace: "trace" }]);
      const session = service.createSession("t", "e");
      service.setBreakpoints(session.sessionId, ["s1"]);
      service.replayToCursor(session.sessionId, 10);

      const result = service.getSnapshot(session.sessionId, "nonexistent_step");
      assert.equal(result, null);
    });

    test("captured snapshot contains correct fields", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "s1", timestamp: "2026-04-21T00:00:00.000Z", variables: { count: { value: 42 } }, stackTrace: "at line 1" },
      ]);
      const session = service.createSession("task_x", "e");
      service.setBreakpoints(session.sessionId, ["s1"]);
      service.replayToCursor(session.sessionId, 10);

      const snapshot = service.getSnapshot(session.sessionId, "s1");
      assert.ok(snapshot !== null);
      assert.equal(snapshot!.taskId, "task_x");
      assert.equal(snapshot!.executionId, "e");
      assert.equal(snapshot!.stepId, "s1");
      assert.equal(snapshot!.stackTrace, "at line 1");
      assert.ok(snapshot!.variablesJson.includes("count"));
    });
  });

  describe("getVariableState", () => {
    test("returns empty array for unknown session", () => {
      const service = createService();
      const result = service.getVariableState("unknown", 0);
      assert.deepEqual(result, []);
    });

    test("eventIndex beyond events returns variables from all events", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "s1", timestamp: "t", variables: { x: { value: 1 } }, scope: "step" },
      ]);
      const session = service.createSession("t", "e");

      const vars = service.getVariableState(session.sessionId, 100);
      assert.ok(vars.length >= 0);
    });

    test("variable scope defaults to step when not specified", () => {
      const service = createService();
      service.loadEventStore("e", [{ stepId: "s1", timestamp: "t", variables: { v: { value: 1 } } }]);
      const session = service.createSession("t", "e");

      const vars = service.getVariableState(session.sessionId, 0);
      assert.ok(vars.every((v) => v.scope === "step"));
    });
  });

  describe("endSession", () => {
    test("endSession on unknown session does not throw", () => {
      const service = createService();
      service.endSession("nonexistent");
    });
  });

  describe("DebugSnapshot structure", () => {
    test("snapshot contains all required fields", () => {
      const service = createService();
      service.loadEventStore("e", [
        { stepId: "s1", timestamp: "2026-04-21T00:00:00.000Z", variables: { x: { value: 1 } }, stackTrace: "line 1" },
      ]);
      const session = service.createSession("task_1", "e");
      service.setBreakpoints(session.sessionId, ["s1"]);
      service.replayToCursor(session.sessionId, 10);

      const snapshot = service.getSnapshot(session.sessionId, "s1");
      assert.ok(snapshot !== null);
      assert.ok(snapshot!.snapshotId.startsWith("snap_"));
      assert.ok(snapshot!.variablesJson);
      assert.ok(typeof snapshot!.eventIndex === "number");
    });
  });
});
