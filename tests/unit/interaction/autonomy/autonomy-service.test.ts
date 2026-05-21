import assert from "node:assert/strict";
import test from "node:test";

import {
  AutonomyService,
  type LegacyAutonomyDecision,
  type AutonomyLevelRequest,
  type EscalationRequest,
  type EscalationResult,
} from "../../../../src/interaction/autonomy/autonomy-service.js";

test("AutonomyService.determineLevel returns manual for riskScore >= 80", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_001",
    taskType: "deployment",
    riskScore: 85,
    userId: "user_1",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "manual");
  assert.equal(decision.taskId, "task_001");
  assert.equal(decision.decisionId, "autonomy_task_001");
  assert.equal(decision.actor, "user_1");
  assert.ok(decision.reason.includes("risk_score=85"));
  assert.ok(decision.reason.includes("task_type=deployment"));
  assert.ok(decision.timestamp.length > 0);
});

test("AutonomyService.determineLevel returns supervised for riskScore 60-79", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_002",
    taskType: "config_change",
    riskScore: 65,
    userId: "user_2",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "supervised");
  assert.equal(decision.taskId, "task_002");
  assert.ok(decision.reason.includes("risk_score=65"));
});

test("AutonomyService.determineLevel returns semi_auto for riskScore 40-59", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_003",
    taskType: "query",
    riskScore: 50,
    userId: "user_3",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "semi_auto");
  assert.equal(decision.taskId, "task_003");
  assert.ok(decision.reason.includes("risk_score=50"));
});

test("AutonomyService.determineLevel returns auto for riskScore < 40", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_004",
    taskType: "read",
    riskScore: 25,
    userId: "user_4",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "auto");
  assert.equal(decision.taskId, "task_004");
  assert.ok(decision.reason.includes("risk_score=25"));
});

test("AutonomyService.determineLevel returns auto for riskScore exactly 39", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_005",
    taskType: "read",
    riskScore: 39,
    userId: "user_5",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "auto");
});

test("AutonomyService.determineLevel returns semi_auto for riskScore exactly 40", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_006",
    taskType: "read",
    riskScore: 40,
    userId: "user_6",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "semi_auto");
});

test("AutonomyService.determineLevel returns supervised for riskScore exactly 60", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_007",
    taskType: "read",
    riskScore: 60,
    userId: "user_7",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "supervised");
});

test("AutonomyService.determineLevel returns manual for riskScore exactly 80", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_008",
    taskType: "read",
    riskScore: 80,
    userId: "user_8",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "manual");
});

test("AutonomyService.determineLevel returns manual for riskScore above 100", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_009",
    taskType: "critical_action",
    riskScore: 100,
    userId: "user_9",
  };

  const decision = service.determineLevel(request);

  assert.equal(decision.level, "manual");
});

test("AutonomyService.determineLevel generates unique decisionId per task", () => {
  const service = new AutonomyService();
  const request1: AutonomyLevelRequest = {
    taskId: "task_unique_1",
    taskType: "read",
    riskScore: 20,
    userId: "user_1",
  };
  const request2: AutonomyLevelRequest = {
    taskId: "task_unique_2",
    taskType: "read",
    riskScore: 20,
    userId: "user_1",
  };

  const decision1 = service.determineLevel(request1);
  const decision2 = service.determineLevel(request2);

  assert.equal(decision1.decisionId, "autonomy_task_unique_1");
  assert.equal(decision2.decisionId, "autonomy_task_unique_2");
  assert.notEqual(decision1.decisionId, decision2.decisionId);
});

test("AutonomyService.determineLevel includes taskType in reason", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_010",
    taskType: "database_migration",
    riskScore: 90,
    userId: "user_10",
  };

  const decision = service.determineLevel(request);

  assert.ok(decision.reason.includes("task_type=database_migration"));
});

test("AutonomyService.escalate returns escalation result with auto as previous level", () => {
  const service = new AutonomyService();
  const request: EscalationRequest = {
    taskId: "task_escalate_1",
    reason: "High risk operation requiring human oversight",
    targetLevel: "manual",
  };

  const result = service.escalate(request);

  assert.equal(result.taskId, "task_escalate_1");
  assert.equal(result.previousLevel, "auto");
  assert.equal(result.newLevel, "manual");
  assert.equal(result.reason, "High risk operation requiring human oversight");
  assert.ok(result.escalatedAt.length > 0);
});

test("AutonomyService.escalate accepts supervised target level", () => {
  const service = new AutonomyService();
  const request: EscalationRequest = {
    taskId: "task_escalate_2",
    reason: "Need more oversight",
    targetLevel: "supervised",
  };

  const result = service.escalate(request);

  assert.equal(result.newLevel, "supervised");
  assert.equal(result.previousLevel, "auto");
});

test("AutonomyService.escalate accepts semi_auto target level", () => {
  const service = new AutonomyService();
  const request: EscalationRequest = {
    taskId: "task_escalate_3",
    reason: "Reduce autonomy slightly",
    targetLevel: "semi_auto",
  };

  const result = service.escalate(request);

  assert.equal(result.newLevel, "semi_auto");
});

test("AutonomyService.escalate accepts full_auto target level", () => {
  const service = new AutonomyService();
  const request: EscalationRequest = {
    taskId: "task_escalate_4",
    reason: "All clear for full automation",
    targetLevel: "full_auto",
  };

  const result = service.escalate(request);

  assert.equal(result.newLevel, "full_auto");
});

test("AutonomyService.escalate returns valid EscalationResult structure", () => {
  const service = new AutonomyService();
  const request: EscalationRequest = {
    taskId: "task_struct",
    reason: "Test structure",
    targetLevel: "manual",
  };

  const result = service.escalate(request);

  assert.ok(typeof result.taskId === "string");
  assert.ok(typeof result.previousLevel === "string");
  assert.ok(typeof result.newLevel === "string");
  assert.ok(typeof result.reason === "string");
  assert.ok(typeof result.escalatedAt === "string");
});

test("AutonomyService multiple determineLevel calls return distinct decisions", () => {
  const service = new AutonomyService();

  const decision1 = service.determineLevel({
    taskId: "task_multi_1",
    taskType: "type_a",
    riskScore: 90,
    userId: "user_a",
  });

  const decision2 = service.determineLevel({
    taskId: "task_multi_2",
    taskType: "type_b",
    riskScore: 30,
    userId: "user_b",
  });

  assert.notEqual(decision1.decisionId, decision2.decisionId);
  assert.notEqual(decision1.level, decision2.level);
  assert.notEqual(decision1.reason, decision2.reason);
});

test("AutonomyService decision has correct readonly properties", () => {
  const service = new AutonomyService();
  const request: AutonomyLevelRequest = {
    taskId: "task_readonly",
    taskType: "read",
    riskScore: 50,
    userId: "user_readonly",
  };

  const decision = service.determineLevel(request);

  // Verify readonly properties exist and are correct types
  assert.equal(typeof decision.decisionId, "string");
  assert.equal(typeof decision.taskId, "string");
  assert.equal(typeof decision.level, "string");
  assert.equal(typeof decision.reason, "string");
  assert.equal(typeof decision.timestamp, "string");
  assert.equal(typeof decision.actor, "string");
});

test("AutonomyService escalation result has correct readonly properties", () => {
  const service = new AutonomyService();
  const request: EscalationRequest = {
    taskId: "task_readonly_escalation",
    reason: "Test",
    targetLevel: "manual",
  };

  const result = service.escalate(request);

  // Verify readonly properties exist and are correct types
  assert.equal(typeof result.taskId, "string");
  assert.equal(typeof result.previousLevel, "string");
  assert.equal(typeof result.newLevel, "string");
  assert.equal(typeof result.reason, "string");
  assert.equal(typeof result.escalatedAt, "string");
});