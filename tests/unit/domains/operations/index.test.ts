import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainOnboardingPhaseSchema,
  DomainOnboardingRecordSchema,
  nextOnboardingPhase,
} from "../../../../src/domains/operations/index.js";

test("nextOnboardingPhase returns correct next phase for each phase", (t) => {
  assert.equal(nextOnboardingPhase("modeling"), "development_validation");
});

test("nextOnboardingPhase returns correct next phase for development_validation", () => {
  assert.equal(nextOnboardingPhase("development_validation"), "security_certification");
});

test("nextOnboardingPhase returns correct next phase for security_certification", () => {
  assert.equal(nextOnboardingPhase("security_certification"), "canary_launch");
});

test("nextOnboardingPhase returns null for canary_launch (final phase)", () => {
  assert.equal(nextOnboardingPhase("canary_launch"), null);
});

test("DomainOnboardingPhaseSchema accepts valid phases", () => {
  const phases = ["modeling", "development_validation", "security_certification", "canary_launch"] as const;
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
    phase: "modeling" as const,
    status: "in_progress" as const,
    evidenceArtifactIds: ["artifact-1", "artifact-2"],
  };
  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, true);
});

test("DomainOnboardingRecordSchema applies default for evidenceArtifactIds", () => {
  const record = {
    domainId: "test-domain",
    phase: "modeling" as const,
    status: "pending" as const,
  };
  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.evidenceArtifactIds, []);
});

test("DomainOnboardingRecordSchema rejects empty domainId", () => {
  const record = {
    domainId: "",
    phase: "modeling" as const,
    status: "pending" as const,
  };
  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, false);
});

test("DomainOnboardingRecordSchema accepts all valid statuses", () => {
  const statuses = ["pending", "in_progress", "completed", "blocked"] as const;
  for (const status of statuses) {
    const record = {
      domainId: "test-domain",
      phase: "modeling" as const,
      status,
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, true, `Status ${status} should be valid`);
  }
});

test("DomainOnboardingRecordSchema rejects invalid status", () => {
  const record = {
    domainId: "test-domain",
    phase: "modeling" as const,
    status: "invalid_status" as any,
  };
  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, false);
});
