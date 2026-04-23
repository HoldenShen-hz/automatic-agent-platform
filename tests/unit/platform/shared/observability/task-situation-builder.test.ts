/**
 * Unit tests for TaskSituationBuilder.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TaskSituationBuilder } from "../../../../../src/platform/shared/observability/task-situation-builder.js";

test("TaskSituationBuilder.build creates a valid situation", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-1",
    objective: "Deploy the application",
    currentPhase: "executing",
  });

  assert.equal(situation.taskId, "task-test-1");
  assert.equal(situation.objective, "Deploy the application");
  assert.equal(situation.currentPhase, "executing");
  assert.ok(situation.timestamp > 0);
});

test("TaskSituationBuilder.build uses default userIntent when not provided", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-2",
    objective: "Run tests",
    currentPhase: "executing",
  });

  assert.equal(situation.userIntent.raw, "Run tests");
  assert.equal(situation.userIntent.normalized, "Run tests");
  assert.equal(situation.userIntent.confidence, 0.9);
});

test("TaskSituationBuilder.build uses provided intent fields", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-3",
    objective: "Fix bug in auth module",
    currentPhase: "executing",
    userInput: "fix auth bug",
    normalizedIntent: "resolve authentication failure",
    intentConfidence: 0.75,
  });

  assert.equal(situation.userIntent.raw, "fix auth bug");
  assert.equal(situation.userIntent.normalized, "resolve authentication failure");
  assert.equal(situation.userIntent.confidence, 0.75);
});

test("TaskSituationBuilder.build handles blockers as strings", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-4",
    objective: "Complete migration",
    currentPhase: "executing",
    blockers: ["Missing environment variable", "Database not reachable"],
  });

  assert.equal(situation.blockers.length, 2);
  assert.equal(situation.blockers[0]?.description, "Missing environment variable");
  assert.equal(situation.blockers[0]?.severity, "medium");
  assert.equal(situation.blockers[1]?.severity, "medium");
});

test("TaskSituationBuilder.build handles blockers as Blocker objects", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-5",
    objective: "Deploy release",
    currentPhase: "executing",
    blockers: [
      { description: "Approval required", severity: "high" },
      { description: "Minor UI glitch", severity: "low" },
    ],
  });

  assert.equal(situation.blockers.length, 2);
  assert.equal(situation.blockers[0]?.severity, "high");
  assert.equal(situation.blockers[1]?.severity, "low");
});

test("TaskSituationBuilder.build handles fileRefs", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-6",
    objective: "Review code",
    currentPhase: "executing",
    fileRefs: ["/src/auth/login.ts", "/src/auth/logout.ts"],
  });

  assert.equal(situation.fileRefs.length, 2);
  assert.equal(situation.fileRefs[0], "/src/auth/login.ts");
});

test("TaskSituationBuilder.build uses workingDirectory", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-7",
    objective: "Build project",
    currentPhase: "executing",
    workingDirectory: "/workspace/my-project",
  });

  assert.equal(situation.codebaseSnapshot.rootPath, "/workspace/my-project");
  assert.equal(situation.environmentContext.workingDirectory, "/workspace/my-project");
});

test("TaskSituationBuilder.build handles metrics", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-8",
    objective: "Process data",
    currentPhase: "executing",
    metrics: { filesProcessed: 42, errorsEncountered: 3 },
  });

  assert.equal(situation.metrics.filesProcessed, 42);
  assert.equal(situation.metrics.errorsEncountered, 3);
});

test("TaskSituationBuilder.build handles previousTaskIds and relevantMemory", () => {
  const builder = new TaskSituationBuilder();
  const situation = builder.build({
    taskId: "task-test-9",
    objective: "Update dependencies",
    currentPhase: "executing",
    previousTaskIds: ["task-1", "task-2"],
    relevantMemory: ["memory:auth-module-v2", "memory:db-schema-v3"],
  });

  assert.deepEqual(situation.historicalContext.previousTaskIds, ["task-1", "task-2"]);
  assert.deepEqual(situation.historicalContext.relatedMemoryRefs, ["memory:auth-module-v2", "memory:db-schema-v3"]);
});