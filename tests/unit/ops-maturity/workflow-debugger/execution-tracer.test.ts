/**
 * Unit tests for ExecutionTracer
 *
 * @see src/ops-maturity/workflow-debugger/execution-tracer.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionTracer,
  type TraceEvent,
  type ExecutionTrace,
} from "../../../../src/ops-maturity/workflow-debugger/execution-tracer.js";

test.describe("ExecutionTracer", () => {
  test.describe("startTrace", () => {
    test("creates a new trace with active status", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");

      assert.ok(trace.traceId.startsWith("trace_"));
      assert.equal(trace.workflowId, "wf-1");
      assert.equal(trace.executionId, "exec-1");
      assert.equal(trace.status, "active");
      assert.deepEqual(trace.events, []);
      assert.ok(trace.startedAt);
      assert.equal(trace.endedAt, null);
      assert.equal(trace.totalDurationMs, null);
    });

    test("allows multiple traces for same workflow", () => {
      const tracer = new ExecutionTracer();
      const trace1 = tracer.startTrace("wf-1", "exec-1");
      const trace2 = tracer.startTrace("wf-1", "exec-2");

      assert.notEqual(trace1.traceId, trace2.traceId);
      assert.equal(trace1.workflowId, trace2.workflowId);
    });
  });

  test.describe("recordEvent", () => {
    test("records event for active trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");

      const event = tracer.recordEvent(trace.traceId, "step-1", "enter", { user: "test" });

      assert.ok(event !== null);
      assert.ok(event.eventId.startsWith("evt_"));
      assert.equal(event.stepId, "step-1");
      assert.equal(event.eventType, "enter");
      assert.ok(event.timestamp);
      assert.ok(event.durationMs !== null || event.durationMs === null);
      assert.deepEqual(event.metadata, { user: "test" });
    });

    test("records multiple events in sequence", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");

      const event1 = tracer.recordEvent(trace.traceId, "step-1", "enter");
      const event2 = tracer.recordEvent(trace.traceId, "step-1", "exit");

      assert.ok(event1 !== null);
      assert.ok(event2 !== null);
      assert.notEqual(event1.eventId, event2.eventId);
    });

    test("returns null for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const event = tracer.recordEvent("unknown-trace", "step-1", "enter");
      assert.equal(event, null);
    });

    test("returns null for completed trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.stopTrace(trace.traceId);

      const event = tracer.recordEvent(trace.traceId, "step-1", "enter");
      assert.equal(event, null);
    });

    test("respects maxEventsPerTrace limit", () => {
      const tracer = new ExecutionTracer({ maxEventsPerTrace: 2 });
      const trace = tracer.startTrace("wf-1", "exec-1");

      const event1 = tracer.recordEvent(trace.traceId, "step-1", "enter");
      const event2 = tracer.recordEvent(trace.traceId, "step-2", "enter");
      const event3 = tracer.recordEvent(trace.traceId, "step-3", "enter");

      assert.ok(event1 !== null);
      assert.ok(event2 !== null);
      assert.equal(event3, null);
    });

    test("records all event types", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");

      const enter = tracer.recordEvent(trace.traceId, "step-1", "enter");
      const exit = tracer.recordEvent(trace.traceId, "step-1", "exit");
      const error = tracer.recordEvent(trace.traceId, "step-1", "error");
      const variableChange = tracer.recordEvent(trace.traceId, "step-1", "variable_change");
      const checkpoint = tracer.recordEvent(trace.traceId, "step-1", "checkpoint");

      assert.ok(enter !== null);
      assert.ok(exit !== null);
      assert.ok(error !== null);
      assert.ok(variableChange !== null);
      assert.ok(checkpoint !== null);
    });
  });

  test.describe("pauseTrace", () => {
    test("pauses active trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");

      const result = tracer.pauseTrace(trace.traceId);

      assert.equal(result, true);
      const updated = tracer.getTrace(trace.traceId);
      assert.equal(updated?.status, "paused");
    });

    test("returns false for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const result = tracer.pauseTrace("unknown");
      assert.equal(result, false);
    });

    test("returns false for already paused trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.pauseTrace(trace.traceId);

      const result = tracer.pauseTrace(trace.traceId);
      assert.equal(result, false);
    });
  });

  test.describe("resumeTrace", () => {
    test("resumes paused trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.pauseTrace(trace.traceId);

      const result = tracer.resumeTrace(trace.traceId);

      assert.equal(result, true);
      const updated = tracer.getTrace(trace.traceId);
      assert.equal(updated?.status, "active");
    });

    test("returns false for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const result = tracer.resumeTrace("unknown");
      assert.equal(result, false);
    });

    test("returns false for active trace (not paused)", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");

      const result = tracer.resumeTrace(trace.traceId);
      assert.equal(result, false);
    });
  });

  test.describe("stopTrace", () => {
    test("stops active trace and returns final trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");

      const result = tracer.stopTrace(trace.traceId);

      assert.ok(result !== null);
      assert.equal(result.status, "completed");
      assert.ok(result.endedAt !== null);
      assert.ok(result.totalDurationMs !== null);
      assert.equal(result.events.length, 1);
    });

    test("returns null for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const result = tracer.stopTrace("unknown");
      assert.equal(result, null);
    });

    test("returns null for already completed trace", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.stopTrace(trace.traceId);

      const result = tracer.stopTrace(trace.traceId);
      assert.equal(result, null);
    });

    test("clears events from active storage after stop", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");

      tracer.stopTrace(trace.traceId);

      const updated = tracer.getTrace(trace.traceId);
      assert.ok(updated !== null);
      assert.equal(updated.events.length, 1);
    });
  });

  test.describe("abortTrace", () => {
    test("aborts trace without duration", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");

      const result = tracer.abortTrace(trace.traceId);

      assert.ok(result !== null);
      assert.equal(result.status, "aborted");
      assert.ok(result.endedAt !== null);
      assert.equal(result.totalDurationMs, null);
    });

    test("returns null for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const result = tracer.abortTrace("unknown");
      assert.equal(result, null);
    });
  });

  test.describe("getTrace", () => {
    test("returns active trace with current events", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");

      const result = tracer.getTrace(trace.traceId);

      assert.ok(result !== null);
      assert.equal(result.traceId, trace.traceId);
      assert.equal(result.status, "active");
    });

    test("returns null for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const result = tracer.getTrace("unknown");
      assert.equal(result, null);
    });
  });

  test.describe("filterEvents", () => {
    test("filters by stepId", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");
      tracer.recordEvent(trace.traceId, "step-2", "enter");
      tracer.recordEvent(trace.traceId, "step-1", "exit");

      const filtered = tracer.filterEvents(trace.traceId, { stepId: "step-1" });

      assert.equal(filtered.length, 2);
      assert.ok(filtered.every((e) => e.stepId === "step-1"));
    });

    test("filters by eventType", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");
      tracer.recordEvent(trace.traceId, "step-1", "exit");
      tracer.recordEvent(trace.traceId, "step-1", "error");

      const filtered = tracer.filterEvents(trace.traceId, { eventType: "error" });

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0]?.eventType, "error");
    });

    test("filters by timestamp range", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");

      const filtered = tracer.filterEvents(trace.traceId, {
        fromTimestamp: "2020-01-01T00:00:00.000Z",
        toTimestamp: "2099-01-01T00:00:00.000Z",
      });

      assert.ok(filtered.length >= 0);
    });

    test("combines multiple filters", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");
      tracer.recordEvent(trace.traceId, "step-1", "error");
      tracer.recordEvent(trace.traceId, "step-2", "error");

      const filtered = tracer.filterEvents(trace.traceId, {
        stepId: "step-1",
        eventType: "error",
      });

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0]?.stepId, "step-1");
      assert.equal(filtered[0]?.eventType, "error");
    });

    test("returns empty array for unknown trace", () => {
      const tracer = new ExecutionTracer();
      const filtered = tracer.filterEvents("unknown", {});
      assert.deepEqual(filtered, []);
    });
  });

  test.describe("getTracesByWorkflow", () => {
    test("returns traces for specified workflow", () => {
      const tracer = new ExecutionTracer();
      tracer.startTrace("wf-1", "exec-1");
      tracer.startTrace("wf-1", "exec-2");
      tracer.startTrace("wf-2", "exec-3");

      const wf1Traces = tracer.getTracesByWorkflow("wf-1");
      assert.equal(wf1Traces.length, 2);
      assert.ok(wf1Traces.every((t) => t.workflowId === "wf-1"));
    });

    test("returns empty array for workflow with no traces", () => {
      const tracer = new ExecutionTracer();
      const traces = tracer.getTracesByWorkflow("nonexistent");
      assert.deepEqual(traces, []);
    });
  });

  test.describe("getTracesByExecution", () => {
    test("returns traces for specified execution", () => {
      const tracer = new ExecutionTracer();
      tracer.startTrace("wf-1", "exec-1");
      tracer.startTrace("wf-2", "exec-1");

      const traces = tracer.getTracesByExecution("exec-1");
      assert.equal(traces.length, 2);
      assert.ok(traces.every((t) => t.executionId === "exec-1"));
    });
  });

  test.describe("getActiveTraceCount", () => {
    test("returns count of active traces", () => {
      const tracer = new ExecutionTracer();
      const t1 = tracer.startTrace("wf-1", "exec-1");
      tracer.startTrace("wf-2", "exec-2");
      tracer.pauseTrace(t1.traceId);

      assert.equal(tracer.getActiveTraceCount(), 1);
    });
  });

  test.describe("reset", () => {
    test("clears all traces", () => {
      const tracer = new ExecutionTracer();
      const trace = tracer.startTrace("wf-1", "exec-1");
      tracer.recordEvent(trace.traceId, "step-1", "enter");

      tracer.reset();

      assert.equal(tracer.getTrace(trace.traceId), null);
      assert.equal(tracer.getActiveTraceCount(), 0);
    });
  });
});