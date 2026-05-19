import assert from "node:assert/strict";
import test from "node:test";
import { DomainOnboardingService } from "../../../../src/domains/operations/index.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
function registerTestDomain(registry, domainId, status = "testing") {
    registry.register({
        domainId,
        name: `${domainId} domain`,
        description: `Test domain for ${domainId}`,
        version: 1,
        workflows: [
            {
                workflowId: `${domainId}_wf`,
                name: `${domainId} workflow`,
                triggerConditions: {},
                steps: [
                    {
                        stepName: "execute",
                        toolHints: [],
                        modelHints: {},
                        outputSchema: null,
                        retryPolicy: { maxRetries: 0, backoffMs: 0 },
                        requiresReview: false,
                        timeoutMs: 60000,
                        dependsOn: [],
                    },
                ],
            },
        ],
        toolBundles: [
            {
                bundleId: `${domainId}_tools`,
                tools: [],
            },
        ],
        outputContracts: [],
        promptOverrides: {},
        capabilities: {
            supportedTaskTypes: ["implement"],
            requiredTools: [],
            optionalTools: [],
            modelPreferences: {},
            budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
            securityLevel: "standard",
        },
        status,
        externalAdapters: [],
        pluginBindings: [],
    });
}
test("DomainOnboardingService.start creates session with domain_modeling phase", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_start");
    const service = new DomainOnboardingService(registry);
    const session = service.start("test_start");
    assert.equal(session.domainId, "test_start");
    assert.equal(session.activePhase, "domain_modeling");
    assert.equal(session.completed, false);
    assert.equal(session.records.length, 1);
    assert.equal(session.records[0]?.phase, "domain_modeling");
    assert.equal(session.records[0]?.status, "in_progress");
    assert.deepEqual(session.records[0]?.evidenceArtifactIds, []);
});
test("DomainOnboardingService.start is idempotent for same domain", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_idempotent");
    const service = new DomainOnboardingService(registry);
    const first = service.start("test_idempotent");
    const second = service.start("test_idempotent");
    assert.equal(first.records.length, 1);
    assert.equal(second.records.length, 1);
    assert.equal(second.activePhase, "domain_modeling");
});
test("DomainOnboardingService.start throws for unknown domain", () => {
    const registry = new DomainRegistryService();
    const service = new DomainOnboardingService(registry);
    assert.throws(() => service.start("nonexistent"), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.domain_not_found");
        return true;
    });
});
test("DomainOnboardingService.advance progresses through all phases and activates domain", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_advance");
    const service = new DomainOnboardingService(registry);
    service.start("test_advance");
    let session = service.advance("test_advance", ["modeling_artifact"]);
    assert.equal(session.activePhase, "pack_development");
    assert.equal(session.records[0]?.status, "completed");
    assert.deepEqual(session.records[0]?.evidenceArtifactIds, ["modeling_artifact"]);
    session = service.advance("test_advance", ["validation_artifact"]);
    assert.equal(session.activePhase, "security_certification");
    session = service.advance("test_advance", ["security_artifact"]);
    assert.equal(session.activePhase, "gray_rollout");
    session = service.advance("test_advance", ["canary_artifact"]);
    assert.equal(session.completed, true);
    assert.equal(session.activatedDomainStatus, "active");
});
test("DomainOnboardingService.advance requires evidence", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_evidence");
    const service = new DomainOnboardingService(registry);
    service.start("test_evidence");
    assert.throws(() => service.advance("test_evidence", []), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.evidence_required");
        return true;
    });
});
test("DomainOnboardingService.advance merges and deduplicates evidence artifact ids", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_merge", "active");
    const service = new DomainOnboardingService(registry);
    service.start("test_merge");
    const session = service.advance("test_merge", ["artifact_1", "artifact_2", "artifact_1"]);
    assert.equal(session.records[0]?.evidenceArtifactIds.length, 2);
    assert.ok(session.records[0]?.evidenceArtifactIds.includes("artifact_1"));
    assert.ok(session.records[0]?.evidenceArtifactIds.includes("artifact_2"));
});
test("DomainOnboardingService.advance throws when no active phase exists", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_no_active");
    const service = new DomainOnboardingService(registry);
    service.start("test_no_active");
    // Complete all phases
    service.advance("test_no_active", ["modeling"]);
    service.advance("test_no_active", ["validation"]);
    service.advance("test_no_active", ["security"]);
    service.advance("test_no_active", ["canary"]);
    assert.throws(() => service.advance("test_no_active", ["extra"]), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.no_active_phase");
        return true;
    });
});
test("DomainOnboardingService.advance throws for unknown domain", () => {
    const registry = new DomainRegistryService();
    const service = new DomainOnboardingService(registry);
    assert.throws(() => service.advance("nonexistent", ["artifact"]), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.domain_not_found");
        return true;
    });
});
test("DomainOnboardingService.block marks current phase as blocked", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_block");
    const service = new DomainOnboardingService(registry);
    service.start("test_block");
    const session = service.block("test_block", "block_reason_artifact");
    assert.equal(session.activePhase, null);
    const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
    assert.equal(modelingRecord?.status, "blocked");
    assert.ok(modelingRecord?.evidenceArtifactIds.includes("block_reason_artifact"));
});
test("DomainOnboardingService.block throws when no active phase exists", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_block_no_active");
    const service = new DomainOnboardingService(registry);
    // No session started
    assert.throws(() => service.block("test_block_no_active", "reason"), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.session_not_started");
        return true;
    });
});
test("DomainOnboardingService.rollback restores to earlier phase", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_rollback", "active");
    const service = new DomainOnboardingService(registry);
    service.start("test_rollback");
    // Advance to development_validation
    service.advance("test_rollback", ["modeling_evidence"]);
    // Rollback to modeling
    const session = service.rollback("test_rollback", "domain_modeling", "rollback_checkpoint", "test reason");
    assert.equal(session.activePhase, "domain_modeling");
    const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
    assert.equal(modelingRecord?.status, "in_progress");
    assert.ok(modelingRecord?.evidenceArtifactIds.includes("rollback_checkpoint"));
    const devRecord = session.records.find((r) => r.phase === "pack_development");
    assert.equal(devRecord?.status, "pending");
    assert.equal(session.rollbackHistory.length, 1);
    assert.equal(session.rollbackHistory[0]?.phase, "pack_development");
    assert.equal(session.rollbackHistory[0]?.checkpointArtifactId, "rollback_checkpoint");
    assert.equal(session.rollbackHistory[0]?.reason, "test reason");
});
test("DomainOnboardingService.rollback reopens a completed phase when re-advancing", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_reopen", "active");
    const service = new DomainOnboardingService(registry);
    service.start("test_reopen");
    // Complete modeling
    let session = service.advance("test_reopen", ["modeling_evidence"]);
    assert.equal(session.records[0]?.status, "completed");
    // Rollback to modeling
    session = service.rollback("test_reopen", "domain_modeling", "checkpoint", "rollback");
    // Re-advance through modeling
    session = service.advance("test_reopen", ["new_modeling_evidence"]);
    assert.equal(session.activePhase, "pack_development");
    assert.equal(session.records[0]?.status, "completed");
    assert.ok(session.records[0]?.evidenceArtifactIds.includes("new_modeling_evidence"));
});
test("DomainOnboardingService.rollback throws when no session exists", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_rollback_no_session");
    const service = new DomainOnboardingService(registry);
    // No session started - should throw session_not_started
    assert.throws(() => service.rollback("test_rollback_no_session", "domain_modeling", "checkpoint", "reason"), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.session_not_started");
        return true;
    });
});
test("DomainOnboardingService.rollback throws when all phases are completed", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_rollback_complete");
    const service = new DomainOnboardingService(registry);
    service.start("test_rollback_complete");
    // Complete all phases
    service.advance("test_rollback_complete", ["modeling"]);
    service.advance("test_rollback_complete", ["validation"]);
    service.advance("test_rollback_complete", ["security"]);
    service.advance("test_rollback_complete", ["canary"]);
    // Now there's no active phase - should throw no_active_phase
    assert.throws(() => service.rollback("test_rollback_complete", "domain_modeling", "checkpoint", "reason"), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.no_active_phase");
        return true;
    });
});
test("DomainOnboardingService.get returns current session state", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_get", "active");
    const service = new DomainOnboardingService(registry);
    service.start("test_get");
    service.advance("test_get", ["modeling_art"]);
    const session = service.get("test_get");
    assert.equal(session.domainId, "test_get");
    assert.equal(session.activePhase, "pack_development");
    assert.equal(session.completed, false);
    assert.equal(session.records.length, 2);
});
test("DomainOnboardingService.get throws for unknown domain", () => {
    const registry = new DomainRegistryService();
    const service = new DomainOnboardingService(registry);
    assert.throws(() => service.get("nonexistent"), (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.code, "domain_onboarding.domain_not_found");
        return true;
    });
});
test("DomainOnboardingService.list returns all sessions", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "domain_a");
    registerTestDomain(registry, "domain_b");
    registerTestDomain(registry, "domain_c");
    const service = new DomainOnboardingService(registry);
    service.start("domain_a");
    service.start("domain_b");
    service.start("domain_c");
    const sessions = service.list();
    assert.equal(sessions.length, 3);
    assert.ok(sessions.some((s) => s.domainId === "domain_a"));
    assert.ok(sessions.some((s) => s.domainId === "domain_b"));
    assert.ok(sessions.some((s) => s.domainId === "domain_c"));
});
test("DomainOnboardingService.list returns sessions in sorted order", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "z_domain");
    registerTestDomain(registry, "a_domain");
    const service = new DomainOnboardingService(registry);
    service.start("z_domain");
    service.start("a_domain");
    const sessions = service.list();
    assert.equal(sessions[0]?.domainId, "a_domain");
    assert.equal(sessions[1]?.domainId, "z_domain");
});
test("DomainOnboardingService.session maintains separate state per domain", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "domain_x");
    registerTestDomain(registry, "domain_y");
    const service = new DomainOnboardingService(registry);
    service.start("domain_x");
    service.start("domain_y");
    service.advance("domain_x", ["modeling"]);
    const sessionX = service.get("domain_x");
    const sessionY = service.get("domain_y");
    assert.equal(sessionX.activePhase, "pack_development");
    assert.equal(sessionY.activePhase, "domain_modeling");
});
test("DomainOnboardingService.rollbackHistory persists multiple rollbacks", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_multi_rollback");
    const service = new DomainOnboardingService(registry);
    service.start("test_multi_rollback");
    service.advance("test_multi_rollback", ["modeling"]);
    service.rollback("test_multi_rollback", "domain_modeling", "checkpoint_1", "first rollback");
    service.advance("test_multi_rollback", ["modeling_v2"]);
    service.rollback("test_multi_rollback", "domain_modeling", "checkpoint_2", "second rollback");
    const session = service.get("test_multi_rollback");
    assert.equal(session.rollbackHistory.length, 2);
    assert.equal(session.rollbackHistory[0]?.reason, "first rollback");
    assert.equal(session.rollbackHistory[1]?.reason, "second rollback");
});
test("DomainOnboardingService.completed is true only when all phases are completed", () => {
    const registry = new DomainRegistryService();
    registerTestDomain(registry, "test_complete");
    const service = new DomainOnboardingService(registry);
    service.start("test_complete");
    assert.equal(service.get("test_complete").completed, false);
    service.advance("test_complete", ["modeling"]);
    assert.equal(service.get("test_complete").completed, false);
    service.advance("test_complete", ["validation"]);
    assert.equal(service.get("test_complete").completed, false);
    service.advance("test_complete", ["security"]);
    assert.equal(service.get("test_complete").completed, false);
    service.advance("test_complete", ["canary"]);
    assert.equal(service.get("test_complete").completed, true);
});
//# sourceMappingURL=domain-onboarding-service.test.js.map