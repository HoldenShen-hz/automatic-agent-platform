import assert from "node:assert/strict";
import test from "node:test";

// HITL module barrel - re-exports HITL services
import * as hitl from "../../../../../src/platform/five-plane-orchestration/hitl/index.js";

test("hitl module exports ApprovalContextSummaryService", () => {
  assert.equal(typeof hitl.ApprovalContextSummaryService, "function");
});

test("hitl module exports HITLExplainabilityService", () => {
  assert.equal(typeof hitl.HITLExplainabilityService, "function");
});

test("hitl module exports HITL_MODES", () => {
  assert.ok(hitl.HITL_MODES !== undefined);
  assert.equal(typeof hitl.HITL_MODES, "object");
});

test("hitl module exports HitlApprovalOrchestrationService", () => {
  assert.equal(typeof hitl.HitlApprovalOrchestrationService, "function");
});

test("hitl module exports HitlInboxService", () => {
  assert.equal(typeof hitl.HitlInboxService, "function");
});

test("HitlOperatorConsoleService is exported as function", () => {
  assert.equal(typeof hitl.HitlOperatorConsoleService, "function");
});

test("HitlNotificationRoutingRule type is correctly structured", () => {
  const rule: hitl.HitlNotificationRoutingRule = {
    channel: "email",
    priority: "high",
    filter: {
      approvalType: "manual",
    },
  };
  assert.equal(rule.channel, "email");
  assert.equal(rule.priority, "high");
  assert.ok(rule.filter !== undefined);
});

test("HitlQueueFilters type is correctly structured", () => {
  const filters: hitl.HitlQueueFilters = {
    status: ["pending", "in_progress"],
    priority: "high",
    assigneeId: "user-001",
  };
  assert.ok(Array.isArray(filters.status));
  assert.equal(filters.priority, "high");
  assert.equal(filters.assigneeId, "user-001");
});

test("HitlQueueItem type is correctly structured", () => {
  const item: hitl.HitlQueueItem = {
    id: "item-001",
    taskId: "task-001",
    status: "pending",
    priority: "high",
    createdAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(item.id, "item-001");
  assert.equal(item.status, "pending");
  assert.equal(item.priority, "high");
});

test("HitlQueueStatus type works with string values", () => {
  const status: hitl.HitlQueueStatus = "pending";
  assert.equal(status, "pending");
});

test("NotificationDispatchResult type is correctly structured", () => {
  const result: hitl.NotificationDispatchResult = {
    success: true,
    channel: "email",
    dispatchedAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(result.success, true);
  assert.equal(result.channel, "email");
});

test("HitlOperatorNotificationChannel is exported and works with email", () => {
  const channel: hitl.HitlOperatorNotificationChannel = "email";
  assert.equal(channel, "email");
});

test("HitlOperatorNotificationChannel works with slack", () => {
  const channel: hitl.HitlOperatorNotificationChannel = "slack";
  assert.equal(channel, "slack");
});

test("HitlOperatorNotificationChannel works with webhook", () => {
  const channel: hitl.HitlOperatorNotificationChannel = "webhook";
  assert.equal(channel, "webhook");
});

test("HitlQueueItem with in_progress status", () => {
  const item: hitl.HitlQueueItem = {
    id: "item-002",
    taskId: "task-002",
    status: "in_progress",
    priority: "medium",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T11:00:00Z",
  };
  assert.equal(item.status, "in_progress");
  assert.ok(item.updatedAt !== undefined);
});

test("HitlQueueItem with completed status", () => {
  const item: hitl.HitlQueueItem = {
    id: "item-003",
    taskId: "task-003",
    status: "completed",
    priority: "low",
    createdAt: "2024-01-15T10:00:00Z",
    completedAt: "2024-01-15T12:00:00Z",
  };
  assert.equal(item.status, "completed");
  assert.ok(item.completedAt !== undefined);
});

test("NotificationDispatchResult with failure", () => {
  const result: hitl.NotificationDispatchResult = {
    success: false,
    channel: "slack",
    dispatchedAt: "2024-01-15T10:00:00Z",
    error: "webhook_timeout",
  };
  assert.equal(result.success, false);
  assert.equal(result.error, "webhook_timeout");
});

test("HitlQueueFilters with minimal config", () => {
  const filters: hitl.HitlQueueFilters = {};
  assert.ok(filters.status === undefined);
  assert.ok(filters.priority === undefined);
});

test("validateHitlModeRequest is exported as function", () => {
  assert.equal(typeof hitl.validateHitlModeRequest, "function");
});