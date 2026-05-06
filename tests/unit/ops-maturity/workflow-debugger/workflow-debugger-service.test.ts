/**
 * Unit tests for WorkflowDebuggerService
 *
 * @see src/ops-maturity/workflow-debugger/workflow-debugger-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkflowDebuggerService,
  type DebugBreakpointDefinition,
  type WorkflowTraceFrame,
  type DebuggerActor,
} from "../../../../src/ops-maturity/workflow-debugger/index.js";

function createProdActor(): DebuggerActor {
  return { actorId: "sre-1", allowedRuntime: "replay_sandbox" };
}

function createNonProdActor(): DebuggerActor {
  return { actorId: "viewer-1", allowedRuntime: "non_prod" };
}

function createBreakpoint(
  id = "bp-1",
  workflowId = "wf-123",
  stepSelector = "deploy",
): DebugBreakpointDefinition {
  return {
    breakpointId: id,
    workflowId,
    stepSelector,
    condition: "always",
    action: "pause",
  };
}

test.describe("WorkflowDebuggerService", () => {
  test.describe("registerBreakpoint", () => {
    test("registers breakpoint in non-prod environment for any actor", () => {
      const service = new WorkflowDebuggerService();
      const bp = createBreakpoint();

      const result = service.registerBreakpoint(createNonProdActor(), "dev", bp);

      assert.equal(result.breakpointId, "bp-1");
      assert.equal(result.planGraphId, "wf-123");
      assert.equal(result.nodeRunSelector, "deploy");
      assert.deepEqual(service.listBreakpoints("wf-123"), [result]);
    });

    test("registers breakpoint in staging environment for any actor", () => {
      const service = new WorkflowDebuggerService();
      const bp = createBreakpoint();

      const result = service.registerBreakpoint(createNonProdActor(), "staging", bp);

      assert.equal(result.breakpointId, "bp-1");
    });

    test("registers breakpoint in prod environment for authorized actor", () => {
      const service = new WorkflowDebuggerService();
      const bp = createBreakpoint();

      const result = service.registerBreakpoint(createProdActor(), "prod", bp);

      assert.equal(result.breakpointId, "bp-1");
    });

    test("throws when non-authorized actor registers prod breakpoint", () => {
      const service = new WorkflowDebuggerService();
      const bp = createBreakpoint();

      assert.throws(
        () => service.registerBreakpoint(createNonProdActor(), "prod", bp),
        /workflow_debugger\.prod_breakpoint_forbidden/,
      );
    });

    test("throws with correct actorId in error message", () => {
      const service = new WorkflowDebuggerService();
      const actor = { actorId: "unauthorized-user", allowedRuntime: "non_prod" as const };
      const bp = createBreakpoint();

      assert.throws(
        () => service.registerBreakpoint(actor, "prod", bp),
        /unauthorized-user/,
      );
    });

    test("registers multiple breakpoints for same workflow", () => {
      const service = new WorkflowDebuggerService();
      const bp1 = createBreakpoint("bp-1", "wf-123", "build");
      const bp2 = createBreakpoint("bp-2", "wf-123", "deploy");

      service.registerBreakpoint(createProdActor(), "prod", bp1);
      service.registerBreakpoint(createProdActor(), "prod", bp2);

      const breakpoints = service.listBreakpoints("wf-123");
      assert.equal(breakpoints.length, 2);
    });

    test("returns the registered breakpoint", () => {
      const service = new WorkflowDebuggerService();
      const bp = createBreakpoint("bp-specific", "wf-xyz", "test");

      const result = service.registerBreakpoint(createProdActor(), "staging", bp);

      assert.equal(result.breakpointId, "bp-specific");
      assert.equal(result.planGraphId, "wf-xyz");
      assert.equal(result.nodeRunSelector, "test");
    });
  });

  test.describe("listBreakpoints", () => {
    test("returns empty array for workflow with no breakpoints", () => {
      const service = new WorkflowDebuggerService();

      const result = service.listBreakpoints("unknown-workflow");

      assert.deepEqual(result, []);
    });

    test("returns all breakpoints for given workflow", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "build"));
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-2", "wf-123", "deploy"));

      const result = service.listBreakpoints("wf-123");

      assert.equal(result.length, 2);
    });

    test("returns new array instance (does not leak internal state)", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "build"));

      const result1 = service.listBreakpoints("wf-123");
      const result2 = service.listBreakpoints("wf-123");

      assert.deepEqual(result1, result2);
      assert.notStrictEqual(result1, result2);
    });

    test("returns only breakpoints for specified workflow", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "build"));
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-2", "wf-other", "deploy"));

      const result = service.listBreakpoints("wf-123");

      assert.equal(result.length, 1);
      assert.equal(result[0]?.breakpointId, "bp-1");
    });
  });

  test.describe("evaluateTrace", () => {
    test("returns empty array for empty frames", () => {
      const service = new WorkflowDebuggerService();

      const result = service.evaluateTrace([]);

      assert.deepEqual(result, []);
    });

    test("returns empty array when no breakpoints match", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "build"));

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "test", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "test step" },
      ];

      const result = service.evaluateTrace(frames);

      assert.deepEqual(result, []);
    });

    test("returns breakpoint hits for matching frames", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "deploy"));

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "deploy", status: "paused", timestamp: "2026-04-20T00:01:00.000Z", label: "deploying" },
      ];

      const result = service.evaluateTrace(frames);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.breakpointId, "bp-1");
      assert.equal(result[0]?.nodeRunId, "deploy");
      assert.equal(result[0]?.action, "pause");
    });

    test("returns multiple hits when multiple frames match breakpoints", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "build"));
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-2", "wf-123", "deploy"));

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "test", status: "done", timestamp: "2026-04-20T00:01:00.000Z", label: "test" },
        { workflowId: "wf-123", stepId: "deploy", status: "done", timestamp: "2026-04-20T00:02:00.000Z", label: "deploy" },
      ];

      const result = service.evaluateTrace(frames);

      assert.equal(result.length, 2);
    });

    test("includes timestamp from matching frame in hit result", () => {
      const service = new WorkflowDebuggerService();
      const timestamp = "2026-04-20T12:30:00.000Z";
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-timestamp", "wf-123", "deploy"));

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "deploy", status: "paused", timestamp, label: "deploying" },
      ];

      const result = service.evaluateTrace(frames);

      assert.equal(result[0]?.timestamp, timestamp);
    });

    test("uses correct action from breakpoint definition", () => {
      const service = new WorkflowDebuggerService();
      const bp = { ...createBreakpoint("bp-action", "wf-123", "deploy"), action: "snapshot" as const };
      service.registerBreakpoint(createProdActor(), "prod", bp);

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "deploy", status: "running", timestamp: "2026-04-20T00:00:00.000Z", label: "deploy" },
      ];

      const result = service.evaluateTrace(frames);

      assert.equal(result[0]?.action, "snapshot");
    });

    test("does not include frame from different workflow when evaluating", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "deploy"));

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-other", stepId: "deploy", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "other deploy" },
      ];

      const result = service.evaluateTrace(frames);

      assert.deepEqual(result, []);
    });
  });

  test.describe("buildComparisonReport", () => {
    test("returns report with differences when step statuses differ", () => {
      const service = new WorkflowDebuggerService();
      const leftFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "deploy", status: "paused", timestamp: "2026-04-20T00:01:00.000Z", label: "deploy" },
      ];
      const rightFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "deploy", status: "failed", timestamp: "2026-04-20T00:01:30.000Z", label: "deploy" },
      ];

      const report = service.buildComparisonReport("wf-123", leftFrames, rightFrames);

      assert.deepEqual(report.differences, ["step:deploy:status:paused->failed"]);
    });

    test("returns empty differences when statuses match", () => {
      const service = new WorkflowDebuggerService();
      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
      ];

      const report = service.buildComparisonReport("wf-123", frames, frames);

      assert.deepEqual(report.differences, []);
    });

    test("includes planGraphId in report", () => {
      const service = new WorkflowDebuggerService();

      const report = service.buildComparisonReport(
        "wf-special",
        [],
        [],
      );

      assert.equal(report.planGraphId, "wf-special");
    });

    test("reports missing step on right side as 'missing'", () => {
      const service = new WorkflowDebuggerService();
      const leftFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "deploy", status: "done", timestamp: "2026-04-20T00:01:00.000Z", label: "deploy" },
      ];
      const rightFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
      ];

      const report = service.buildComparisonReport("wf-123", leftFrames, rightFrames);

      assert.deepEqual(report.differences, ["step:deploy:missing_in_right"]);
    });

    test("includes leftFrames in report", () => {
      const service = new WorkflowDebuggerService();
      const leftFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
      ];

      const report = service.buildComparisonReport("wf-123", leftFrames, []);

      assert.equal(report.leftFrames.length, 1);
      assert.deepEqual(report.leftFrames, leftFrames);
    });

    test("includes rightFrames in report", () => {
      const service = new WorkflowDebuggerService();
      const rightFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "deploy", status: "failed", timestamp: "2026-04-20T00:01:00.000Z", label: "deploy" },
      ];

      const report = service.buildComparisonReport("wf-123", [], rightFrames);

      assert.equal(report.rightFrames.length, 1);
      assert.deepEqual(report.rightFrames, rightFrames);
    });

    test("handles multiple differences", () => {
      const service = new WorkflowDebuggerService();
      const leftFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "test", status: "passed", timestamp: "2026-04-20T00:01:00.000Z", label: "test" },
        { workflowId: "wf-123", stepId: "deploy", status: "pending", timestamp: "2026-04-20T00:02:00.000Z", label: "deploy" },
      ];
      const rightFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "test", status: "failed", timestamp: "2026-04-20T00:01:30.000Z", label: "test" },
        { workflowId: "wf-123", stepId: "deploy", status: "skipped", timestamp: "2026-04-20T00:02:30.000Z", label: "deploy" },
      ];

      const report = service.buildComparisonReport("wf-123", leftFrames, rightFrames);

      assert.equal(report.differences.length, 2);
      assert.ok(report.differences.includes("step:test:status:passed->failed"));
      assert.ok(report.differences.includes("step:deploy:status:pending->skipped"));
    });
  });

  test.describe("renderTraceTimeline", () => {
    test("renders single frame as timeline entry", () => {
      const service = new WorkflowDebuggerService();
      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build completed" },
      ];

      const result = service.renderTraceTimeline(frames);

      assert.deepEqual(result, ["2026-04-20T00:00:00.000Z build completed"]);
    });

    test("renders multiple frames in order", () => {
      const service = new WorkflowDebuggerService();
      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "test", status: "done", timestamp: "2026-04-20T00:01:00.000Z", label: "test" },
        { workflowId: "wf-123", stepId: "deploy", status: "done", timestamp: "2026-04-20T00:02:00.000Z", label: "deploy" },
      ];

      const result = service.renderTraceTimeline(frames);

      assert.equal(result.length, 3);
      assert.ok(result[0]!.includes("build"));
      assert.ok(result[1]!.includes("test"));
      assert.ok(result[2]!.includes("deploy"));
    });

    test("renders empty array as empty timeline", () => {
      const service = new WorkflowDebuggerService();

      const result = service.renderTraceTimeline([]);

      assert.deepEqual(result, []);
    });

    test("includes timestamp and label in each entry", () => {
      const service = new WorkflowDebuggerService();
      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "step-1", status: "running", timestamp: "2026-04-20T15:30:45.123Z", label: "Processing task" },
      ];

      const result = service.renderTraceTimeline(frames);

      assert.equal(result[0], "2026-04-20T15:30:45.123Z Processing task");
    });
  });

  test.describe("integration scenarios", () => {
    test("full workflow debugging flow: register, evaluate, compare, render", () => {
      const service = new WorkflowDebuggerService();

      // Register breakpoints
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-release", "deploy"));
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-2", "wf-release", "rollback"));

      // Evaluate trace
      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-release", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-release", stepId: "deploy", status: "paused", timestamp: "2026-04-20T00:01:00.000Z", label: "deploying" },
      ];

      const hits = service.evaluateTrace(frames);
      assert.equal(hits.length, 1);
      assert.equal(hits[0]?.breakpointId, "bp-1");

      // Build comparison
      const previousFrames: WorkflowTraceFrame[] = [
        { workflowId: "wf-release", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-release", stepId: "deploy", status: "failed", timestamp: "2026-04-20T00:01:30.000Z", label: "deploy failed" },
      ];

      const report = service.buildComparisonReport("wf-release", frames, previousFrames);
      assert.deepEqual(report.differences, ["step:deploy:status:paused->failed"]);

      // Render timeline
      const timeline = service.renderTraceTimeline(frames);
      assert.ok(timeline.length > 0);
    });

    test("breakpoint without matching trace returns no hits", () => {
      const service = new WorkflowDebuggerService();
      service.registerBreakpoint(createProdActor(), "prod", createBreakpoint("bp-1", "wf-123", "nonexistent"));

      const frames: WorkflowTraceFrame[] = [
        { workflowId: "wf-123", stepId: "build", status: "done", timestamp: "2026-04-20T00:00:00.000Z", label: "build" },
        { workflowId: "wf-123", stepId: "test", status: "done", timestamp: "2026-04-20T00:01:00.000Z", label: "test" },
      ];

      const hits = service.evaluateTrace(frames);

      assert.deepEqual(hits, []);
    });
  });
});
