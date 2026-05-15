import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  TaskRiskLevel,
  TaskStage,
  TaskCard,
  TaskCheck,
  ReleaseStrategy,
} from "../../../../../src/platform/five-plane-execution/recovery/index.js";

test("TaskRiskLevel type accepts valid values", () => {
  const levels: TaskRiskLevel[] = ["low", "medium", "high", "critical"];
  assert.equal(levels.length, 4);
});

test("TaskStage type accepts valid values", () => {
  const stages: TaskStage[] = ["plan", "build", "review", "validate", "release"];
  assert.equal(stages.length, 5);
});

test("TaskCard structure is correct", () => {
  const card: TaskCard = {
    taskId: "task_1",
    title: "Test task",
    objective: "Complete a test",
    riskLevel: "low",
    stage: "plan",
    allowedPaths: ["/src"],
    forbiddenPaths: ["/dist", "/node_modules"],
    maxChangedFiles: 10,
    maxDiffLines: 500,
    requiredChecks: [],
    releaseStrategy: {
      requireFeatureFlag: false,
      requireHumanGate: false,
      allowedEnvironments: ["production"],
    },
    maxRepairRounds: 3,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(card.taskId, "task_1");
  assert.equal(card.riskLevel, "low");
  assert.equal(card.stage, "plan");
  assert.equal(card.maxChangedFiles, 10);
});

test("TaskCheck structure is correct", () => {
  const check: TaskCheck = {
    id: "check_1",
    name: "TypeScript type check",
    type: "typecheck",
    required: true,
  };
  assert.equal(check.id, "check_1");
  assert.equal(check.name, "TypeScript type check");
  assert.equal(check.type, "typecheck");
  assert.equal(check.required, true);
});

test("ReleaseStrategy interface structure is correct", () => {
  const strategy: ReleaseStrategy = {
    requireFeatureFlag: false,
    requireHumanGate: false,
    allowedEnvironments: ["development", "staging"],
  };
  assert.equal(strategy.requireFeatureFlag, false);
  assert.equal(strategy.requireHumanGate, false);
  assert.equal(strategy.allowedEnvironments.length, 2);
});

test("ReleaseStrategy with rollback plan", () => {
  const strategy: ReleaseStrategy = {
    requireFeatureFlag: true,
    requireHumanGate: true,
    allowedEnvironments: ["production"],
    rollbackPlan: "Immediately disable feature flag",
  };
  assert.equal(strategy.requireFeatureFlag, true);
  assert.equal(strategy.rollbackPlan, "Immediately disable feature flag");
});
