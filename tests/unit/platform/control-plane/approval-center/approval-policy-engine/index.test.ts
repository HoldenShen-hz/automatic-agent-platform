/**
 * Unit tests for Approval Policy Engine
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ApprovalPolicyEngine,
  PolicyVersionManager,
  DEFAULT_APPROVAL_POLICY_BUNDLE,
  type ApprovalPolicyBundle,
  type ApprovalPolicyContext,
  type VersionedPolicyBundle,
} from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/index.js";

test("ApprovalPolicyEngine evaluates default policy for destructive action", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-1",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
  };

  const result = engine.evaluate(context);

  assert.equal(result.requiresApproval, false);
  assert.equal(result.deny, true);
  assert.ok(result.matchedRuleIds.includes("critical-action-deny"));
});

test("ApprovalPolicyEngine denies critical destructive in auto mode", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-2",
    taskId: "task-2",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "exec_command",
    riskCategory: "destructive",
    mode: "auto",
    stage: "execute",
  };

  const result = engine.evaluate(context);

  assert.equal(result.deny, true);
  assert.equal(result.requiresApproval, false);
});

test("ApprovalPolicyEngine requires approval for high cost", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-3",
    taskId: "task-3",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 150,
  };

  const result = engine.evaluate(context);

  assert.equal(result.requiresApproval, true);
});

test("ApprovalPolicyEngine allows low-cost actions without approval", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-4",
    taskId: "task-4",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 10,
  };

  const result = engine.evaluate(context);

  assert.equal(result.requiresApproval, false);
  assert.equal(result.deny, false);
});

test("ApprovalPolicyEngine matches rules by priority", () => {
  const bundle: ApprovalPolicyBundle = {
    bundleId: "test-policies",
    version: "1.0.0",
    name: "Test Policies",
    description: "Test bundle",
    enabled: true,
    rules: [
      {
        ruleId: "low-priority-allow",
        description: "Low priority allow",
        priority: 10,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "invoke_model" }],
        action: "allow",
      },
      {
        ruleId: "high-priority-deny",
        description: "High priority deny",
        priority: 100,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "invoke_model" }],
        action: "deny",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const engine = new ApprovalPolicyEngine(bundle);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-5",
    taskId: "task-5",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
  };

  const result = engine.evaluate(context);

  assert.equal(result.deny, true);
  assert.ok(result.matchedRuleIds.includes("high-priority-deny"));
});

test("ApprovalPolicyEngine respects condition operators", () => {
  const bundle: ApprovalPolicyBundle = {
    bundleId: "test-operators",
    version: "1.0.0",
    name: "Operator Test",
    description: "Test operators",
    enabled: true,
    rules: [
      {
        ruleId: "in-test",
        description: "IN operator test",
        priority: 100,
        enabled: true,
        conditions: [{ field: "action", operator: "in", value: ["invoke_model", "write_file"] }],
        action: "require_approval",
      },
      {
        ruleId: "gte-test",
        description: "GTE operator test",
        priority: 90,
        enabled: true,
        conditions: [{ field: "estimatedCostUsd", operator: "gte", value: 100 }],
        action: "deny",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const engine = new ApprovalPolicyEngine(bundle);

  // Test IN operator
  const inContext: ApprovalPolicyContext = {
    decisionId: "dec-6",
    taskId: "task-6",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "auto",
    stage: "execute",
  };

  const inResult = engine.evaluate(inContext);
  assert.equal(inResult.requiresApproval, true);

  // Test GTE operator
  const gteContext: ApprovalPolicyContext = {
    decisionId: "dec-7",
    taskId: "task-7",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_tool",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    estimatedCostUsd: 200,
  };

  const gteResult = engine.evaluate(gteContext);
  assert.equal(gteResult.deny, true);
});

test("ApprovalPolicyEngine handles metadata fields", () => {
  const bundle: ApprovalPolicyBundle = {
    bundleId: "test-metadata",
    version: "1.0.0",
    name: "Metadata Test",
    description: "Test metadata access",
    enabled: true,
    rules: [
      {
        ruleId: "metadata-cost-center",
        description: "Check cost center in metadata",
        priority: 100,
        enabled: true,
        conditions: [
          { field: "metadata.costCenter", operator: "eq", value: "production" },
        ],
        action: "require_approval",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const engine = new ApprovalPolicyEngine(bundle);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-8",
    taskId: "task-8",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stage: "execute",
    metadata: { costCenter: "production" },
  };

  const result = engine.evaluate(context);

  assert.equal(result.requiresApproval, true);
});

test("ApprovalPolicyEngine returns no match for disabled bundle", () => {
  const bundle: ApprovalPolicyBundle = {
    ...DEFAULT_APPROVAL_POLICY_BUNDLE,
    enabled: false,
  };

  const engine = new ApprovalPolicyEngine(bundle);

  const context: ApprovalPolicyContext = {
    decisionId: "dec-9",
    taskId: "task-9",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
  };

  const result = engine.evaluate(context);

  assert.equal(result.requiresApproval, false);
  assert.equal(result.deny, false);
  assert.equal(result.matchedRuleIds.length, 0);
});

test("ApprovalPolicyEngine lint detects duplicate rule IDs", () => {
  const bundle: ApprovalPolicyBundle = {
    bundleId: "test-lint",
    version: "1.0.0",
    name: "Lint Test",
    description: "Test linting",
    enabled: true,
    rules: [
      {
        ruleId: "duplicate-id",
        description: "First rule",
        priority: 100,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "invoke_model" }],
        action: "allow",
      },
      {
        ruleId: "duplicate-id",
        description: "Second rule with same ID",
        priority: 90,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "write_file" }],
        action: "deny",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const engine = new ApprovalPolicyEngine(bundle);
  const lint = engine.lint();

  assert.equal(lint.valid, false);
  assert.ok(lint.errors.some((e) => e.code === "duplicate_rule_id"));
});

test("ApprovalPolicyEngine lint detects invalid field references", () => {
  const bundle: ApprovalPolicyBundle = {
    bundleId: "test-lint-fields",
    version: "1.0.0",
    name: "Field Lint Test",
    description: "Test field linting",
    enabled: true,
    rules: [
      {
        ruleId: "invalid-field",
        description: "Rule with invalid field",
        priority: 100,
        enabled: true,
        conditions: [{ field: "invalidField", operator: "eq", value: "test" }],
        action: "allow",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const engine = new ApprovalPolicyEngine(bundle);
  const lint = engine.lint();

  assert.equal(lint.valid, false);
  assert.ok(lint.errors.some((e) => e.code === "invalid_field_reference"));
});

test("PolicyVersionManager creates draft versions", () => {
  const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const draft = manager.createDraft("default-approval-policies", "1.0.0", "user-1");

  assert.equal(draft.status, "draft");
  assert.equal(draft.previousVersion, "1.0.0");
  assert.ok(draft.version !== "1.0.0");
});

test("PolicyVersionManager manages draft lifecycle", () => {
  const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

  // Create draft
  const draft = manager.createDraft("default-approval-policies", "1.0.0", "user-1");
  assert.equal(draft.status, "draft");

  // Submit for approval
  const submitted = manager.submitForApproval(draft, "user-1", "Added new rule");
  assert.equal(submitted.status, "pending_approval");
  assert.equal(submitted.changeSummary, "Added new rule");

  // Approve
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, "approver-1");

  // Activate
  const result = manager.activate("default-approval-policies", approved.version, "admin-1");
  assert.equal(result.success, true);

  // Check active version
  const active = manager.getActiveBundle("default-approval-policies");
  assert.ok(active);
  assert.equal(active!.status, "active");
});

test("PolicyVersionManager prevents non-draft updates", () => {
  const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const active = manager.getActiveBundle("default-approval-policies");

  assert.throws(
    () => manager.updateDraft(active!, "user-1"),
    /Cannot update non-draft/,
  );
});

test("PolicyVersionManager tracks change history", () => {
  const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const draft = manager.createDraft("default-approval-policies", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Added new rule");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("default-approval-policies", approved.version, "admin-1");

  const history = manager.getChangeHistory("default-approval-policies");

  assert.ok(history.length >= 1);
  assert.ok(history.some((h) => h.changeType === "activated"));
});

test("PolicyVersionManager compares versions", () => {
  const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

  // Create and activate initial version
  const active = manager.getActiveBundle("default-approval-policies");
  assert.ok(active);

  // Create draft with additional rule
  const draft = manager.createDraft("default-approval-policies", "1.0.0", "user-1");
  const modifiedDraft: VersionedPolicyBundle = {
    ...draft,
    rules: [
      ...draft.rules,
      {
        ruleId: "new-rule",
        description: "New test rule",
        priority: 50,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "network_access" }],
        action: "require_approval",
      },
    ],
  };

  const submitted = manager.submitForApproval(modifiedDraft, "user-1", "Added new rule");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("default-approval-policies", approved.version, "admin-1");

  const comparison = manager.compareVersions("default-approval-policies", "1.0.0", approved.version);

  assert.ok(comparison.added.some((r) => r.ruleId === "new-rule"));
});

test("PolicyVersionManager enforces max deprecated versions", () => {
  const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE, {
    maxDeprecatedVersions: 2,
  });

  // Create multiple versions
  const v1 = manager.getActiveBundle("default-approval-policies");
  assert.ok(v1);

  for (let i = 0; i < 5; i++) {
    const draft = manager.createDraft("default-approval-policies", "1.0.0", "user-1");
    const submitted = manager.submitForApproval(draft, "user-1", `Change ${i}`);
    const approved = manager.approve(submitted, "approver-1", `approval-${i}`);
    manager.activate("default-approval-policies", approved.version, "admin-1");
  }

  const versions = manager.getAllVersions("default-approval-policies");
  const deprecatedCount = versions.filter((v) => v.status === "deprecated").length;

  assert.ok(deprecatedCount <= 2);
});
