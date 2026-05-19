import test from "node:test";
import assert from "node:assert/strict";
import { DelegatedGovernanceService } from "../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
function createMockDelegation(overrides = {}) {
    return {
        delegationId: "del-001",
        grantorId: "grantor-1",
        granteeId: "grantee-1",
        orgNodeIds: [],
        domainIds: [],
        permissions: [],
        guardrails: [],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revocable: true,
        status: "active",
        ...overrides,
    };
}
function createMockScope(overrides = {}) {
    return {
        orgNodeId: "org-node-1",
        capability: "tasks",
        ...overrides,
    };
}
function createMockContext(overrides = {}) {
    return {
        actorId: "actor-1",
        actorRole: "team_lead",
        orgNodeId: "org-node-1",
        domainId: "domain-1",
        ...overrides,
    };
}
test("DelegatedGovernanceService constructor accepts empty delegations", () => {
    const service = new DelegatedGovernanceService([]);
    assert.ok(service != null);
});
test("DelegatedGovernanceService resolve returns not allowed when no delegations match", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.resolve("grantee-1", createMockScope());
    assert.equal(result.allowed, false);
    assert.equal(result.delegationId, null);
    assert.ok(result.reasonCodes.includes("delegated_governance.scope_not_granted"));
});
test("DelegatedGovernanceService resolve returns allowed when delegation matches", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            granteeId: "matching-grantee",
            orgNodeIds: [],
            domainIds: [],
        }),
    ]);
    const result = service.resolve("matching-grantee", createMockScope());
    assert.equal(result.allowed, true);
    assert.ok(result.delegationId != null);
    assert.ok(result.reasonCodes.includes("delegated_governance.scope_granted"));
});
test("DelegatedGovernanceService checkOperation denies role not allowed by role guardrail", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.checkOperation(createMockContext({ actorRole: "team_lead" }), "manage_platform_settings");
    assert.equal(result.allowed, false);
    assert.ok(result.violatedGuardrails.includes("role_guardrail"));
});
test("DelegatedGovernanceService checkOperation allows role permitted by role guardrail", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.checkOperation(createMockContext({ actorRole: "division_admin" }), "domain_onboarding");
    assert.equal(result.allowed, true);
});
test("DelegatedGovernanceService getApplicableGuardrails returns guardrails for matching delegation", () => {
    const guardrails = [
        {
            guardrailId: "budget_limit",
            type: "max_budget",
            value: 1000,
        },
    ];
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            grantorId: "platform_team",
            status: "active",
            orgNodeIds: [],
            domainIds: [],
            guardrails,
        }),
    ]);
    const result = service.getApplicableGuardrails("any-org-node");
    assert.equal(result.length, 1);
    assert.equal(result[0].guardrailId, "budget_limit");
});
test("DelegatedGovernanceService getApplicableGuardrails filters by org node", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            grantorId: "platform_team",
            status: "active",
            orgNodeIds: ["specific-org"],
            domainIds: [],
            guardrails: [{ guardrailId: "specific", type: "max_budget", value: 1000 }],
        }),
    ]);
    const forSpecific = service.getApplicableGuardrails("specific-org");
    const forOther = service.getApplicableGuardrails("other-org");
    assert.equal(forSpecific.length, 1);
    assert.equal(forOther.length, 0);
});
test("DelegatedGovernanceService getApplicableGuardrails filters by domain", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            grantorId: "platform_team",
            status: "active",
            orgNodeIds: [],
            domainIds: ["specific-domain"],
            guardrails: [{ guardrailId: "domain-specific", type: "max_budget", value: 1000 }],
        }),
    ]);
    const forSpecific = service.getApplicableGuardrails("any-org", "specific-domain");
    const forOther = service.getApplicableGuardrails("any-org", "other-domain");
    assert.equal(forSpecific.length, 1);
    assert.equal(forOther.length, 0);
});
test("DelegatedGovernanceService getApplicableGuardrails ignores inactive delegations", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            status: "inactive",
            guardrails: [{ guardrailId: "inactive", type: "max_budget", value: 1000 }],
        }),
    ]);
    const result = service.getApplicableGuardrails("any-org");
    assert.equal(result.length, 0);
});
test("DelegatedGovernanceService listDelegationsForGrantee returns matching delegations", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({ granteeId: "target-grantee" }),
        createMockDelegation({ granteeId: "other-grantee" }),
        createMockDelegation({ granteeId: "target-grantee" }),
    ]);
    const result = service.listDelegationsForGrantee("target-grantee");
    assert.equal(result.length, 2);
});
test("DelegatedGovernanceService listDelegationsForGrantee returns empty for unknown grantee", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({ granteeId: "known-grantee" }),
    ]);
    const result = service.listDelegationsForGrantee("unknown-grantee");
    assert.deepStrictEqual(result, []);
});
test("DelegatedGovernanceService validateInheritanceRule denies tighten when child is higher in hierarchy", () => {
    const service = new DelegatedGovernanceService([]);
    // team_lead (3) is higher than department_admin (2), so childIndex < parentIndex
    const result = service.validateInheritanceRule("team_lead", "department_admin", "tighten");
    assert.equal(result.allowed, false);
});
test("DelegatedGovernanceService validateInheritanceRule denies loosen by lower role", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.validateInheritanceRule("department_admin", "team_lead", "loosen");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("Lower roles"));
});
test("DelegatedGovernanceService validateInheritanceRule denies loosen when child is higher in hierarchy", () => {
    const service = new DelegatedGovernanceService([]);
    // team_lead (3) is higher than department_admin (2), so childIndex > parentIndex
    const result = service.validateInheritanceRule("team_lead", "department_admin", "loosen");
    assert.equal(result.allowed, false);
});
test("DelegatedGovernanceService validateInheritanceRule allows append when child is higher or equal", () => {
    const service = new DelegatedGovernanceService([]);
    // team_lead (3) >= team_lead (3)
    const result = service.validateInheritanceRule("team_lead", "team_lead", "append");
    assert.equal(result.allowed, true);
});
test("DelegatedGovernanceService validateInheritanceRule allows delete from any role", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.validateInheritanceRule("team_lead", "team_lead", "delete");
    assert.equal(result.allowed, true);
});
test("DelegatedGovernanceService validateInheritanceRule denies unknown action", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.validateInheritanceRule("team_lead", "team_lead", "unknown");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("Unknown"));
});
test("DelegatedGovernanceService validateInheritanceRule handles hierarchy correctly", () => {
    const service = new DelegatedGovernanceService([]);
    // team_lead is lower than department_admin
    const result1 = service.validateInheritanceRule("division_admin", "team_lead", "loosen");
    assert.equal(result1.allowed, false);
    // Same level - should allow loosen (parent can loosen for equal)
    const result2 = service.validateInheritanceRule("team_lead", "team_lead", "loosen");
    assert.equal(result2.allowed, true);
});
test("DelegatedGovernanceService checkOperation evaluates guardrails for platform_team", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            grantorId: "platform_team",
            status: "active",
            orgNodeIds: [],
            domainIds: [],
            guardrails: [
                {
                    guardrailId: "max_amount",
                    type: "max_budget",
                    value: 1000,
                },
            ],
        }),
    ]);
    // division_admin has domain_onboarding allowed
    const result = service.checkOperation(createMockContext({ actorRole: "division_admin" }), "domain_onboarding");
    // Without attemptedValue, guardrail is not evaluated
    assert.equal(result.allowed, true);
});
test("DelegatedGovernanceService checkOperation evaluates guardrails with attemptedValue", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            grantorId: "platform_team",
            status: "active",
            orgNodeIds: [],
            domainIds: [],
            guardrails: [
                {
                    guardrailId: "max_amount",
                    type: "max_budget",
                    value: 1000,
                },
            ],
        }),
    ]);
    const result = service.checkOperation(createMockContext({ actorRole: "division_admin" }), "domain_onboarding", 500);
    assert.equal(result.allowed, true);
});
test("DelegatedGovernanceService checkOperation denies when guardrail violated", () => {
    const service = new DelegatedGovernanceService([
        createMockDelegation({
            grantorId: "platform_team",
            status: "active",
            orgNodeIds: [],
            domainIds: [],
            guardrails: [
                {
                    guardrailId: "max_amount",
                    type: "max_budget",
                    value: 1000,
                },
            ],
        }),
    ]);
    const result = service.checkOperation(createMockContext({ actorRole: "division_admin" }), "domain_onboarding", 5000);
    assert.equal(result.allowed, false);
    assert.ok(result.violatedGuardrails.includes("max_amount"));
});
//# sourceMappingURL=delegated-governance-service-coverage.test.js.map