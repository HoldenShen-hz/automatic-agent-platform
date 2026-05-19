import assert from "node:assert/strict";
import test from "node:test";

import { PolicyEngine } from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import { ApprovalPolicyEngine, DEFAULT_APPROVAL_POLICY_BUNDLE } from "../../../../../src/platform/control-plane/approval-center/approval-policy-engine/index.js";
import type { PolicyDecisionRequest } from "../../../../../src/platform/control-plane/iam/policy-engine.js";

/**
 * Integration test: Policy Engine + Approval Policy Engine
 *
 * Tests the flow where:
 * 1. PolicyEngine evaluates a request and determines if approval is needed
 * 2. ApprovalPolicyEngine determines the specific approval rules
 */
test("policy-engine integrates with approval-policy-engine for high-risk supervised", (t, done) => {
  const policyEngine = new PolicyEngine({
    budgetPolicy: {
      scope: "platform",
      scopeId: "integration-test",
      limitCostUsd: 10000,
      limitTokens: 1000000,
      warningThreshold: 0.8,
      period: "monthly",
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  });

  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const request: PolicyDecisionRequest = {
    decisionId: "integration-001",
    taskId: "task-high-risk",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
  };

  // Step 1: Policy engine evaluates
  const policyResult = policyEngine.evaluate(request);
  assert.equal(policyResult.decision, "escalate_for_approval");

  // Step 2: Approval engine evaluates for specific rules
  const approvalResult = approvalEngine.evaluate({
    decisionId: request.decisionId,
    taskId: request.taskId,
    subjectType: request.subjectType,
    subjectId: request.subjectId,
    action: request.action,
    riskCategory: request.riskCategory,
    mode: request.mode,
    stage: "execute",
  });

  assert.equal(approvalResult.requiresApproval, true);

  done();
});

test("policy-engine integrates with approval-policy-engine for org change", (t, done) => {
  const policyEngine = new PolicyEngine({
    budgetPolicy: {
      scope: "platform",
      scopeId: "integration-test",
      limitCostUsd: 10000,
      limitTokens: 1000000,
      warningThreshold: 0.8,
      period: "monthly",
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  });

  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const request: PolicyDecisionRequest = {
    decisionId: "integration-002",
    taskId: "task-org-change",
    subjectType: "user",
    subjectId: "admin-1",
    action: "org_change",
    riskCategory: "org_changing",
    mode: "auto",
  };

  const policyResult = policyEngine.evaluate(request);
  assert.equal(policyResult.decision, "escalate_for_approval");

  const approvalResult = approvalEngine.evaluate({
    decisionId: request.decisionId,
    taskId: request.taskId,
    subjectType: request.subjectType,
    subjectId: request.subjectId,
    action: request.action,
    riskCategory: request.riskCategory,
    mode: request.mode,
    stage: "execute",
  });

  assert.equal(approvalResult.requiresApproval, true);
  assert.equal(approvalResult.matchedRuleIds.includes("org-change-approval"), true);

  done();
});

test("policy-engine allows safe action in full-auto mode", (t, done) => {
  const policyEngine = new PolicyEngine({
    budgetPolicy: {
      scope: "platform",
      scopeId: "integration-test",
      limitCostUsd: 10000,
      limitTokens: 1000000,
      warningThreshold: 0.8,
      period: "monthly",
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  });

  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const request: PolicyDecisionRequest = {
    decisionId: "integration-003",
    taskId: "task-safe",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "sensitive_data",
    mode: "full-auto",
    estimatedCostUsd: 5,
  };

  const policyResult = policyEngine.evaluate(request);
  assert.ok(["allow", "allow_with_constraints"].includes(policyResult.decision));

  // Approval engine should not require approval for safe action
  const approvalResult = approvalEngine.evaluate({
    decisionId: request.decisionId,
    taskId: request.taskId,
    subjectType: request.subjectType,
    subjectId: request.subjectId,
    action: request.action,
    riskCategory: request.riskCategory,
    mode: request.mode,
    stage: "execute",
    estimatedCostUsd: request.estimatedCostUsd,
  });

  assert.equal(approvalResult.requiresApproval, false);

  done();
});

test("policy-engine budget check blocks over-budget action", (t, done) => {
  const policyEngine = new PolicyEngine({
    budgetPolicy: {
      scope: "platform",
      scopeId: "integration-test",
      limitCostUsd: 10, // Very low limit
      limitTokens: 1000,
      warningThreshold: 0.8,
      period: "monthly",
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  });

  const request: PolicyDecisionRequest = {
    decisionId: "integration-004",
    taskId: "task-over-budget",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    estimatedCostUsd: 1000, // Way over budget
  };

  const policyResult = policyEngine.evaluate(request);
  assert.equal(policyResult.decision, "deny");
  assert.equal(policyResult.reasonCode, "budget.denied");

  done();
});

test("approval-policy-engine lint finds issues in custom bundle", (t, done) => {
  const customBundle = {
    bundleId: "custom-test",
    version: "1.0.0",
    name: "Custom Test Policies",
    description: "Test bundle for integration testing",
    enabled: true,
    rules: [
      {
        ruleId: "duplicate-id-check",
        description: "First rule",
        priority: 100,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "invoke_model" }],
        action: "require_approval" as const,
      },
      {
        ruleId: "duplicate-id-check", // Duplicate!
        description: "Second rule",
        priority: 50,
        enabled: true,
        conditions: [{ field: "mode", operator: "eq", value: "auto" }],
        action: "allow" as const,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const engine = new ApprovalPolicyEngine(customBundle);
  const lintResult = engine.lint();

  assert.equal(lintResult.valid, false);
  assert.ok(lintResult.errors.some((e) => e.code === "duplicate_rule_id"));

  done();
});

test("approval-policy-engine evaluates high-cost with metadata", (t, done) => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const result = engine.evaluate({
    decisionId: "cost-test-001",
    taskId: "task-high-cost",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 200,
    metadata: {
      batchSize: 1000,
      priority: "high",
    },
  });

  // High cost ($200 >= $100) triggers approval
  assert.equal(result.requiresApproval, true);
  assert.equal(result.matchedRuleIds.includes("high-cost-approval"), true);

  done();
});