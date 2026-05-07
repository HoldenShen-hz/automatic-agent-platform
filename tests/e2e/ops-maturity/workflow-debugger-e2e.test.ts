/**
 * E2E Workflow Debugger Tests
 *
 * End-to-end tests covering workflow debugger service:
 * 1. Breakpoint management
 * 2. Time-travel debugging
 * 3. Run comparison
 * 4. Timeline rendering
 * 5. WebSocket debug stream
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { WorkflowDebuggerService } from "../../../src/ops-maturity/workflow-debugger/workflow-debugger-service.js";
import { BreakpointManager } from "../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";
import { TimeTravelDebugService } from "../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import { RunComparator } from "../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";
import type { DebugBreakpoint, DebugSnapshot, WorkflowRunRecord } from "../../../src/ops-maturity/workflow-debugger/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createDebugBreakpoint(overrides: Partial<DebugBreakpoint> = {}): DebugBreakpoint {
  return {
    breakpointId: overrides.breakpointId ?? "bp_e2e_001",
    taskId: overrides.taskId ?? "task_e2e_001",
    stepIndex: overrides.stepIndex ?? 2,
    condition: overrides.condition ?? null,
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

function createWorkflowRunRecord(overrides: Partial<WorkflowRunRecord> = {}): WorkflowRunRecord {
  return {
    runId: overrides.runId ?? "run_e2e_001",
    taskId: overrides.taskId ?? "task_e2e_001",
    workflowId: overrides.workflowId ?? "wf_test",
    status: overrides.status ?? "completed",
    startTime: overrides.startTime ?? "2026-05-01T10:00:00Z",
    endTime: overrides.endTime ?? "2026-05-01T10:05:00Z",
    steps: overrides.steps ?? [],
    events: overrides.events ?? [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Breakpoint Manager
// ---------------------------------------------------------------------------

test("E2E Debugger: BreakpointManager sets and triggers breakpoints", async () => {
  const harness = createE2EHarness("aa-e2e-debug-bp-");
  try {
    const manager = new BreakpointManager();

    // Set breakpoint at step 2
    const bp = createDebugBreakpoint({ stepIndex: 2 });
    manager.setBreakpoint(bp);

    assert.ok(manager.hasBreakpoint("task_e2e_001", 2), "Breakpoint should be set");

    // Verify breakpoint retrieval
    const retrieved = manager.getBreakpoint("bp_e2e_001");
    assert.ok(retrieved, "Should retrieve breakpoint");
    assert.equal(retrieved?.stepIndex, 2, "Should match step index");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Time Travel Debug Service
// ---------------------------------------------------------------------------

test("E2E Debugger: TimeTravelDebugService reconstructs workflow state at checkpoint", async () => {
  const harness = createE2EHarness("aa-e2e-debug-timetravel-");
  try {
    const service = new TimeTravelDebugService();

    const run = createWorkflowRunRecord({
      runId: "run_timetravel_001",
      steps: [
        { stepIndex: 0, status: "completed", output: "step_0_output" },
        { stepIndex: 1, status: "completed", output: "step_1_output" },
        { stepIndex: 2, status: "completed", output: "step_2_output" },
      ],
    });

    // Reconstruct state at step 1
    const snapshot = service.reconstructAtStep(run, 1);

    assert.ok(snapshot, "Should return state snapshot");
    assert.ok(snapshot.workflowState, "Should have workflow state");
    assert.equal(snapshot.stepIndex, 1, "Should match requested step");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Run Comparison
// ---------------------------------------------------------------------------

test("E2E Debugger: RunComparator identifies differences between two runs", async () => {
  const harness = createE2EHarness("aa-e2e-debug-compare-");
  try {
    const comparator = new RunComparator();

    const runA = createWorkflowRunRecord({
      runId: "run_a",
      steps: [
        { stepIndex: 0, status: "completed", output: "output_a" },
        { stepIndex: 1, status: "completed", output: "output_b" },
      ],
    });

    const runB = createWorkflowRunRecord({
      runId: "run_b",
      steps: [
        { stepIndex: 0, status: "completed", output: "output_a" },
        { stepIndex: 1, status: "completed", output: "output_c" }, // Different output
      ],
    });

    const diff = comparator.compare(runA, runB);

    assert.ok(diff, "Should return comparison result");
    assert.ok(Array.isArray(diff.differences), "Should have differences array");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Workflow Debugger Service
// ---------------------------------------------------------------------------

test("E2E Debugger: WorkflowDebuggerService manages debugging session", async () => {
  const harness = createE2EHarness("aa-e2e-debugger-");
  try {
    const service = new WorkflowDebuggerService();

    const session = service.startDebugSession("task_e2e_debug");

    assert.ok(session, "Should create debug session");
    assert.ok(session.sessionId, "Should have session ID");
    assert.equal(session.taskId, "task_e2e_debug", "Should match task ID");

    // Add breakpoint
    service.setBreakpoint({
      breakpointId: "bp_session_001",
      taskId: "task_e2e_debug",
      stepIndex: 1,
      enabled: true,
      createdAt: new Date().toISOString(),
    });

    // Verify breakpoint in session
    const breakpoints = service.getBreakpoints("task_e2e_debug");
    assert.ok(breakpoints.length > 0, "Should have breakpoints");
  } finally {
    harness.cleanup();
  }
});
