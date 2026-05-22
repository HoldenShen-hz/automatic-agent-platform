/**
 * Comprehensive tests for ApprovalPolicyEngine (Rule Engine)
 * Source: src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  ApprovalPolicyEngine,
  createDefaultPolicyEngine,
} from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.js";
import {
  DEFAULT_APPROVAL_POLICY_BUNDLE,
} from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/types.js";

describe("ApprovalPolicyEngine", () => {

  describe("evaluate", () => {
    it("should return default result when bundle is disabled", () => {
      const bundle = {
        ...DEFAULT_APPROVAL_POLICY_BUNDLE,
        enabled: false,
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "supervised" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.deny, false);
      assert.ok(result.reasonCode.includes("no_matching_rule"));
    });

    it("should deny critical destructive actions in auto mode", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "exec_command",
        riskCategory: "destructive" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.deny, true);
      assert.strictEqual(result.requiresApproval, false);
      assert.ok(result.matchedRuleIds.includes("critical-action-deny"));
    });

    it("should require approval for destructive actions in supervised mode", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "delete_resource",
        riskCategory: "destructive" as const,
        mode: "supervised" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(result.deny, false);
      assert.ok(result.matchedRuleIds.includes("destructive-high-risk"));
    });

    it("should require approval for prod-affecting actions", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "prod_affecting" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, true);
      assert.ok(result.matchedRuleIds.includes("prod-affecting-approval"));
    });

    it("should require approval for org-changing actions", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "modify_permissions",
        riskCategory: "org_changing" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, true);
      assert.ok(result.matchedRuleIds.includes("org-change-approval"));
    });

    it("should require approval for high-cost actions (>= $100)", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        estimatedCostUsd: 150,
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, true);
      assert.ok(result.matchedRuleIds.includes("high-cost-approval"));
    });

    it("should not require approval for low-cost actions", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "read_file",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        estimatedCostUsd: 10,
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.matchedRuleIds.length, 0);
    });

    it("should evaluate rules in priority order (highest first)", () => {
      const customBundle = {
        bundleId: "test-bundle",
        version: "1.0.0",
        name: "Test Bundle",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "low-priority-deny",
            description: "Low priority deny",
            priority: 10,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
            ],
            action: "deny",
          },
          {
            ruleId: "high-priority-allow",
            description: "High priority allow",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
            ],
            action: "allow",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(customBundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      // High priority rule should match first
      assert.strictEqual(result.deny, false);
      assert.ok(result.matchedRuleIds.includes("high-priority-allow"));
    });

    it("should return default result when no rules match", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "read_file",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        estimatedCostUsd: 5,
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.deny, false);
      assert.strictEqual(result.matchedRuleIds.length, 0);
    });
  });

  describe("condition evaluation", () => {
    it("should evaluate eq operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-eq",
            description: "Test eq",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });

    it("should evaluate neq operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-neq",
            description: "Test neq",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "neq", value: "destructive" },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });

    it("should evaluate in operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-in",
            description: "Test in",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "action", operator: "in", value: ["exec_command", "write_file"] },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "exec_command",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });

    it("should evaluate nin operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-nin",
            description: "Test nin",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "action", operator: "nin", value: ["read_file", "list_dir"] },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "exec_command",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });

    it("should evaluate gt operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-gt",
            description: "Test gt",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "estimatedCostUsd", operator: "gt", value: 100 },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        estimatedCostUsd: 150,
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });

    it("should evaluate gte operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-gte",
            description: "Test gte",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "estimatedCostUsd", operator: "gte", value: 100 },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        estimatedCostUsd: 100,
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });

    it("should evaluate lt operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-lt",
            description: "Test lt",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "estimatedCostUsd", operator: "lt", value: 100 },
            ],
            action: "allow",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        estimatedCostUsd: 50,
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, false);
    });

    it("should evaluate contains operator correctly", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-contains",
            description: "Test contains",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "action", operator: "contains", value: "exec" },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "exec_command",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });
  });

  describe("condition logic", () => {
    it("should use AND logic when specified", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-and",
            description: "Test AND",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
              { field: "mode", operator: "eq", value: "supervised" },
            ],
            conditionLogic: "and",
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);

      // Both conditions match
      const context1 = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "supervised" as const,
        stage: "execute",
      };
      assert.strictEqual(engine.evaluate(context1).deny, true);

      // Only one condition matches
      const context2 = {
        decisionId: "decision-456",
        taskId: "task-456",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "auto" as const,
        stage: "execute",
      };
      assert.strictEqual(engine.evaluate(context2).deny, false);
    });

    it("should use OR logic when specified", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-or",
            description: "Test OR",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
              { field: "mode", operator: "eq", value: "supervised" },
            ],
            conditionLogic: "or",
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);

      // Only one condition matches
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "auto" as const,
        stage: "execute",
      };
      assert.strictEqual(engine.evaluate(context).deny, true);
    });
  });

  describe("nested field access", () => {
    it("should access nested fields using dot notation", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-nested",
            description: "Test nested field",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "metadata.costCenter", operator: "eq", value: "engineering" },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "normal" as const,
        mode: "auto" as const,
        stage: "execute",
        metadata: {
          costCenter: "engineering",
        },
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });
  });

  describe("lint", () => {
    it("should return valid for well-formed bundle", () => {
      const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
      const result = engine.lint();

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should detect duplicate rule IDs", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "duplicate",
            description: "Rule 1",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
            ],
            action: "deny",
          },
          {
            ruleId: "duplicate",
            description: "Rule 2",
            priority: 90,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "normal" },
            ],
            action: "allow",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const result = engine.lint();

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e: any) => e.code === "duplicate_rule_id"));
    });

    it("should detect invalid field references", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "test-invalid",
            description: "Test invalid",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "invalidField", operator: "eq", value: "something" },
            ],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const result = engine.lint();

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e: any) => e.code === "invalid_field_reference"));
    });

    it("should detect shadowed rules", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "high-priority",
            description: "High priority rule",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
            ],
            action: "deny",
          },
          {
            ruleId: "low-priority",
            description: "Low priority rule",
            priority: 50,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "destructive" },
            ],
            action: "allow",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const result = engine.lint();

      assert.ok(result.warnings.some((w: any) => w.code === "shadowed_rule"));
    });

    it("should warn about rules with no conditions", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "no-conditions",
            description: "Rule with no conditions",
            priority: 100,
            enabled: true,
            conditions: [],
            action: "deny",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const result = engine.lint();

      assert.ok(result.warnings.some((w: any) => w.code === "empty_conditions"));
    });
  });

  describe("createDefaultPolicyEngine", () => {
    it("should create engine with default policy bundle", () => {
      const engine = createDefaultPolicyEngine();

      assert.ok(engine);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        riskCategory: "destructive" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);
      assert.strictEqual(result.deny, true);
    });
  });

  describe("require_multi_party_approval action", () => {
    it("should require multi-party approval when action is require_multi_party_approval", () => {
      const bundle = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [
          {
            ruleId: "multi-party-rule",
            description: "Require multi-party approval",
            priority: 100,
            enabled: true,
            conditions: [
              { field: "riskCategory", operator: "eq", value: "critical" },
            ],
            action: "require_multi_party_approval",
            requiredApprovals: 3,
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const engine = new ApprovalPolicyEngine(bundle);
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "deploy",
        riskCategory: "critical" as const,
        mode: "auto" as const,
        stage: "execute",
      };

      const result = engine.evaluate(context);

      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(result.requireMultiParty, true);
      assert.strictEqual(result.requiredApprovals, 3);
    });
  });
});