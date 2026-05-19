import assert from "node:assert/strict";
import test from "node:test";
import { DomainOnboardingPhaseSchema, DomainOnboardingRecordSchema, nextOnboardingPhase, } from "../../../../src/domains/operations/index.js";
test("nextOnboardingPhase returns correct next phase for each phase", () => {
    assert.equal(nextOnboardingPhase("domain_modeling"), "pack_development");
});
test("nextOnboardingPhase returns correct next phase for pack_development", () => {
    assert.equal(nextOnboardingPhase("pack_development"), "security_certification");
});
test("nextOnboardingPhase returns correct next phase for security_certification", () => {
    assert.equal(nextOnboardingPhase("security_certification"), "gray_rollout");
});
test("nextOnboardingPhase returns null for gray_rollout (final phase)", () => {
    assert.equal(nextOnboardingPhase("gray_rollout"), null);
});
test("DomainOnboardingPhaseSchema accepts valid phases", () => {
    const phases = ["domain_modeling", "pack_development", "security_certification", "gray_rollout"];
    for (const phase of phases) {
        const result = DomainOnboardingPhaseSchema.safeParse(phase);
        assert.equal(result.success, true, `Phase ${phase} should be valid`);
    }
});
test("DomainOnboardingPhaseSchema rejects invalid phases", () => {
    const result = DomainOnboardingPhaseSchema.safeParse("invalid_phase");
    assert.equal(result.success, false);
});
test("DomainOnboardingRecordSchema accepts valid record", () => {
    const record = {
        domainId: "test-domain",
        phase: "domain_modeling",
        status: "in_progress",
        evidenceArtifactIds: ["artifact-1", "artifact-2"],
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, true);
});
test("DomainOnboardingRecordSchema applies default for evidenceArtifactIds", () => {
    const record = {
        domainId: "test-domain",
        phase: "domain_modeling",
        status: "pending",
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, true);
    assert.deepEqual(result.data?.evidenceArtifactIds, []);
});
test("DomainOnboardingRecordSchema rejects empty domainId", () => {
    const record = {
        domainId: "",
        phase: "domain_modeling",
        status: "pending",
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, false);
});
test("DomainOnboardingRecordSchema accepts all valid statuses", () => {
    const statuses = ["pending", "in_progress", "completed", "blocked"];
    for (const status of statuses) {
        const record = {
            domainId: "test-domain",
            phase: "domain_modeling",
            status,
        };
        const result = DomainOnboardingRecordSchema.safeParse(record);
        assert.equal(result.success, true, `Status ${status} should be valid`);
    }
});
test("DomainOnboardingRecordSchema rejects invalid status", () => {
    const record = {
        domainId: "test-domain",
        phase: "domain_modeling",
        status: "invalid_status",
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, false);
});
//# sourceMappingURL=index.test.js.map