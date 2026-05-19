/**
 * Unit tests for parsePolicyValue function.
 *
 * Tests parsing of evolution policy records.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parsePolicyValue } from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";
test("parsePolicyValue parses budget adjustment policy", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: JSON.stringify({
            recommendedPolicy: {
                maxTaskCostUsd: 0.12,
                maxDailyCostUsd: 1.2,
                maxMonthlyCostUsd: 12.0,
                warnAtRatio: 0.85,
                mode: "supervised",
            },
            baselinePolicy: {
                maxTaskCostUsd: 0.10,
                maxDailyCostUsd: 1.0,
                maxMonthlyCostUsd: 10.0,
                warnAtRatio: 0.8,
                mode: "supervised",
            },
            appliedBy: "agent_001",
        }),
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    const value = parsePolicyValue(record);
    assert.strictEqual(value.recommendedPolicy.maxTaskCostUsd, 0.12);
    assert.strictEqual(value.baselinePolicy.maxTaskCostUsd, 0.10);
    assert.strictEqual(value.appliedBy, "agent_001");
});
test("parsePolicyValue parses experience promotion policy", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "experience_promotion",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: JSON.stringify({
            memoryId: "mem_abc123",
            sourceExperienceId: "exp_xyz",
            targetScope: "project",
            appliedBy: "agent_001",
        }),
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    const value = parsePolicyValue(record);
    assert.strictEqual(value.memoryId, "mem_abc123");
    assert.strictEqual(value.sourceExperienceId, "exp_xyz");
    assert.strictEqual(value.targetScope, "project");
    assert.strictEqual(value.appliedBy, "agent_001");
});
test("parsePolicyValue parses rolled back policy", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "rolled_back",
        valueJson: JSON.stringify({
            recommendedPolicy: {
                maxTaskCostUsd: 0.12,
                maxDailyCostUsd: 1.2,
                maxMonthlyCostUsd: 12.0,
                warnAtRatio: 0.85,
                mode: "supervised",
            },
            baselinePolicy: {
                maxTaskCostUsd: 0.10,
                maxDailyCostUsd: 1.0,
                maxMonthlyCostUsd: 10.0,
                warnAtRatio: 0.8,
                mode: "supervised",
            },
            appliedBy: "agent_001",
        }),
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
        rolledBackAt: "2026-04-02T00:00:00.000Z",
    };
    const value = parsePolicyValue(record);
    assert.strictEqual(value.recommendedPolicy.maxTaskCostUsd, 0.12);
});
test("parsePolicyValue handles complex nested structure", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: JSON.stringify({
            recommendedPolicy: {
                maxTaskCostUsd: 0.12,
                maxDailyCostUsd: 1.2,
                maxMonthlyCostUsd: 12.0,
                warnAtRatio: 0.85,
                mode: "supervised",
                features: {
                    enableBulkOperations: true,
                    maxRetries: 3,
                },
            },
            baselinePolicy: {
                maxTaskCostUsd: 0.10,
                maxDailyCostUsd: 1.0,
                maxMonthlyCostUsd: 10.0,
                warnAtRatio: 0.8,
                mode: "supervised",
                features: {
                    enableBulkOperations: false,
                    maxRetries: 1,
                },
            },
        }),
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    const value = parsePolicyValue(record);
    assert.strictEqual(value.recommendedPolicy.features.enableBulkOperations, true);
    assert.strictEqual(value.baselinePolicy.features.enableBulkOperations, false);
});
test("parsePolicyValue handles malformed JSON", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: "{ invalid json }",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    assert.throws(() => parsePolicyValue(record), SyntaxError);
});
test("parsePolicyValue handles empty valueJson", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: "",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    assert.throws(() => parsePolicyValue(record), SyntaxError);
});
test("parsePolicyValue parses simple string value", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: JSON.stringify("simple-string-value"),
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    const value = parsePolicyValue(record);
    assert.strictEqual(value, "simple-string-value");
});
test("parsePolicyValue parses array value", () => {
    const record = {
        id: "policy_123",
        proposalId: "proposal_123",
        kind: "budget_adjustment",
        scopeType: "division",
        scopeRef: "div-789",
        status: "active",
        valueJson: JSON.stringify([1, 2, 3, 4, 5]),
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        rolledBackAt: null,
    };
    const value = parsePolicyValue(record);
    assert.deepEqual(value, [1, 2, 3, 4, 5]);
});
//# sourceMappingURL=evolution-mvp-policy-value-parse.test.js.map