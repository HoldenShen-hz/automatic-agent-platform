/**
 * Integration Test: Approval Policy Engine
 *
 * Verifies the approval policy rule engine evaluates policies correctly.
 * Tests condition matching, rule prioritization, and policy linting.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalPolicyEngine } from "../../../../../src/platform/control-plane/approval-center/approval-policy-engine/rule-engine.js";
import {
  DEFAULT_APPROVAL_POLICY_BUNDLE,
  type ApprovalPolicyBundle,
  type ApprovalPolicyContext,
  type ApprovalPolicyRule,
} from "../../../../../src/platform/control-plane/approval-center/approval-policy-engine/types.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

function createTestBundle(rules: ApprovalPolicyRule[]): ApprovalPolicyBundle {
  return {
    bundleId: "test-bundle",
    version: "1.0.0",
    name: "Test Bundle",
    description: "Test approval policies",
    enabled: true,
    rules,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createTestContext(overrides: Partial<ApprovalPolicyContext> = {}): ApprovalPolicyContext {
  return {
    decisionId: newId("decision"),
    taskId: newId("task"),
    executionId: null,
    sessionId: null,
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    resourceRef: null,
    riskCategory: "destructive",
    mode: "supervised",
    stage: "execute",
    estimatedCostUsd: 10,
    metadata: {},
    ...overrides,
  };
}

test("approval policy engine: default bundle denies critical destructive actions in auto mode", () => {
  const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
  const context: ApprovalPolicyContext = {
    decisionId: newId("decision"),
    taskId: newId("task"),
    executionId: null,
    sessionId: null,
    subjectType: "agent",
    subjectId: "agent-1",
    action: "write_file",
    resourceRef: null,
    riskCategory: "destructive",
    mode: "auto",  // Changed to auto mode
    stage: "execute",
    estimatedCostUsd: 10,
    metadata: {},
  };

  const result = engine.evaluate(context);

  // The default bundle denies write_file with destructive in auto mode
  assert.strictEqual(result.deny, true);
  assert.ok(result.matchedRuleIds.includes("critical-action-deny"));
});

test("approval policy engine: allow action returns no approval required", () => {
  const bundle = createTestBundle([
    {
      ruleId: "allow-test",
      description: "Allow read actions",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "invoke_model" },
      ],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ action: "invoke_model" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.deny, false);
  assert.ok(result.matchedRuleIds.includes("allow-test"));
});

test("approval policy engine: deny action blocks execution", () => {
  const bundle = createTestBundle([
    {
      ruleId: "deny-test",
      description: "Deny critical actions",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "exec_command" },
        { field: "riskCategory", operator: "eq", value: "destructive" },
      ],
      conditionLogic: "and",
      action: "deny",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ action: "exec_command", riskCategory: "destructive" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.deny, true);
  assert.ok(result.matchedRuleIds.includes("deny-test"));
});

test("approval policy engine: higher priority rules take precedence", () => {
  const bundle = createTestBundle([
    {
      ruleId: "low-priority",
      description: "Low priority allow",
      priority: 10,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
      ],
      action: "allow",
    },
    {
      ruleId: "high-priority",
      description: "High priority require approval",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ action: "write_file" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, true);
  assert.ok(result.matchedRuleIds.includes("high-priority"));
});

test("approval policy engine: disabled rules are skipped", () => {
  const bundle = createTestBundle([
    {
      ruleId: "disabled-rule",
      description: "Disabled rule",
      priority: 100,
      enabled: false,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
      ],
      action: "deny",
    },
    {
      ruleId: "fallback-allow",
      description: "Fallback allow",
      priority: 10,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
      ],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ action: "write_file" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.deny, false);
  assert.ok(result.matchedRuleIds.includes("fallback-allow"));
});

test("approval policy engine: eq operator matches exact values", () => {
  const bundle = createTestBundle([
    {
      ruleId: "eq-test",
      description: "Equality test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "eq", value: "prod_affecting" },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ riskCategory: "prod_affecting" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, true);
});

test("approval policy engine: neq operator matches non-equal values", () => {
  const bundle = createTestBundle([
    {
      ruleId: "neq-test",
      description: "Not equal test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "neq", value: "destructive" },
      ],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ riskCategory: "cost_sensitive" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.deny, false);
});

test("approval policy engine: in operator matches value in array", () => {
  const bundle = createTestBundle([
    {
      ruleId: "in-test",
      description: "In array test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "in", value: ["write_file", "exec_command"] },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const writeResult = engine.evaluate(createTestContext({ action: "write_file" }));
  assert.strictEqual(writeResult.requiresApproval, true);

  const execResult = engine.evaluate(createTestContext({ action: "exec_command" }));
  assert.strictEqual(execResult.requiresApproval, true);

  const modelResult = engine.evaluate(createTestContext({ action: "invoke_model" }));
  assert.strictEqual(modelResult.requiresApproval, false);
});

test("approval policy engine: nin operator matches value not in array", () => {
  const bundle = createTestBundle([
    {
      ruleId: "nin-test",
      description: "Not in array test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "nin", value: ["write_file", "exec_command"] },
      ],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const modelResult = engine.evaluate(createTestContext({ action: "invoke_model" }));
  assert.strictEqual(modelResult.requiresApproval, false);
});

test("approval policy engine: gte operator for cost threshold", () => {
  const bundle = createTestBundle([
    {
      ruleId: "cost-test",
      description: "High cost approval",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "estimatedCostUsd", operator: "gte", value: 100 },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const highCost = engine.evaluate(createTestContext({ estimatedCostUsd: 150 }));
  assert.strictEqual(highCost.requiresApproval, true);

  const lowCost = engine.evaluate(createTestContext({ estimatedCostUsd: 50 }));
  assert.strictEqual(lowCost.requiresApproval, false);
});

test("approval policy engine: contains operator for string matching", () => {
  const bundle = createTestBundle([
    {
      ruleId: "contains-test",
      description: "Contains test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "resourceRef", operator: "contains", value: "/prod/" },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const prodResource = engine.evaluate(createTestContext({ resourceRef: "/prod/data/file.txt" }));
  assert.strictEqual(prodResource.requiresApproval, true);

  const devResource = engine.evaluate(createTestContext({ resourceRef: "/dev/data/file.txt" }));
  assert.strictEqual(devResource.requiresApproval, false);
});

test("approval policy engine: and logic requires all conditions", () => {
  const bundle = createTestBundle([
    {
      ruleId: "and-test",
      description: "And logic test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
        { field: "riskCategory", operator: "eq", value: "destructive" },
      ],
      conditionLogic: "and",
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const matchBoth = engine.evaluate(createTestContext({ action: "write_file", riskCategory: "destructive" }));
  assert.strictEqual(matchBoth.requiresApproval, true);

  const matchActionOnly = engine.evaluate(createTestContext({ action: "write_file", riskCategory: "cost_sensitive" }));
  assert.strictEqual(matchActionOnly.requiresApproval, false);
});

test("approval policy engine: or logic requires any condition", () => {
  const bundle = createTestBundle([
    {
      ruleId: "or-test",
      description: "Or logic test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
        { field: "action", operator: "eq", value: "exec_command" },
      ],
      conditionLogic: "or",
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const matchFirst = engine.evaluate(createTestContext({ action: "write_file" }));
  assert.strictEqual(matchFirst.requiresApproval, true);

  const matchSecond = engine.evaluate(createTestContext({ action: "exec_command" }));
  assert.strictEqual(matchSecond.requiresApproval, true);

  const matchNeither = engine.evaluate(createTestContext({ action: "invoke_model" }));
  assert.strictEqual(matchNeither.requiresApproval, false);
});

test("approval policy engine: metadata field access via dot notation", () => {
  const bundle = createTestBundle([
    {
      ruleId: "metadata-test",
      description: "Metadata access test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "metadata.costCenter", operator: "eq", value: "engineering" },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const withMetadata = engine.evaluate(createTestContext({
    metadata: { costCenter: "engineering" },
  }));
  assert.strictEqual(withMetadata.requiresApproval, true);

  const withoutMetadata = engine.evaluate(createTestContext({
    metadata: { costCenter: "marketing" },
  }));
  assert.strictEqual(withoutMetadata.requiresApproval, false);
});

test("approval policy engine: no matching rule returns default", () => {
  const bundle = createTestBundle([
    {
      ruleId: "specific-rule",
      description: "Specific rule",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "invoke_tool" },
      ],
      action: "require_approval",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ action: "write_file" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.deny, false);
  assert.deepStrictEqual(result.matchedRuleIds, []);
  assert.ok(result.reasonCode.includes("no_matching_rule"));
});

test("approval policy engine: disabled bundle returns default", () => {
  const bundle: ApprovalPolicyBundle = {
    ...createTestBundle([]),
    enabled: false,
  };
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext();

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.deny, false);
});

test("approval policy engine: multi-party approval sets requireMultiParty flag", () => {
  const bundle = createTestBundle([
    {
      ruleId: "multi-party-test",
      description: "Multi-party approval test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "riskCategory", operator: "eq", value: "org_changing" },
      ],
      action: "require_multi_party_approval",
      requiredApprovals: 3,
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);
  const context = createTestContext({ riskCategory: "org_changing" });

  const result = engine.evaluate(context);

  assert.strictEqual(result.requiresApproval, true);
  assert.strictEqual(result.requireMultiParty, true);
  assert.strictEqual(result.requiredApprovals, 3);
});

test("approval policy engine: lint detects duplicate rule IDs", () => {
  const bundle = createTestBundle([
    {
      ruleId: "duplicate-id",
      description: "Rule 1",
      priority: 100,
      enabled: true,
      conditions: [{ field: "action", operator: "eq", value: "write_file" }],
      action: "allow",
    },
    {
      ruleId: "duplicate-id",
      description: "Rule 2",
      priority: 90,
      enabled: true,
      conditions: [{ field: "action", operator: "eq", value: "exec_command" }],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const lint = engine.lint();

  assert.strictEqual(lint.valid, false);
  assert.ok(lint.errors.some((e) => e.code === "duplicate_rule_id"));
});

test("approval policy engine: lint detects invalid field references", () => {
  const bundle = createTestBundle([
    {
      ruleId: "invalid-field",
      description: "Invalid field test",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "invalidField", operator: "eq", value: "something" },
      ],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const lint = engine.lint();

  assert.strictEqual(lint.valid, false);
  assert.ok(lint.errors.some((e) => e.code === "invalid_field_reference"));
});

test("approval policy engine: lint warns about shadowed rules", () => {
  const bundle = createTestBundle([
    {
      ruleId: "high-priority",
      description: "High priority deny",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
      ],
      action: "deny",
    },
    {
      ruleId: "low-priority",
      description: "Low priority allow",
      priority: 50,
      enabled: true,
      conditions: [
        { field: "action", operator: "eq", value: "write_file" },
      ],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const lint = engine.lint();

  // Both rules have 1 condition that matches the same field/value
  // The higher priority rule shadows the lower priority one
  assert.ok(lint.warnings.some((w) => w.code === "shadowed_rule"));
});

test("approval policy engine: lint warns about rules with no conditions", () => {
  const bundle = createTestBundle([
    {
      ruleId: "no-conditions",
      description: "No conditions rule",
      priority: 100,
      enabled: true,
      conditions: [],
      action: "allow",
    },
  ]);
  const engine = new ApprovalPolicyEngine(bundle);

  const lint = engine.lint();

  assert.ok(lint.warnings.some((w) => w.code === "empty_conditions"));
});
