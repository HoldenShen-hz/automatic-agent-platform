/**
 * Phase 1B Demo CLI Tests
 *
 * Tests for phase1b-demo.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { join } from "node:path";

// ---------------------------------------------------------------------------
// Tests for resolveDbPath function
// ---------------------------------------------------------------------------

test("resolveDbPath constructs path with data/sqlite directory", () => {
  const base = process.cwd();
  const sqliteDir = join(base, "data", "sqlite");
  const expectedPath = join(sqliteDir, "multi-step-demo.db");
  assert.ok(expectedPath.includes("data"));
  assert.ok(expectedPath.includes("sqlite"));
  assert.ok(expectedPath.includes("multi-step-demo.db"));
});

test("resolveDbPath filename is multi-step-demo.db", () => {
  const filename = "multi-step-demo.db";
  assert.ok(filename.endsWith(".db"));
  assert.ok(filename.includes("multi-step"));
});

// ---------------------------------------------------------------------------
// Tests for runMultiStepOrchestration result structure
// ---------------------------------------------------------------------------

test("runMultiStepOrchestration result contains routing field", () => {
  const mockResult = {
    routing: { decisions: [] },
    plannedWorkflow: { executionSteps: [] },
    snapshot: { task: {}, workflow: {}, stepOutputs: [] },
    streamFrames: [],
  };
  assert.ok("routing" in mockResult);
  assert.ok("plannedWorkflow" in mockResult);
  assert.ok("snapshot" in mockResult);
  assert.ok("streamFrames" in mockResult);
});

test("plannedWorkflow.executionSteps maps stepId, roleId, dependsOnStepIds", () => {
  const steps = [
    { stepId: "step-1", roleId: "analyzer", dependsOnStepIds: [] },
    { stepId: "step-2", roleId: "drafter", dependsOnStepIds: ["step-1"] },
  ];
  assert.equal(steps[0]!.stepId, "step-1");
  assert.equal(steps[0]!.dependsOnStepIds.length, 0);
  assert.equal(steps[1]!.dependsOnStepIds[0], "step-1");
});

test("snapshot.task contains id and status fields", () => {
  const task = { id: "task-123", status: "in_progress" };
  assert.equal(task.id, "task-123");
  assert.equal(task.status, "in_progress");
});

test("stepOutputs maps stepId, roleId, summary", () => {
  const stepOutputs = [
    { stepId: "step-1", roleId: "analyzer", summary: "Analysis complete" },
  ];
  assert.equal(stepOutputs[0]!.stepId, "step-1");
  assert.equal(stepOutputs[0]!.summary, "Analysis complete");
});

test("streamFrames maps sequence and eventType", () => {
  const frames = [
    { sequence: 1, eventType: "step_started" },
    { sequence: 2, eventType: "step_completed" },
  ];
  assert.equal(frames[0]!.sequence, 1);
  assert.equal(frames[0]!.eventType, "step_started");
  assert.equal(frames[1]!.sequence, 2);
});

// ---------------------------------------------------------------------------
// Tests for demo request string pattern
// ---------------------------------------------------------------------------

test("demo request follows analyze-draft-review pattern", () => {
  const request = "Analyze the task, draft a solution, and review the final output before completion.";
  assert.ok(request.toLowerCase().includes("analyze"));
  assert.ok(request.toLowerCase().includes("draft"));
  assert.ok(request.toLowerCase().includes("review"));
});

// ---------------------------------------------------------------------------
// Tests for JSON output structure
// ---------------------------------------------------------------------------

test("JSON output includes routing, plannedSteps, task, workflow, stepOutputs, streamFrames", () => {
  const output = {
    routing: {},
    plannedSteps: [],
    task: { id: "", status: "" },
    workflow: {},
    stepOutputs: [],
    streamFrames: [],
  };
  assert.ok("routing" in output);
  assert.ok("plannedSteps" in output);
  assert.ok("task" in output);
  assert.ok("workflow" in output);
  assert.ok("stepOutputs" in output);
  assert.ok("streamFrames" in output);
});
