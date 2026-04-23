import assert from "node:assert/strict";
import test from "node:test";
import { DomainInteractionPolicyService, isCrossDomainInteractionAllowed, } from "../../../../src/domains/interaction-policy/index.js";
test("integration: isCrossDomainInteractionAllowed returns true for allow rule", () => {
    const rules = [
        {
            sourceDomainId: "domain-a",
            targetDomainId: "domain-b",
            mode: "allow",
            maxConcurrentWorkflows: 5,
            compensationRequired: false,
        },
    ];
    assert.equal(isCrossDomainInteractionAllowed(rules, "domain-a", "domain-b"), true);
});
test("integration: isCrossDomainInteractionAllowed returns false for deny rule", () => {
    const rules = [
        {
            sourceDomainId: "domain-a",
            targetDomainId: "domain-b",
            mode: "deny",
            maxConcurrentWorkflows: 5,
            compensationRequired: false,
        },
    ];
    assert.equal(isCrossDomainInteractionAllowed(rules, "domain-a", "domain-b"), false);
});
test("integration: isCrossDomainInteractionAllowed returns false for missing rule", () => {
    const rules = [];
    assert.equal(isCrossDomainInteractionAllowed(rules, "domain-a", "domain-b"), false);
});
test("integration: DomainInteractionPolicyService evaluates allow rule", () => {
    const service = new DomainInteractionPolicyService();
    const rules = [
        {
            sourceDomainId: "src-domain",
            targetDomainId: "tgt-domain",
            mode: "allow",
            maxConcurrentWorkflows: 10,
            compensationRequired: false,
        },
    ];
    const request = {
        sourceDomainId: "src-domain",
        targetDomainId: "tgt-domain",
        actorId: "user-1",
        workflowId: "wf-1",
        concurrentWorkflowCount: 3,
    };
    const decision = service.evaluate(rules, request);
    assert.equal(decision.allowed, true);
    assert.equal(decision.requiresApproval, false);
    assert.equal(decision.compensationRequired, false);
    assert.ok(decision.reasonCodes.includes("domain_interaction.allowed"));
    assert.notEqual(decision.applicableRule, null);
});
test("integration: DomainInteractionPolicyService evaluates approval_required rule", () => {
    const service = new DomainInteractionPolicyService();
    const rules = [
        {
            sourceDomainId: "src-domain",
            targetDomainId: "tgt-domain",
            mode: "approval_required",
            maxConcurrentWorkflows: 5,
            compensationRequired: true,
        },
    ];
    const request = {
        sourceDomainId: "src-domain",
        targetDomainId: "tgt-domain",
        actorId: "user-1",
        workflowId: "wf-1",
        concurrentWorkflowCount: 1,
    };
    const decision = service.evaluate(rules, request);
    assert.equal(decision.allowed, false);
    assert.equal(decision.requiresApproval, true);
    assert.equal(decision.compensationRequired, true);
    assert.ok(decision.reasonCodes.includes("domain_interaction.approval_required"));
});
test("integration: DomainInteractionPolicyService evaluates deny rule", () => {
    const service = new DomainInteractionPolicyService();
    const rules = [
        {
            sourceDomainId: "src-domain",
            targetDomainId: "tgt-domain",
            mode: "deny",
            maxConcurrentWorkflows: 5,
            compensationRequired: false,
        },
    ];
    const request = {
        sourceDomainId: "src-domain",
        targetDomainId: "tgt-domain",
        actorId: "user-1",
        workflowId: "wf-1",
        concurrentWorkflowCount: 1,
    };
    const decision = service.evaluate(rules, request);
    assert.equal(decision.allowed, false);
    assert.equal(decision.requiresApproval, false);
    assert.ok(decision.reasonCodes.includes("domain_interaction.denied"));
});
test("integration: DomainInteractionPolicyService denies when rule not found", () => {
    const service = new DomainInteractionPolicyService();
    const rules = [];
    const request = {
        sourceDomainId: "src-domain",
        targetDomainId: "tgt-domain",
        actorId: "user-1",
        workflowId: "wf-1",
        concurrentWorkflowCount: 1,
    };
    const decision = service.evaluate(rules, request);
    assert.equal(decision.allowed, false);
    assert.equal(decision.requiresApproval, false);
    assert.ok(decision.reasonCodes.includes("domain_interaction.rule_not_found"));
});
test("integration: DomainInteractionPolicyService denies when concurrent limit exceeded", () => {
    const service = new DomainInteractionPolicyService();
    const rules = [
        {
            sourceDomainId: "src-domain",
            targetDomainId: "tgt-domain",
            mode: "allow",
            maxConcurrentWorkflows: 3,
            compensationRequired: false,
        },
    ];
    const request = {
        sourceDomainId: "src-domain",
        targetDomainId: "tgt-domain",
        actorId: "user-1",
        workflowId: "wf-1",
        concurrentWorkflowCount: 5,
    };
    const decision = service.evaluate(rules, request);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasonCodes.includes("domain_interaction.concurrent_limit_exceeded"));
});
test("integration: DomainInteractionPolicyService applies compensation_required flag", () => {
    const service = new DomainInteractionPolicyService();
    const rules = [
        {
            sourceDomainId: "src-domain",
            targetDomainId: "tgt-domain",
            mode: "allow",
            maxConcurrentWorkflows: 10,
            compensationRequired: true,
        },
    ];
    const request = {
        sourceDomainId: "src-domain",
        targetDomainId: "tgt-domain",
        actorId: "user-1",
        workflowId: "wf-1",
        concurrentWorkflowCount: 1,
    };
    const decision = service.evaluate(rules, request);
    assert.equal(decision.allowed, true);
    assert.equal(decision.compensationRequired, true);
    assert.ok(decision.reasonCodes.includes("domain_interaction.compensation_required"));
});
//# sourceMappingURL=interaction-policy-integration.test.js.map