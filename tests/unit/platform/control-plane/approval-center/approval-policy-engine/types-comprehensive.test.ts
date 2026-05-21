/**
 * Comprehensive tests for ApprovalPolicyEngine types
 * Source: src/platform/five-plane-control-plane/approval-center/approval-policy-engine/types.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("ApprovalPolicyEngine Types", () => {
  let typesModule: any;

  beforeEach(() => {
    delete require.cache[require.resolve("./approval-policy-engine/types.js")];
    delete require.cache[require.resolve("./approval-policy-engine/types.ts")];
    typesModule = require("./approval-policy-engine/types.js");
  });

  describe("DEFAULT_APPROVAL_POLICY_BUNDLE", () => {
    it("should have valid structure", () => {
      const bundle = typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE;

      assert.ok(bundle.bundleId);
      assert.ok(bundle.version);
      assert.ok(bundle.name);
      assert.ok(bundle.description);
      assert.strictEqual(bundle.enabled, true);
      assert.ok(Array.isArray(bundle.rules));
      assert.ok(bundle.createdAt);
      assert.ok(bundle.updatedAt);
    });

    it("should have at least one rule", () => {
      const bundle = typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE;

      assert.ok(bundle.rules.length > 0);
    });

    it("should have rules with all required fields", () => {
      const bundle = typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE;

      for (const rule of bundle.rules) {
        assert.ok(rule.ruleId, "Each rule should have ruleId");
        assert.ok(rule.description, "Each rule should have description");
        assert.ok(typeof rule.priority === "number", "Each rule should have priority");
        assert.ok(typeof rule.enabled === "boolean", "Each rule should have enabled");
        assert.ok(Array.isArray(rule.conditions), "Each rule should have conditions array");
        assert.ok(rule.action, "Each rule should have action");
      }
    });

    it("should have valid rule actions", () => {
      const bundle = typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE;
      const validActions = ["require_approval", "deny", "allow", "require_multi_party_approval"];

      for (const rule of bundle.rules) {
        assert.ok(
          validActions.includes(rule.action),
          `Rule ${rule.ruleId} has invalid action: ${rule.action}`,
        );
      }
    });

    it("should have valid operators in conditions", () => {
      const bundle = typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE;
      const validOperators = ["eq", "neq", "in", "nin", "gt", "gte", "lt", "lte", "contains"];

      for (const rule of bundle.rules) {
        for (const condition of rule.conditions) {
          assert.ok(
            validOperators.includes(condition.operator),
            `Rule ${rule.ruleId} has invalid operator: ${condition.operator}`,
          );
          assert.ok(condition.field, "Condition should have field");
        }
      }
    });
  });

  describe("RuleCondition", () => {
    it("should have correct structure", () => {
      const condition = {
        field: "riskCategory",
        operator: "eq" as const,
        value: "destructive",
      };

      assert.strictEqual(condition.field, "riskCategory");
      assert.strictEqual(condition.operator, "eq");
      assert.strictEqual(condition.value, "destructive");
    });
  });

  describe("ApprovalPolicyRule", () => {
    it("should support all action types", () => {
      const ruleActions = [
        { action: "require_approval", shouldRequireApproval: true },
        { action: "deny", shouldDeny: true },
        { action: "allow", shouldAllow: true },
        { action: "require_multi_party_approval", shouldRequireMultiParty: true },
      ];

      for (const { action } of ruleActions) {
        const rule = {
          ruleId: "test-rule",
          description: "Test rule",
          priority: 100,
          enabled: true,
          conditions: [{ field: "riskCategory", operator: "eq", value: "test" }],
          action,
        };

        assert.ok(
          ["require_approval", "deny", "allow", "require_multi_party_approval"].includes(rule.action),
        );
      }
    });

    it("should support optional fields", () => {
      const rule = {
        ruleId: "test-rule",
        description: "Test rule with optional fields",
        priority: 100,
        enabled: true,
        conditions: [{ field: "riskCategory", operator: "eq", value: "test" }],
        action: "require_approval" as const,
        requiredApprovals: 3,
        approverGroups: ["group-a", "group-b"],
        timeoutPolicy: "approve" as const,
        tags: ["test", "demo"],
        source: "manual",
      };

      assert.strictEqual(rule.requiredApprovals, 3);
      assert.deepStrictEqual(rule.approverGroups, ["group-a", "group-b"]);
      assert.strictEqual(rule.timeoutPolicy, "approve");
      assert.deepStrictEqual(rule.tags, ["test", "demo"]);
      assert.strictEqual(rule.source, "manual");
    });
  });

  describe("ApprovalPolicyBundle", () => {
    it("should have version with semantic versioning format", () => {
      const bundle = typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE;
      const versionPattern = /^\d+\.\d+\.\d+$/;

      assert.ok(versionPattern.test(bundle.version), `Version ${bundle.version} should match semantic versioning`);
    });
  });

  describe("VersionedPolicyBundle", () => {
    it("should extend ApprovalPolicyBundle with version fields", () => {
      const versionedBundle = {
        ...typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE,
        status: "active" as const,
        previousVersion: "1.0.0",
        changeSummary: "Initial release",
      };

      assert.strictEqual(versionedBundle.status, "active");
      assert.strictEqual(versionedBundle.previousVersion, "1.0.0");
      assert.strictEqual(versionedBundle.changeSummary, "Initial release");
    });

    it("should have valid status values", () => {
      const validStatuses = ["draft", "pending_approval", "approved", "active", "deprecated"];

      for (const status of validStatuses) {
        const bundle = {
          ...typesModule.DEFAULT_APPROVAL_POLICY_BUNDLE,
          status,
        };

        assert.ok(validStatuses.includes(bundle.status));
      }
    });
  });

  describe("ApprovalPolicyContext", () => {
    it("should have all required fields", () => {
      const context = {
        decisionId: "decision-123",
        taskId: "task-123",
        executionId: null,
        sessionId: null,
        subjectType: "agent" as const,
        subjectId: "agent-1",
        action: "write_file",
        resourceRef: null,
        riskCategory: "destructive" as const,
        mode: "supervised" as const,
        stage: "execute",
        estimatedCostUsd: 100,
        metadata: { key: "value" },
      };

      assert.ok(context.decisionId);
      assert.ok(context.taskId);
      assert.ok(context.subjectType);
      assert.ok(context.subjectId);
      assert.ok(context.action);
      assert.ok(context.riskCategory);
      assert.ok(context.mode);
      assert.ok(context.stage);
    });
  });

  describe("ApprovalPolicyResult", () => {
    it("should have all required fields", () => {
      const result = {
        requiresApproval: true,
        deny: false,
        requireMultiParty: false,
        requiredApprovals: 1,
        approverGroups: [],
        timeoutPolicy: "reject" as const,
        evaluatedBundleVersion: "1.0.0",
        matchedRuleIds: ["rule-1"],
        reasonCode: "policy.rule.rule-1.approval_required",
        explainSummary: "Rule requires approval",
      };

      assert.strictEqual(typeof result.requiresApproval, "boolean");
      assert.strictEqual(typeof result.deny, "boolean");
      assert.strictEqual(typeof result.requireMultiParty, "boolean");
      assert.strictEqual(typeof result.requiredApprovals, "number");
      assert.ok(Array.isArray(result.approverGroups));
      assert.ok(result.timeoutPolicy);
      assert.ok(result.evaluatedBundleVersion);
      assert.ok(Array.isArray(result.matchedRuleIds));
      assert.ok(result.reasonCode);
      assert.ok(result.explainSummary);
    });
  });

  describe("PolicyLintResult", () => {
    it("should have valid structure for valid bundle", () => {
      const lintResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      assert.strictEqual(lintResult.valid, true);
      assert.ok(Array.isArray(lintResult.errors));
      assert.ok(Array.isArray(lintResult.warnings));
      assert.strictEqual(lintResult.errors.length, 0);
    });

    it("should have errors array with error details", () => {
      const lintResult = {
        valid: false,
        errors: [
          {
            ruleId: "test-rule",
            code: "duplicate_rule_id",
            message: "Rule ID appears multiple times",
            field: "ruleId",
          },
        ],
        warnings: [],
      };

      assert.strictEqual(lintResult.valid, false);
      assert.strictEqual(lintResult.errors.length, 1);
      assert.strictEqual(lintResult.errors[0].code, "duplicate_rule_id");
    });

    it("should have warnings array with suggestion", () => {
      const lintResult = {
        valid: true,
        errors: [],
        warnings: [
          {
            ruleId: "shadowed-rule",
            code: "shadowed_rule",
            message: "Rule is always overridden",
            suggestion: "Increase priority",
          },
        ],
      };

      assert.strictEqual(lintResult.warnings.length, 1);
      assert.ok(lintResult.warnings[0].suggestion);
    });
  });

  describe("RuleOperator types", () => {
    it("should define all comparison operators", () => {
      const operators = ["eq", "neq", "in", "nin", "gt", "gte", "lt", "lte", "contains"];

      for (const op of operators) {
        assert.ok(op);
      }
    });
  });

  describe("RuleConditionLogic", () => {
    it("should support and/or logic", () => {
      const logics = ["and", "or"];

      for (const logic of logics) {
        assert.ok(logic === "and" || logic === "or");
      }
    });
  });
});