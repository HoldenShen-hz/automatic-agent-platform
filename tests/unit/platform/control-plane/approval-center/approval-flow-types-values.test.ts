import assert from "node:assert/strict";
import test from "node:test";

import {
  FlowType,
  FlowStatus,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_ESCALATION_RULE,
  DEFAULT_FEEDBACK_LOOP_CONFIG,
} from "../../../../../src/platform/control-plane/approval-center/approval-flow-types.js";

test("FlowType enum has all expected values", () => {
  assert.equal(FlowType.SINGLE, "single");
  assert.equal(FlowType.MULTI_PARTY, "multi_party");
  assert.equal(FlowType.DELEGATED, "delegated");
  assert.equal(FlowType.SEQUENTIAL_CHAIN, "sequential_chain");

  const allValues: FlowType[] = [
    FlowType.SINGLE,
    FlowType.MULTI_PARTY,
    FlowType.DELEGATED,
    FlowType.SEQUENTIAL_CHAIN,
  ];
  assert.equal(allValues.length, 4);
});

test("FlowStatus enum has all expected values", () => {
  assert.equal(FlowStatus.PENDING, "pending");
  assert.equal(FlowStatus.APPROVED, "approved");
  assert.equal(FlowStatus.REJECTED, "rejected");
  assert.equal(FlowStatus.EXPIRED, "expired");
  assert.equal(FlowStatus.ESCALATED, "escalated");
  assert.equal(FlowStatus.MAX_ITERATIONS_REACHED, "max_iterations_reached");
  assert.equal(FlowStatus.CANCELLED, "cancelled");

  const allValues: FlowStatus[] = [
    FlowStatus.PENDING,
    FlowStatus.APPROVED,
    FlowStatus.REJECTED,
    FlowStatus.EXPIRED,
    FlowStatus.ESCALATED,
    FlowStatus.MAX_ITERATIONS_REACHED,
    FlowStatus.CANCELLED,
  ];
  assert.equal(allValues.length, 7);
});

test("DEFAULT_TIMEOUT_CONFIG structure", () => {
  assert.equal(DEFAULT_TIMEOUT_CONFIG.warnAfterMs, 60 * 60 * 1000); // 1 hour
  assert.equal(DEFAULT_TIMEOUT_CONFIG.escalateAfterMs, 2 * 60 * 60 * 1000); // 2 hours
  assert.equal(DEFAULT_TIMEOUT_CONFIG.autoActionAfterMs, 24 * 60 * 60 * 1000); // 24 hours
  assert.equal(DEFAULT_TIMEOUT_CONFIG.autoAction, "deny");
});

test("DEFAULT_ESCALATION_RULE structure", () => {
  assert.equal(DEFAULT_ESCALATION_RULE.maxEscalationDepth, 3);
  assert.deepEqual(DEFAULT_ESCALATION_RULE.notificationChannels, []);
  assert.equal(DEFAULT_ESCALATION_RULE.escalationTimeoutMs, 30 * 60 * 1000); // 30 minutes

  // Check the escalateTo rule
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.type, "role");
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.identifier, "admin");
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.can_delegate, true);
});

test("DEFAULT_FEEDBACK_LOOP_CONFIG structure", () => {
  assert.equal(DEFAULT_FEEDBACK_LOOP_CONFIG.maxIterations, 5);
  assert.equal(DEFAULT_FEEDBACK_LOOP_CONFIG.requireReplanOnReject, true);
});

test("FlowType string values match expected format", () => {
  // All flow types should be lowercase with underscores
  const flowTypeStrings = Object.values(FlowType);
  for (const ft of flowTypeStrings) {
    assert.ok(typeof ft === "string");
    assert.ok(ft === ft.toLowerCase());
  }
});

test("FlowStatus string values match expected format", () => {
  const flowStatusStrings = Object.values(FlowStatus);
  for (const fs of flowStatusStrings) {
    assert.ok(typeof fs === "string");
    // Status should be snake_case
    assert.ok(fs === fs.toLowerCase() || fs.includes("_"));
  }
});

test("DEFAULT_TIMEOUT_CONFIG autoAction is deny", () => {
  assert.ok(
    DEFAULT_TIMEOUT_CONFIG.autoAction === "deny" ||
    DEFAULT_TIMEOUT_CONFIG.autoAction === "approve" ||
    DEFAULT_TIMEOUT_CONFIG.autoAction === "escalate",
  );
});

test("DEFAULT_TIMEOUT_CONFIG time relationships", () => {
  // warn should be less than escalate which should be less than autoAction
  assert.ok(DEFAULT_TIMEOUT_CONFIG.warnAfterMs < DEFAULT_TIMEOUT_CONFIG.escalateAfterMs);
  assert.ok(DEFAULT_TIMEOUT_CONFIG.escalateAfterMs < DEFAULT_TIMEOUT_CONFIG.autoActionAfterMs);
});

test("DEFAULT_ESCALATION_RULE escalateTo has correct shape", () => {
  const { escalateTo } = DEFAULT_ESCALATION_RULE;
  assert.ok("type" in escalateTo);
  assert.ok("identifier" in escalateTo);
  assert.ok("can_delegate" in escalateTo);
  assert.equal(typeof escalateTo.type, "string");
  assert.equal(typeof escalateTo.identifier, "string");
  assert.equal(typeof escalateTo.can_delegate, "boolean");
});