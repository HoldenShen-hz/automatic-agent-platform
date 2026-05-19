/**
 * Unit tests for Approval Policy Engine Types
 */
import assert from "node:assert/strict";
import test from "node:test";
test("RuleOperator type accepts all valid operators", () => {
    const operators = ["eq", "neq", "in", "nin", "gt", "gte", "lt", "lte", "contains"];
    for (const op of operators) {
        assert.ok(op.length > 0);
    }
    assert.equal(operators.length, 9);
});
test("RuleConditionLogic type accepts and/or", () => {
    const logics = ["and", "or"];
    assert.equal(logics.length, 2);
    assert.ok(logics.includes("and"));
    assert.ok(logics.includes("or"));
});
test("ApprovalPolicyRule action can be various values", () => {
    const requireApproval = {
        ruleId: "rule-1",
        description: "Test rule",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "require_approval",
    };
    const deny = {
        ruleId: "rule-2",
        description: "Deny rule",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "deny",
    };
    const allow = {
        ruleId: "rule-3",
        description: "Allow rule",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "allow",
    };
    const multiParty = {
        ruleId: "rule-4",
        description: "Multi-party rule",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "require_multi_party_approval",
        requiredApprovals: 3,
        approverGroups: ["security-team", "admin-team"],
    };
    assert.equal(requireApproval.action, "require_approval");
    assert.equal(deny.action, "deny");
    assert.equal(allow.action, "allow");
    assert.equal(multiParty.action, "require_multi_party_approval");
    assert.equal(multiParty.requiredApprovals, 3);
    assert.deepEqual(multiParty.approverGroups, ["security-team", "admin-team"]);
});
test("ApprovalPolicyRule timeoutPolicy can be various values", () => {
    const reject = {
        ruleId: "rule-1",
        description: "Reject on timeout",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "require_approval",
        timeoutPolicy: "reject",
    };
    const approve = {
        ruleId: "rule-2",
        description: "Approve on timeout",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "require_approval",
        timeoutPolicy: "approve",
    };
    const remainPending = {
        ruleId: "rule-3",
        description: "Remain pending on timeout",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "require_approval",
        timeoutPolicy: "remain_pending",
    };
    assert.equal(reject.timeoutPolicy, "reject");
    assert.equal(approve.timeoutPolicy, "approve");
    assert.equal(remainPending.timeoutPolicy, "remain_pending");
});
test("ApprovalPolicyBundle can be used as a type", () => {
    const bundle = {
        bundleId: "test-bundle",
        version: "1.0.0",
        name: "Test Bundle",
        description: "Test bundle description",
        enabled: true,
        rules: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(bundle.bundleId, "test-bundle");
    assert.equal(bundle.enabled, true);
    assert.equal(bundle.rules.length, 0);
});
test("VersionedPolicyBundle extends ApprovalPolicyBundle with version fields", () => {
    const bundle = {
        bundleId: "test-bundle",
        version: "1.0.0",
        name: "Test Bundle",
        description: "Test bundle description",
        enabled: true,
        rules: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        status: "draft",
        previousVersion: "0.9.0",
        changeSummary: "Initial draft",
    };
    assert.equal(bundle.status, "draft");
    assert.equal(bundle.previousVersion, "0.9.0");
    assert.equal(bundle.changeSummary, "Initial draft");
});
test("VersionedPolicyBundle status can be any lifecycle value", () => {
    const statuses = [
        "draft",
        "pending_approval",
        "approved",
        "active",
        "deprecated",
    ];
    for (const status of statuses) {
        const bundle = {
            bundleId: "test",
            version: "1.0.0",
            name: "Test",
            description: "Test",
            enabled: true,
            rules: [],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            status,
        };
        assert.equal(bundle.status, status);
    }
});
test("ApprovalPolicyContext can be used as a type", () => {
    const context = {
        decisionId: "dec-1",
        taskId: "task-1",
        subjectType: "agent",
        subjectId: "agent-1",
        action: "invoke_tool",
        riskCategory: "destructive",
        mode: "supervised",
        stage: "execute",
    };
    assert.equal(context.decisionId, "dec-1");
    assert.equal(context.subjectType, "agent");
    assert.equal(context.riskCategory, "destructive");
});
test("ApprovalPolicyContext can include optional fields", () => {
    const context = {
        decisionId: "dec-1",
        taskId: "task-1",
        executionId: "exec-1",
        sessionId: "session-1",
        subjectType: "user",
        subjectId: "user-1",
        action: "write_file",
        resourceRef: "/workspace/file.txt",
        riskCategory: "destructive",
        mode: "auto",
        stage: "execute",
        estimatedCostUsd: 50.0,
        metadata: { costCenter: "engineering" },
    };
    assert.equal(context.executionId, "exec-1");
    assert.equal(context.sessionId, "session-1");
    assert.equal(context.resourceRef, "/workspace/file.txt");
    assert.equal(context.estimatedCostUsd, 50.0);
    assert.deepEqual(context.metadata, { costCenter: "engineering" });
});
test("ApprovalPolicyResult has correct structure", () => {
    const result = {
        requiresApproval: true,
        deny: false,
        requireMultiParty: false,
        requiredApprovals: 1,
        approverGroups: [],
        timeoutPolicy: "reject",
        evaluatedBundleVersion: "1.0.0",
        matchedRuleIds: ["rule-1"],
        reasonCode: "policy.require_approval",
        explainSummary: "Action requires approval",
    };
    assert.equal(result.requiresApproval, true);
    assert.equal(result.deny, false);
    assert.equal(result.timeoutPolicy, "reject");
    assert.equal(result.matchedRuleIds.length, 1);
});
test("PolicyLintResult has correct structure", () => {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
    };
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
});
test("PolicyLintError has correct structure", () => {
    const error = {
        ruleId: "rule-1",
        code: "duplicate_rule_id",
        message: "Duplicate rule ID detected",
        field: "ruleId",
    };
    assert.equal(error.ruleId, "rule-1");
    assert.equal(error.code, "duplicate_rule_id");
    assert.equal(error.message, "Duplicate rule ID detected");
    assert.equal(error.field, "ruleId");
});
test("PolicyLintWarning has correct structure", () => {
    const warning = {
        ruleId: "rule-1",
        code: "shadowed_rule",
        message: "Rule may be shadowed by higher priority rule",
        suggestion: "Consider adjusting rule priority",
    };
    assert.equal(warning.ruleId, "rule-1");
    assert.equal(warning.code, "shadowed_rule");
    assert.equal(warning.suggestion, "Consider adjusting rule priority");
});
test("RuleCondition can be used as a type", () => {
    const condition = {
        field: "riskCategory",
        operator: "eq",
        value: "destructive",
    };
    assert.equal(condition.field, "riskCategory");
    assert.equal(condition.operator, "eq");
    assert.equal(condition.value, "destructive");
});
test("RuleCondition can have array value for in/nin operators", () => {
    const inCondition = {
        field: "action",
        operator: "in",
        value: ["exec_command", "write_file"],
    };
    const ninCondition = {
        field: "riskCategory",
        operator: "nin",
        value: ["sensitive_data", "cost_sensitive"],
    };
    assert.deepEqual(inCondition.value, ["exec_command", "write_file"]);
    assert.deepEqual(ninCondition.value, ["sensitive_data", "cost_sensitive"]);
});
test("RuleCondition can have numeric value for gt/gte/lt/lte operators", () => {
    const gtCondition = {
        field: "estimatedCostUsd",
        operator: "gt",
        value: 100,
    };
    const lteCondition = {
        field: "estimatedCostUsd",
        operator: "lte",
        value: 50,
    };
    assert.equal(gtCondition.value, 100);
    assert.equal(lteCondition.value, 50);
});
test("ApprovalPolicyRule can have tags", () => {
    const rule = {
        ruleId: "rule-1",
        description: "Test rule",
        priority: 100,
        enabled: true,
        conditions: [],
        action: "require_approval",
        tags: ["risk", "destructive", "production"],
    };
    assert.deepEqual(rule.tags, ["risk", "destructive", "production"]);
});
test("ApprovalPolicyBundle can have optional approval fields", () => {
    const bundleWithoutApproval = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const bundleWithApproval = {
        bundleId: "test",
        version: "1.0.0",
        name: "Test",
        description: "Test",
        enabled: true,
        rules: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        approvedBy: "admin-1",
        approvalRequestId: "approval-123",
        tags: ["production"],
    };
    assert.equal(bundleWithApproval.approvedBy, "admin-1");
    assert.equal(bundleWithApproval.approvalRequestId, "approval-123");
    assert.deepEqual(bundleWithApproval.tags, ["production"]);
});
//# sourceMappingURL=types.test.js.map