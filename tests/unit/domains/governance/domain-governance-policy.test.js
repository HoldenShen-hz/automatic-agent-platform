import assert from "node:assert/strict";
import test from "node:test";
import { DomainGovernanceRolloutSchema, DomainGovernancePolicySchema, } from "../../../../src/domains/governance/domain-governance-policy.js";
test("DomainGovernanceRolloutSchema parses valid rollout", () => {
    const result = DomainGovernanceRolloutSchema.parse({
        strategy: "canary",
        approvalRequired: true,
        rollbackWindowMinutes: 120,
    });
    assert.equal(result.strategy, "canary");
    assert.equal(result.approvalRequired, true);
    assert.equal(result.rollbackWindowMinutes, 120);
});
test("DomainGovernanceRolloutSchema applies defaults", () => {
    const result = DomainGovernanceRolloutSchema.parse({});
    assert.equal(result.strategy, "canary");
    assert.equal(result.approvalRequired, true);
    assert.equal(result.rollbackWindowMinutes, 60);
});
test("DomainGovernanceRolloutSchema accepts manual strategy", () => {
    const result = DomainGovernanceRolloutSchema.parse({ strategy: "manual" });
    assert.equal(result.strategy, "manual");
});
test("DomainGovernanceRolloutSchema accepts shadow strategy", () => {
    const result = DomainGovernanceRolloutSchema.parse({ strategy: "shadow" });
    assert.equal(result.strategy, "shadow");
});
test("DomainGovernanceRolloutSchema accepts supervised_auto strategy", () => {
    const result = DomainGovernanceRolloutSchema.parse({ strategy: "supervised_auto" });
    assert.equal(result.strategy, "supervised_auto");
});
test("DomainGovernanceRolloutSchema rejects invalid strategy", () => {
    assert.throws(() => {
        DomainGovernanceRolloutSchema.parse({ strategy: "auto" });
    });
});
test("DomainGovernanceRolloutSchema rejects zero rollbackWindowMinutes", () => {
    assert.throws(() => {
        DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: 0 });
    });
});
test("DomainGovernanceRolloutSchema rejects negative rollbackWindowMinutes", () => {
    assert.throws(() => {
        DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: -10 });
    });
});
test("DomainGovernancePolicySchema parses valid policy", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "pol-001",
        domainId: "domain-001",
        ownerRoles: ["domain-owner"],
        operatorRoles: ["domain-operator"],
        approvalRoles: ["domain-approver"],
        restrictedDataClasses: ["pii", "financial"],
        rollout: { strategy: "canary", approvalRequired: true, rollbackWindowMinutes: 60 },
        mandatoryEvidence: ["audit-log"],
    });
    assert.equal(result.policyId, "pol-001");
    assert.equal(result.domainId, "domain-001");
    assert.deepEqual(result.ownerRoles, ["domain-owner"]);
    assert.deepEqual(result.restrictedDataClasses, ["pii", "financial"]);
});
test("DomainGovernancePolicySchema applies defaults to rollout", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "pol-001",
        domainId: "domain-001",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.equal(result.rollout.strategy, "canary");
    assert.equal(result.rollout.approvalRequired, true);
    assert.equal(result.rollout.rollbackWindowMinutes, 60);
});
test("DomainGovernancePolicySchema applies defaults to arrays", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "pol-001",
        domainId: "domain-001",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.deepEqual(result.restrictedDataClasses, []);
    assert.deepEqual(result.mandatoryEvidence, []);
});
test("DomainGovernancePolicySchema rejects empty policyId", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "",
            domainId: "domain-001",
            ownerRoles: ["owner"],
            operatorRoles: ["operator"],
            approvalRoles: ["approver"],
        });
    });
});
test("DomainGovernancePolicySchema rejects empty domainId", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "",
            ownerRoles: ["owner"],
            operatorRoles: ["operator"],
            approvalRoles: ["approver"],
        });
    });
});
test("DomainGovernancePolicySchema rejects empty ownerRoles", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "domain-001",
            ownerRoles: [],
            operatorRoles: ["operator"],
            approvalRoles: ["approver"],
        });
    });
});
test("DomainGovernancePolicySchema rejects ownerRole with empty string", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "domain-001",
            ownerRoles: ["valid", ""],
            operatorRoles: ["operator"],
            approvalRoles: ["approver"],
        });
    });
});
test("DomainGovernancePolicySchema rejects empty operatorRoles", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "domain-001",
            ownerRoles: ["owner"],
            operatorRoles: [],
            approvalRoles: ["approver"],
        });
    });
});
test("DomainGovernancePolicySchema rejects empty approvalRoles", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "domain-001",
            ownerRoles: ["owner"],
            operatorRoles: ["operator"],
            approvalRoles: [],
        });
    });
});
test("DomainGovernancePolicySchema rejects empty string in operatorRoles", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "domain-001",
            ownerRoles: ["owner"],
            operatorRoles: ["op1", ""],
            approvalRoles: ["approver"],
        });
    });
});
test("DomainGovernancePolicySchema rejects empty string in approvalRoles", () => {
    assert.throws(() => {
        DomainGovernancePolicySchema.parse({
            policyId: "pol-001",
            domainId: "domain-001",
            ownerRoles: ["owner"],
            operatorRoles: ["operator"],
            approvalRoles: ["app1", ""],
        });
    });
});
test("DomainGovernancePolicySchema accepts optional fields omitted", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "pol-001",
        domainId: "domain-001",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.equal(result.restrictedDataClasses.length, 0);
    assert.equal(result.mandatoryEvidence.length, 0);
});
test("DomainGovernancePolicySchema accepts multiple owner roles", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "pol-001",
        domainId: "domain-001",
        ownerRoles: ["owner1", "owner2", "owner3"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
    });
    assert.equal(result.ownerRoles.length, 3);
});
test("DomainGovernancePolicySchema accepts nested rollout config", () => {
    const result = DomainGovernancePolicySchema.parse({
        policyId: "pol-001",
        domainId: "domain-001",
        ownerRoles: ["owner"],
        operatorRoles: ["operator"],
        approvalRoles: ["approver"],
        rollout: {
            strategy: "manual",
            approvalRequired: false,
            rollbackWindowMinutes: 240,
        },
    });
    assert.equal(result.rollout.strategy, "manual");
    assert.equal(result.rollout.approvalRequired, false);
    assert.equal(result.rollout.rollbackWindowMinutes, 240);
});
//# sourceMappingURL=domain-governance-policy.test.js.map