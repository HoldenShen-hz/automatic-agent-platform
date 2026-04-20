import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskCard,
  validateTaskCard,
  type TaskCard,
  type TaskRiskLevel,
  type TaskStage,
} from "../../../../../src/platform/execution/recovery/task-card.js";

test("createTaskCard creates card with defaults", () => {
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "low",
  });

  assert.equal(card.taskId, "task_1");
  assert.equal(card.title, "Test Task");
  assert.equal(card.objective, "Do something");
  assert.equal(card.riskLevel, "low");
  assert.equal(card.stage, "plan");
  assert.deepEqual(card.allowedPaths, ["*"]);
  assert.deepEqual(card.forbiddenPaths, ["**/secrets/**", "**/auth/**", "**/billing/**"]);
  assert.equal(card.maxChangedFiles, 10);
  assert.equal(card.maxDiffLines, 300);
  assert.deepEqual(card.requiredChecks, []);
  assert.equal(card.maxRepairRounds, 2);
  assert.ok(card.createdAt);
});

test("createTaskCard applies risk-based defaults for low risk", () => {
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "low",
  });

  assert.equal(card.maxChangedFiles, 10);
  assert.equal(card.maxDiffLines, 300);
  assert.equal(card.maxRepairRounds, 2);
  assert.deepEqual(card.releaseStrategy.allowedEnvironments, ["development", "staging", "production"]);
  assert.equal(card.releaseStrategy.requireFeatureFlag, false);
  assert.equal(card.releaseStrategy.requireHumanGate, false);
});

test("createTaskCard applies risk-based defaults for medium risk", () => {
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "medium",
  });

  assert.equal(card.maxChangedFiles, 10);
  assert.equal(card.maxDiffLines, 300);
  assert.equal(card.maxRepairRounds, 2);
  assert.deepEqual(card.releaseStrategy.allowedEnvironments, ["development", "staging"]);
  assert.equal(card.releaseStrategy.requireFeatureFlag, true);
  assert.equal(card.releaseStrategy.requireHumanGate, false);
});

test("createTaskCard applies risk-based defaults for high risk", () => {
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "high",
  });

  assert.equal(card.maxChangedFiles, 3);
  assert.equal(card.maxDiffLines, 100);
  assert.equal(card.maxRepairRounds, 1);
  assert.deepEqual(card.releaseStrategy.allowedEnvironments, ["development"]);
  assert.equal(card.releaseStrategy.requireFeatureFlag, true);
  assert.equal(card.releaseStrategy.requireHumanGate, true);
});

test("createTaskCard applies risk-based defaults for critical risk", () => {
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "critical",
  });

  assert.equal(card.maxChangedFiles, 1);
  assert.equal(card.maxDiffLines, 50);
  assert.equal(card.maxRepairRounds, 0);
  assert.deepEqual(card.releaseStrategy.allowedEnvironments, ["development"]);
  assert.equal(card.releaseStrategy.requireFeatureFlag, true);
  assert.equal(card.releaseStrategy.requireHumanGate, true);
});

test("createTaskCard allows custom overrides", () => {
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "low",
    allowedPaths: ["/src"],
    forbiddenPaths: ["/secrets"],
    maxChangedFiles: 5,
    maxDiffLines: 200,
    requiredChecks: [{ id: "check_1", name: "Lint", required: true, type: "lint" }],
    maxRepairRounds: 3,
  });

  assert.deepEqual(card.allowedPaths, ["/src"]);
  assert.deepEqual(card.forbiddenPaths, ["/secrets"]);
  assert.equal(card.maxChangedFiles, 5);
  assert.equal(card.maxDiffLines, 200);
  assert.equal(card.requiredChecks.length, 1);
  assert.equal(card.maxRepairRounds, 3);
});

test("createTaskCard includes deadline when provided", () => {
  const deadline = "2025-12-31T23:59:59.000Z";
  const card = createTaskCard({
    taskId: "task_1",
    title: "Test Task",
    objective: "Do something",
    riskLevel: "low",
    deadlineAt: deadline,
  });

  assert.equal(card.deadlineAt, deadline);
});

test("validateTaskCard returns valid for correct card", () => {
  const card: TaskCard = {
    taskId: "task_1",
    title: "Test",
    objective: "Test",
    riskLevel: "low",
    stage: "plan",
    allowedPaths: ["*"],
    forbiddenPaths: [],
    maxChangedFiles: 5,
    maxDiffLines: 100,
    requiredChecks: [],
    releaseStrategy: {
      requireFeatureFlag: false,
      requireHumanGate: false,
      allowedEnvironments: ["development"],
    },
    maxRepairRounds: 2,
    createdAt: new Date().toISOString(),
  };

  const result = validateTaskCard(card);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateTaskCard returns errors for missing fields", () => {
  const card: TaskCard = {
    taskId: "",
    title: "Test",
    objective: "",
    riskLevel: "low",
    stage: "plan",
    allowedPaths: ["*"],
    forbiddenPaths: [],
    maxChangedFiles: 5,
    maxDiffLines: 100,
    requiredChecks: [],
    releaseStrategy: {
      requireFeatureFlag: false,
      requireHumanGate: false,
      allowedEnvironments: ["development"],
    },
    maxRepairRounds: 2,
    createdAt: new Date().toISOString(),
  };

  const result = validateTaskCard(card);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("validateTaskCard returns errors for invalid numbers", () => {
  const card: TaskCard = {
    taskId: "task_1",
    title: "Test",
    objective: "Test",
    riskLevel: "low",
    stage: "plan",
    allowedPaths: ["*"],
    forbiddenPaths: [],
    maxChangedFiles: 0, // invalid
    maxDiffLines: 100,
    requiredChecks: [],
    releaseStrategy: {
      requireFeatureFlag: false,
      requireHumanGate: false,
      allowedEnvironments: ["development"],
    },
    maxRepairRounds: 2,
    createdAt: new Date().toISOString(),
  };

  const result = validateTaskCard(card);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("maxChangedFiles")));
});

test("validateTaskCard returns errors for negative repair rounds", () => {
  const card: TaskCard = {
    taskId: "task_1",
    title: "Test",
    objective: "Test",
    riskLevel: "low",
    stage: "plan",
    allowedPaths: ["*"],
    forbiddenPaths: [],
    maxChangedFiles: 5,
    maxDiffLines: 100,
    requiredChecks: [],
    releaseStrategy: {
      requireFeatureFlag: false,
      requireHumanGate: false,
      allowedEnvironments: ["development"],
    },
    maxRepairRounds: -1, // invalid
    createdAt: new Date().toISOString(),
  };

  const result = validateTaskCard(card);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("maxRepairRounds")));
});

test("TaskRiskLevel type accepts all valid values", () => {
  const levels: TaskRiskLevel[] = ["low", "medium", "high", "critical"];
  assert.equal(levels.length, 4);
});

test("TaskStage type accepts all valid values", () => {
  const stages: TaskStage[] = ["plan", "build", "review", "validate", "release"];
  assert.equal(stages.length, 5);
});
