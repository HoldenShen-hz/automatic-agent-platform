import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for orchestration module types
import {
  AgentTeamService,
  IntakeRouter,
  WorkflowPlanner,
  AgentTeamStage,
  AgentModelTier,
  AgentTeamLane,
  AgentTeamPlan,
  IntakeIntent,
  IntakeContinuation,
  IntakeIntentClassification,
} from "../../../../../src/platform/orchestration/routing/index.js";

test("AgentTeamStage type accepts valid values", () => {
  const stages: AgentTeamStage[] = ["plan", "build", "review", "validate", "repair", "release"];
  assert.equal(stages.length, 6);
});

test("AgentModelTier type accepts valid values", () => {
  const tiers: AgentModelTier[] = ["cheap", "standard", "strong"];
  assert.equal(tiers.length, 3);
});

test("AgentTeamLane structure is correct", () => {
  const lane: AgentTeamLane = {
    laneId: "lane_1",
    stage: "build",
    ownerRoleId: "coder",
    agentId: "agent_123",
    modelTier: "standard",
    responsibilities: ["write code", "fix bugs"],
    allowedTools: ["read", "edit", "write"],
  };
  assert.equal(lane.laneId, "lane_1");
  assert.equal(lane.stage, "build");
  assert.equal(lane.modelTier, "standard");
  assert.equal(lane.responsibilities.length, 2);
});

test("AgentTeamPlan structure is correct", () => {
  const plan: AgentTeamPlan = {
    teamId: "team_123",
    taskId: "task_456",
    workflowId: "workflow_789",
    riskLevel: "medium",
    lanes: [],
    executionLoop: ["build", "review"],
  };
  assert.equal(plan.teamId, "team_123");
  assert.equal(plan.riskLevel, "medium");
  assert.deepEqual(plan.executionLoop, ["build", "review"]);
});

test("IntakeIntent type accepts valid values", () => {
  const intents: IntakeIntent[] = [
    "query",
    "create",
    "modify",
    "approve",
    "cancel",
    "clarify",
    "chitchat",
    "correction",
  ];
  assert.equal(intents.length, 8);
});

test("IntakeContinuation type accepts valid values", () => {
  const continuations: IntakeContinuation[] = ["new_task", "follow_up", "correction"];
  assert.equal(continuations.length, 3);
});

test("IntakeIntentClassification structure is correct", () => {
  const classification: IntakeIntentClassification = {
    intent: "create",
    continuation: "new_task",
    confidence: 0.95,
    matchedRules: ["rule_1", "rule_2"],
  };
  assert.equal(classification.intent, "create");
  assert.equal(classification.continuation, "new_task");
  assert.equal(classification.confidence, 0.95);
  assert.equal(classification.matchedRules.length, 2);
});

test("orchestration barrel exports core services", () => {
  assert.equal(typeof AgentTeamService, "function");
  assert.equal(typeof IntakeRouter, "function");
  assert.equal(typeof WorkflowPlanner, "function");
});
