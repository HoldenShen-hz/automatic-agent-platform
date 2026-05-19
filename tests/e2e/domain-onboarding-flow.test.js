/**
 * E2E Domain Onboarding Flow Tests
 *
 * End-to-end tests covering the full domain onboarding lifecycle:
 * domain_modeling -> pack_development -> security_certification -> gray_rollout -> active
 *
 * These tests verify the complete onboarding flow including:
 * - Phase advancement with evidence
 * - Rollback capability
 * - Domain activation on completion
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DomainOnboardingService } from "../../src/domains/operations/domain-onboarding-service.js";
import { DomainRegistryService } from "../../src/domains/registry/domain-registry-service.js";
function registerTestDomain(service, domainId) {
    service.register({
        domainId,
        name: `Test Domain ${domainId}`,
        description: "E2E test domain",
        version: 1,
        workflows: [
            {
                workflowId: "wf_test",
                name: "Test Workflow",
                triggerConditions: {},
                steps: [
                    {
                        stepName: "step1",
                        toolHints: [],
                        modelHints: {},
                        outputSchema: null,
                        retryPolicy: { maxRetries: 0, backoffMs: 0 },
                        requiresReview: false,
                        timeoutMs: 1000,
                        dependsOn: [],
                    },
                ],
            },
        ],
        toolBundles: [
            {
                bundleId: "test-bundle",
                tools: [],
            },
        ],
        outputContracts: [],
        promptOverrides: {},
        capabilities: {
            supportedTaskTypes: ["test"],
            requiredTools: [],
            optionalTools: [],
            modelPreferences: {},
            budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
            securityLevel: "standard",
        },
        status: "validated",
        externalAdapters: [],
        pluginBindings: [],
    });
}
test("E2E: domain onboarding completes all phases and activates domain", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "coding");
    const service = new DomainOnboardingService(registry);
    let session = service.start("coding");
    // Phase 1: domain_modeling
    assert.equal(session.activePhase, "domain_modeling", "Should start at domain_modeling phase");
    assert.equal(session.completed, false, "Should not be completed");
    // Advance to phase 2: pack_development
    session = service.advance("coding", ["artifact:modeling-doc"]);
    assert.equal(session.activePhase, "pack_development", "Should advance to pack_development");
    assert.ok(session.records.find((r) => r.phase === "domain_modeling")?.status === "completed", "domain_modeling should be completed");
    // Advance to phase 3: security_certification
    session = service.advance("coding", ["artifact:validation-report"]);
    assert.equal(session.activePhase, "security_certification", "Should advance to security_certification");
    // Advance to phase 4: gray_rollout
    session = service.advance("coding", ["artifact:security-cert"]);
    assert.equal(session.activePhase, "gray_rollout", "Should advance to gray_rollout");
    // Advance to completed (activates domain)
    session = service.advance("coding", ["artifact:canary-success"]);
    assert.equal(session.completed, true, "Onboarding should be completed");
    assert.equal(session.activatedDomainStatus, "active", "Domain should be activated");
    // Verify domain is registered as active
    const domain = registry.get("coding");
    assert.equal(domain?.status, "active", "Domain status should be active");
});
test("E2E: domain onboarding blocks advancement without evidence", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "data_proc");
    const service = new DomainOnboardingService(registry);
    service.start("data_proc");
    // Attempt to advance without evidence - should throw
    assert.throws(() => service.advance("data_proc", []), (error) => {
        return error.code === "domain_onboarding.evidence_required";
    }, "Should require evidence for advancement");
});
test("E2E: domain onboarding can rollback to earlier phase", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "ml_ops");
    const service = new DomainOnboardingService(registry);
    service.start("ml_ops");
    // Advance to pack_development
    let session = service.advance("ml_ops", ["artifact:modeling"]);
    assert.equal(session.activePhase, "pack_development");
    // Advance to security_certification
    session = service.advance("ml_ops", ["artifact:validation"]);
    assert.equal(session.activePhase, "security_certification");
    // Rollback to domain_modeling phase
    session = service.rollback("ml_ops", "domain_modeling", "artifact:checkpoint-1", "Quality issues found");
    assert.equal(session.activePhase, "domain_modeling", "Should rollback to domain_modeling");
    assert.equal(session.records.filter((record) => record.status === "in_progress").length, 1, "Only the target phase should remain active after rollback");
    // Verify rollback history is recorded
    const history = session.rollbackHistory;
    assert.ok(history.length > 0, "Should have rollback history");
    assert.equal(history[0].reason, "Quality issues found", "Should record rollback reason");
    // Restart and verify can still advance
    session = service.advance("ml_ops", ["artifact:modeling-v2"]);
    assert.equal(session.activePhase, "pack_development", "Should be able to re-advance");
    assert.equal(session.records.filter((record) => record.phase === "pack_development").length, 1, "Rollback and re-advance should not duplicate the next phase record");
});
test("E2E: domain onboarding records completion even when activation smoke test fails", () => {
    const registry = new DomainRegistryService();
    // Register domain without workflows (smoke test should catch this)
    registry.register({
        domainId: "incomplete",
        name: "Incomplete Domain",
        description: "Domain missing workflows",
        version: 1,
        workflows: [], // Empty workflows - smoke test may fail
        toolBundles: [],
        outputContracts: [],
        promptOverrides: {},
        capabilities: {
            supportedTaskTypes: [],
            requiredTools: [],
            optionalTools: [],
            modelPreferences: {},
            budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
            securityLevel: "standard",
        },
        status: "validated",
        externalAdapters: [],
        pluginBindings: [],
    });
    const service = new DomainOnboardingService(registry);
    service.start("incomplete");
    // Advance through all phases
    let session = service.advance("incomplete", ["artifact:1"]);
    session = service.advance("incomplete", ["artifact:2"]);
    session = service.advance("incomplete", ["artifact:3"]);
    assert.throws(() => service.advance("incomplete", ["artifact:4"]), (error) => error.code === "domain_registry.smoke_test_failed", "Final activation should surface the smoke test failure");
    // Even though activation fails, the onboarding session has completed all phases.
    session = service.get("incomplete");
    assert.equal(session.completed, true, "Onboarding flow should complete");
    assert.equal(session.activatedDomainStatus, "registered", "Domain should remain registered when smoke test fails");
});
test("E2E: domain onboarding preserves evidence across phases", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "evidence_flow");
    const service = new DomainOnboardingService(registry);
    service.start("evidence_flow");
    let session = service.advance("evidence_flow", ["artifact:modeling", "artifact:modeling-rollback"]);
    assert.equal(session.activePhase, "pack_development");
    session = service.advance("evidence_flow", ["artifact:validation", "artifact:validation-checklist"]);
    assert.equal(session.activePhase, "security_certification");
    const modelingRecord = session.records.find((record) => record.phase === "domain_modeling");
    const validationRecord = session.records.find((record) => record.phase === "pack_development");
    assert.deepEqual(modelingRecord?.evidenceArtifactIds, ["artifact:modeling", "artifact:modeling-rollback"], "Modeling evidence should remain attached to the modeling phase");
    assert.deepEqual(validationRecord?.evidenceArtifactIds, ["artifact:validation", "artifact:validation-checklist"], "Validation evidence should remain attached to the validation phase");
});
test("E2E: domain onboarding blocks and resumes a phase via advance", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "blocked_flow");
    const service = new DomainOnboardingService(registry);
    service.start("blocked_flow");
    let session = service.block("blocked_flow", "artifact:blocked");
    assert.equal(session.activePhase, null, "Blocked phase should leave no active phase");
    session = service.advance("blocked_flow", ["artifact:modeling-retry"]);
    assert.equal(session.activePhase, "pack_development", "Advance should reopen and complete the blocked phase");
    const modelingRecord = session.records.find((record) => record.phase === "domain_modeling");
    assert.deepEqual(modelingRecord?.evidenceArtifactIds, ["artifact:blocked", "artifact:modeling-retry"], "Blocked phase should keep its block evidence and merge resume evidence");
});
test("E2E: domain onboarding list returns all sessions", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "domain_a");
    registerTestDomain(registry, "domain_b");
    const service = new DomainOnboardingService(registry);
    service.start("domain_a");
    service.start("domain_b");
    const sessions = service.list();
    assert.equal(sessions.length, 2, "Should have sessions for both domains");
    const domainIds = sessions.map((s) => s.domainId).sort();
    assert.deepEqual(domainIds, ["domain_a", "domain_b"], "Should list all domain IDs sorted");
});
test("E2E: domain onboarding rejects advance on unknown domain", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "known");
    const service = new DomainOnboardingService(registry);
    assert.throws(() => service.advance("unknown_domain", ["artifact:x"]), (error) => {
        return error.code === "domain_onboarding.domain_not_found";
    }, "Should throw for unknown domain");
});
//# sourceMappingURL=domain-onboarding-flow.test.js.map