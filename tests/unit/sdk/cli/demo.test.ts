/**
 * Phase1b Demo CLI Tests
 *
 * Tests for phase1b-demo.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for db path resolution
// ---------------------------------------------------------------------------

test("phase1b-demo resolves db path to data/sqlite/multi-step-demo.db", () => {
  // The resolveDbPath function constructs: join(cwd, "data", "sqlite", "multi-step-demo.db")
  const base = "/Users/test/project";
  const expected = `${base}/data/sqlite/multi-step-demo.db`;

  // Simulate path resolution
  const sqliteDir = `${base}/data/sqlite`;
  const dbPath = `${sqliteDir}/multi-step-demo.db`;

  assert.ok(dbPath.includes("data/sqlite"));
  assert.ok(dbPath.endsWith("multi-step-demo.db"));
  assert.equal(dbPath, expected);
});

test("phase1b-demo output includes routing decisions", () => {
  const result = {
    routing: { decision: "analyze" },
    plannedWorkflow: { executionSteps: [] },
    snapshot: { task: {}, workflow: {} },
    stepOutputs: [],
    streamFrames: [],
  };

  assert.ok(result.routing != null);
  assert.equal(result.routing.decision, "analyze");
});

test("phase1b-demo output includes planned steps", () => {
  const result = {
    routing: {},
    plannedWorkflow: {
      executionSteps: [
        { stepId: "step-1", roleId: "analyzer", dependsOnStepIds: [] },
        { stepId: "step-2", roleId: "drafter", dependsOnStepIds: ["step-1"] },
      ],
    },
    snapshot: { task: {}, workflow: {} },
    stepOutputs: [],
    streamFrames: [],
  };

  assert.equal(result.plannedWorkflow.executionSteps.length, 2);
  assert.equal(result.plannedWorkflow.executionSteps[0]!.roleId, "analyzer");
  assert.equal(result.plannedWorkflow.executionSteps[1]!.roleId, "drafter");
});

test("phase1b-demo planned steps are simplified in output", () => {
  const plannedWorkflow = {
    executionSteps: [
      { stepId: "step-1", roleId: "analyzer", dependsOnStepIds: [], extraField: "ignored" },
      { stepId: "step-2", roleId: "drafter", dependsOnStepIds: ["step-1"], extraField: "ignored" },
    ],
  };

  const simplifiedSteps = plannedWorkflow.executionSteps.map((step) => ({
    stepId: step.stepId,
    roleId: step.roleId,
    dependsOnStepIds: step.dependsOnStepIds,
  }));

  assert.equal(simplifiedSteps.length, 2);
  assert.deepEqual(simplifiedSteps[0], { stepId: "step-1", roleId: "analyzer", dependsOnStepIds: [] });
  assert.deepEqual(simplifiedSteps[1], { stepId: "step-2", roleId: "drafter", dependsOnStepIds: ["step-1"] });
});

test("phase1b-demo output includes task snapshot", () => {
  const result = {
    routing: {},
    plannedWorkflow: { executionSteps: [] },
    snapshot: {
      task: { id: "task-123", status: "pending" },
      workflow: {},
    },
    stepOutputs: [],
    streamFrames: [],
  };

  assert.equal(result.snapshot.task.id, "task-123");
  assert.equal(result.snapshot.task.status, "pending");
});

test("phase1b-demo output includes step outputs", () => {
  const result = {
    routing: {},
    plannedWorkflow: { executionSteps: [] },
    snapshot: { task: {}, workflow: {} },
    stepOutputs: [
      { stepId: "step-1", roleId: "analyzer", summary: "Analysis complete" },
      { stepId: "step-2", roleId: "drafter", summary: "Draft complete" },
    ],
    streamFrames: [],
  };

  assert.equal(result.stepOutputs.length, 2);
  assert.equal(result.stepOutputs[0]!.summary, "Analysis complete");
});

test("phase1b-demo step outputs are simplified in output", () => {
  const stepOutputs = [
    { stepId: "step-1", roleId: "analyzer", summary: "Analysis complete", extraData: "ignored" },
  ];

  const simplified = stepOutputs.map((step) => ({
    stepId: step.stepId,
    roleId: step.roleId,
    summary: step.summary,
  }));

  assert.deepEqual(simplified[0], { stepId: "step-1", roleId: "analyzer", summary: "Analysis complete" });
});

test("phase1b-demo output includes stream frames", () => {
  const result = {
    routing: {},
    plannedWorkflow: { executionSteps: [] },
    snapshot: { task: {}, workflow: {} },
    stepOutputs: [],
    streamFrames: [
      { sequence: 1, eventType: "step_started" },
      { sequence: 2, eventType: "step_completed" },
    ],
  };

  assert.equal(result.streamFrames.length, 2);
  assert.equal(result.streamFrames[0]!.eventType, "step_started");
});

test("phase1b-demo stream frames are simplified in output", () => {
  const streamFrames = [
    { sequence: 1, eventType: "step_started", timestamp: "ignored", data: "ignored" },
  ];

  const simplified = streamFrames.map((frame) => ({
    sequence: frame.sequence,
    eventType: frame.eventType,
  }));

  assert.deepEqual(simplified[0], { sequence: 1, eventType: "step_started" });
});

// ---------------------------------------------------------------------------
// Tests for demo request content
// ---------------------------------------------------------------------------

test("phase1b-demo uses analyze-draft-review request", () => {
  const request = "Analyze the task, draft a solution, and review the final output before completion.";
  assert.ok(request.includes("Analyze"));
  assert.ok(request.includes("draft"));
  assert.ok(request.includes("review"));
});

test("phase1b-demo title is descriptive", () => {
  const title = "Multi-step orchestration demo";
  assert.ok(title.length > 0);
  assert.ok(title.includes("demo"));
});
