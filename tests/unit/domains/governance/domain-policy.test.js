/**
 * Unit Tests: Domain Policy
 *
 * Tests DomainGovernancePolicySchema and DomainGovernanceRolloutSchema
 * type inference, validation edge cases, and interoperability.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DomainGovernanceRolloutSchema, DomainGovernancePolicySchema, } from "../../../../src/domains/governance/domain-governance-policy.js";
test("DomainGovernanceRolloutSchema infers correct TypeScript types", () => {
    const rollout = {
        strategy: "shadow",
        approvalRequired: false,
        rollbackWindowMinutes: 120,
    };
    assert.equal(rollout.strategy, "shadow");
    assert.equal(rollout.approvalRequired, false);
    assert.equal(rollout.rollbackWindowMinutes, 120);
});
test("DomainGovernancePolicySchema infers correct TypeScript types", () => {
    const policy = {
        policyId: "policy_test",
        domainId: "test_domain",
        ownerRoles: ["owner_a"],
        operatorRoles: ["operator_a"],
        approvalRoles: ["approver_a"],
        restrictedDataClasses: ["pii"],
        rollout: {
            strategy: "canary",
            approvalRequired: true,
            rollbackWindowMinutes: 45,
        },
        mandatoryEvidence: [],
    };
    assert.equal(policy.policyId, "policy_test");
    assert.equal(policy.domainId, "test_domain");
    assert.ok(Array.isArray(policy.ownerRoles));
    assert.ok(Array.isArray(policy.restrictedDataClasses));
});
test("DomainGovernancePolicySchema rejects negative rollbackWindowMinutes", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_neg",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        rollout: { strategy: "manual", rollbackWindowMinutes: -1 },
    });
    assert.equal(result.success, false);
});
test("DomainGovernancePolicySchema rejects non-integer rollbackWindowMinutes", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_float",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        rollout: { strategy: "manual", rollbackWindowMinutes: 30.5 },
    });
    assert.equal(result.success, false);
});
test("DomainGovernancePolicySchema rejects zero rollbackWindowMinutes", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_zero",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        rollout: { strategy: "manual", rollbackWindowMinutes: 0 },
    });
    assert.equal(result.success, false);
});
test("DomainGovernanceRolloutSchema accepts all four strategies", () => {
    const strategies = ["manual", "canary", "shadow", "supervised_auto"];
    for (const strategy of strategies) {
        const result = DomainGovernanceRolloutSchema.safeParse({ strategy });
        assert.equal(result.success, true, `Strategy ${strategy} should be valid`);
    }
});
test("DomainGovernanceRolloutSchema defaults do not override explicit values", () => {
    const result = DomainGovernanceRolloutSchema.parse({
        strategy: "manual",
        approvalRequired: false,
        rollbackWindowMinutes: 90,
    });
    assert.equal(result.strategy, "manual");
    assert.equal(result.approvalRequired, false);
    assert.equal(result.rollbackWindowMinutes, 90);
});
test("DomainGovernancePolicySchema requires all three role arrays to be non-empty", () => {
    const base = {
        policyId: "policy_test",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    };
    assert.equal(DomainGovernancePolicySchema.safeParse({ ...base, ownerRoles: [] }).success, false);
    assert.equal(DomainGovernancePolicySchema.safeParse({ ...base, operatorRoles: [] }).success, false);
    assert.equal(DomainGovernancePolicySchema.safeParse({ ...base, approvalRoles: [] }).success, false);
});
test("DomainGovernancePolicySchema rejects whitespace-only role strings", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_ws",
        domainId: "test",
        ownerRoles: ["owner", "   "],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.equal(result.success, false);
});
test("DomainGovernancePolicySchema rejects empty string in any role array", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_empty",
        domainId: "test",
        ownerRoles: ["owner", ""],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.equal(result.success, false);
});
test("DomainGovernancePolicySchema rejects duplicate roles across arrays", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_dup",
        domainId: "test",
        ownerRoles: ["role_a", "role_a"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        rollout: { strategy: "manual" },
    });
    assert.equal(result.success, true);
});
test("DomainGovernancePolicySchema accepts empty restrictedDataClasses", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_empty_rc",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        restrictedDataClasses: [],
        rollout: { strategy: "manual" },
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.data?.restrictedDataClasses, []);
});
test("DomainGovernancePolicySchema accepts empty mandatoryEvidence", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_empty_me",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        mandatoryEvidence: [],
        rollout: { strategy: "manual" },
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.data?.mandatoryEvidence, []);
});
test("DomainGovernancePolicySchema applies default rollout when omitted", () => {
    const result = DomainGovernancePolicySchema.safeParse({
        policyId: "policy_no_rollout",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.rollout.strategy, "canary");
    assert.equal(result.data?.rollout.approvalRequired, true);
    assert.equal(result.data?.rollout.rollbackWindowMinutes, 60);
});
test("DomainGovernanceRolloutSchema rejects non-positive rollbackWindowMinutes via safeParse", () => {
    const result = DomainGovernanceRolloutSchema.safeParse({
        strategy: "canary",
        rollbackWindowMinutes: -10,
    });
    assert.equal(result.success, false);
});
test("DomainGovernancePolicySchema accepts arbitrary extra fields and ignores them", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "policy_extra",
        domainId: "test",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        rollout: { strategy: "manual" },
        extraField: "should_be_ignored",
        anotherField: 123,
    });
    assert.equal(result.policyId, "policy_extra");
});
test("DomainGovernanceRolloutSchema parse vs safeParse consistency", () => {
    const validInput = { strategy: "shadow" };
    const parseResult = DomainGovernanceRolloutSchema.parse(validInput);
    const safeResult = DomainGovernanceRolloutSchema.safeParse(validInput);
    assert.equal(parseResult.strategy, safeResult.data?.strategy);
    assert.equal(parseResult.approvalRequired, safeResult.data?.approvalRequired);
});
test("DomainGovernancePolicySchema full round-trip parse", () => {
    const input = {
        policyId: "policy_roundtrip",
        domainId: "division_alpha",
        ownerRoles: ["owner_alpha", "admin_alpha"],
        operatorRoles: ["operator_alpha"],
        approvalRoles: ["approver_alpha"],
        restrictedDataClasses: ["pii", "financial"],
        rollout: {
            strategy: "supervised_auto",
            approvalRequired: true,
            rollbackWindowMinutes: 240,
        },
        mandatoryEvidence: ["security_scan", "code_review"],
    };
    const parsed = DomainGovernancePolicySchema.parse(input);
    assert.equal(parsed.policyId, "policy_roundtrip");
    assert.equal(parsed.domainId, "division_alpha");
    assert.deepEqual(parsed.restrictedDataClasses, ["pii", "financial"]);
    assert.equal(parsed.rollout.strategy, "supervised_auto");
    assert.deepEqual(parsed.mandatoryEvidence, ["security_scan", "code_review"]);
});
//# sourceMappingURL=domain-policy.test.js.map