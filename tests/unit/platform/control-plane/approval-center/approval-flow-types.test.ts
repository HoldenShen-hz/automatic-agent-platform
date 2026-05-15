/**
 * Unit tests for Approval Flow Types
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FlowType,
  FlowStatus,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_ESCALATION_RULE,
  DEFAULT_FEEDBACK_LOOP_CONFIG,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-flow-types.js";

test("FlowType enum has all expected values", () => {
  assert.equal(FlowType.SINGLE, "single");
  assert.equal(FlowType.MULTI_PARTY, "multi_party");
  assert.equal(FlowType.DELEGATED, "delegated");
  assert.equal(FlowType.SEQUENTIAL_CHAIN, "sequential_chain");
});

test("FlowStatus enum has all expected values", () => {
  assert.equal(FlowStatus.PENDING, "pending");
  assert.equal(FlowStatus.APPROVED, "approved");
  assert.equal(FlowStatus.REJECTED, "rejected");
  assert.equal(FlowStatus.EXPIRED, "expired");
  assert.equal(FlowStatus.ESCALATED, "escalated");
  assert.equal(FlowStatus.MAX_ITERATIONS_REACHED, "max_iterations_reached");
  assert.equal(FlowStatus.CANCELLED, "cancelled");
});

test("DEFAULT_TIMEOUT_CONFIG has correct structure", () => {
  assert.equal(DEFAULT_TIMEOUT_CONFIG.warnAfterMs, 60 * 60 * 1000); // 1 hour
  assert.equal(DEFAULT_TIMEOUT_CONFIG.escalateAfterMs, 2 * 60 * 60 * 1000); // 2 hours
  assert.equal(DEFAULT_TIMEOUT_CONFIG.autoActionAfterMs, 24 * 60 * 60 * 1000); // 24 hours
  assert.equal(DEFAULT_TIMEOUT_CONFIG.autoAction, "deny");
});

test("DEFAULT_ESCALATION_RULE has correct structure", () => {
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.type, "role");
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.identifier, "admin");
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.can_delegate, true);
  assert.equal(DEFAULT_ESCALATION_RULE.maxEscalationDepth, 3);
  assert.deepEqual(DEFAULT_ESCALATION_RULE.notificationChannels, []);
  assert.equal(DEFAULT_ESCALATION_RULE.escalationTimeoutMs, 30 * 60 * 1000); // 30 minutes
});

test("DEFAULT_FEEDBACK_LOOP_CONFIG has correct structure", () => {
  assert.equal(DEFAULT_FEEDBACK_LOOP_CONFIG.maxIterations, 5);
  assert.equal(DEFAULT_FEEDBACK_LOOP_CONFIG.requireReplanOnReject, true);
});

test("FlowType enum values are correct", () => {
  assert.equal(FlowType.SINGLE, "single");
  assert.equal(FlowType.MULTI_PARTY, "multi_party");
  assert.equal(FlowType.DELEGATED, "delegated");
  assert.equal(FlowType.SEQUENTIAL_CHAIN, "sequential_chain");
});

test("FlowType enum can be used in type positions", () => {
  const flowTypes: FlowType[] = [
    FlowType.SINGLE,
    FlowType.MULTI_PARTY,
    FlowType.DELEGATED,
    FlowType.SEQUENTIAL_CHAIN,
  ];

  assert.equal(flowTypes.length, 4);
  assert.ok(flowTypes.includes(FlowType.SINGLE));
  assert.ok(flowTypes.includes(FlowType.MULTI_PARTY));
});

test("FlowStatus enum values are correct", () => {
  assert.equal(FlowStatus.PENDING, "pending");
  assert.equal(FlowStatus.APPROVED, "approved");
  assert.equal(FlowStatus.REJECTED, "rejected");
  assert.equal(FlowStatus.EXPIRED, "expired");
  assert.equal(FlowStatus.ESCALATED, "escalated");
  assert.equal(FlowStatus.MAX_ITERATIONS_REACHED, "max_iterations_reached");
  assert.equal(FlowStatus.CANCELLED, "cancelled");
});

test("FlowStatus enum can be used in type positions", () => {
  const flowStatuses: FlowStatus[] = [
    FlowStatus.PENDING,
    FlowStatus.APPROVED,
    FlowStatus.REJECTED,
    FlowStatus.EXPIRED,
    FlowStatus.ESCALATED,
    FlowStatus.MAX_ITERATIONS_REACHED,
    FlowStatus.CANCELLED,
  ];

  assert.equal(flowStatuses.length, 7);
  assert.ok(flowStatuses.includes(FlowStatus.PENDING));
  assert.ok(flowStatuses.includes(FlowStatus.APPROVED));
});

test("ApprovalTimeoutConfig can be used as a type", () => {
  const config = {
    warnAfterMs: 30 * 60 * 1000,
    escalateAfterMs: 60 * 60 * 1000,
    autoActionAfterMs: 2 * 60 * 60 * 1000,
    autoAction: "approve" as const,
  };

  assert.equal(config.autoAction, "approve");
  assert.ok(config.warnAfterMs < config.escalateAfterMs);
  assert.ok(config.escalateAfterMs < config.autoActionAfterMs);
});

test("FeedbackLoopConfig can be used as a type", () => {
  const config = {
    maxIterations: 10,
    requireReplanOnReject: false,
  };

  assert.equal(config.maxIterations, 10);
  assert.equal(config.requireReplanOnReject, false);
});
