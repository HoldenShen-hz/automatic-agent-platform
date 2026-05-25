/**
 * Unit tests for autonomy-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  AutonomyService,
  type AutonomyLevelRequest,
  type EscalationRequest,
} from "../../../src/interaction/autonomy/autonomy-service.js";

test("AutonomyService.determineLevel returns 'manual' for riskScore >= 80", () => {
  const service = new AutonomyService();

  const result = service.determineLevel({
    taskId: "task-1",
    taskType: "deploy",
    riskScore: 85,
    userId: "user-1",
  });

  assert.equal(result.level, "manual");
  assert.equal(result.taskId, "task-1");
  assert.ok(result.reason.includes("risk_score=85"));
});

test("AutonomyService.determineLevel returns 'supervised' for riskScore >= 60 and < 80", () => {
  const service = new AutonomyService();

  const result = service.determineLevel({
    taskId: "task-2",
    taskType: "query",
    riskScore: 65,
    userId: "user-2",
  });

  assert.equal(result.level, "supervised");
  assert.ok(result.reason.includes("risk_score=65"));
});

test("AutonomyService.determineLevel raises high-risk task types even when base risk is moderate", () => {
  const service = new AutonomyService();

  const deployResult = service.determineLevel({
    taskId: "task-deploy-risk",
    taskType: "deploy",
    riskScore: 45,
    userId: "user-2",
  });
  assert.equal(deployResult.level, "supervised");
  assert.ok(deployResult.reason.includes("effective_risk_score=65"));

  const approvalResult = service.determineLevel({
    taskId: "task-approval-risk",
    taskType: "approval_action",
    riskScore: 58,
    userId: "user-3",
  });
  assert.equal(approvalResult.level, "manual");
  assert.ok(approvalResult.reason.includes("effective_risk_score=83"));
});

test("AutonomyService.determineLevel returns 'semi_auto' for riskScore >= 40 and < 60", () => {
  const service = new AutonomyService();

  const result = service.determineLevel({
    taskId: "task-3",
    taskType: "report",
    riskScore: 45,
    userId: "user-3",
  });

  assert.equal(result.level, "semi_auto");
  assert.ok(result.reason.includes("risk_score=45"));
});

test("AutonomyService.determineLevel returns 'auto' for riskScore < 40", () => {
  const service = new AutonomyService();

  const result = service.determineLevel({
    taskId: "task-4",
    taskType: "query",
    riskScore: 30,
    userId: "user-4",
  });

  assert.equal(result.level, "auto");
  assert.ok(result.reason.includes("risk_score=30"));
});

test("AutonomyService.determineLevel includes timestamp and actor", () => {
  const service = new AutonomyService();

  const result = service.determineLevel({
    taskId: "task-5",
    taskType: "report",
    riskScore: 20,
    userId: "actor-123",
  });

  assert.ok(result.timestamp.length > 0);
  assert.equal(result.actor, "actor-123");
  assert.ok(result.decisionId.includes("autonomy_task-5"));
});

test("AutonomyService.escalate returns escalation result", () => {
  const service = new AutonomyService();

  const result = service.escalate({
    taskId: "task-escalated",
    reason: "operator request",
    targetLevel: "full_auto",
  });

  assert.equal(result.taskId, "task-escalated");
  assert.equal(result.previousLevel, "auto");
  assert.equal(result.newLevel, "full_auto");
  assert.equal(result.reason, "operator request");
  assert.ok(result.escalatedAt.length > 0);
});

test("AutonomyService.escalate supports different target levels", () => {
  const service = new AutonomyService();

  const result1 = service.escalate({
    taskId: "task-1",
    reason: "test",
    targetLevel: "manual",
  });
  assert.equal(result1.newLevel, "manual");

  const result2 = service.escalate({
    taskId: "task-2",
    reason: "test",
    targetLevel: "supervised",
  });
  assert.equal(result2.newLevel, "supervised");

  const result3 = service.escalate({
    taskId: "task-3",
    reason: "test",
    targetLevel: "semi_auto",
  });
  assert.equal(result3.newLevel, "semi_auto");

  const result4 = service.escalate({
    taskId: "task-4",
    reason: "test",
    targetLevel: "auto",
  });
  assert.equal(result4.newLevel, "auto");
});

test("AutonomyService handles boundary risk scores", () => {
  const service = new AutonomyService();

  assert.equal(service.determineLevel({ taskId: "t1", taskType: "t", riskScore: 80, userId: "u1" }).level, "manual");
  assert.equal(service.determineLevel({ taskId: "t2", taskType: "t", riskScore: 79, userId: "u1" }).level, "supervised");
  assert.equal(service.determineLevel({ taskId: "t3", taskType: "t", riskScore: 60, userId: "u1" }).level, "supervised");
  assert.equal(service.determineLevel({ taskId: "t4", taskType: "t", riskScore: 59, userId: "u1" }).level, "semi_auto");
  assert.equal(service.determineLevel({ taskId: "t5", taskType: "t", riskScore: 40, userId: "u1" }).level, "semi_auto");
  assert.equal(service.determineLevel({ taskId: "t6", taskType: "t", riskScore: 39, userId: "u1" }).level, "auto");
});
