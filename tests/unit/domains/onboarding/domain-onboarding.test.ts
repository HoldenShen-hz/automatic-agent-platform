import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainOnboardingPhaseSchema,
  DomainOnboardingRecordSchema,
  nextOnboardingPhase,
  type DomainOnboardingPhase,
} from "../../../../src/domains/operations/index.js";

test("DomainOnboardingPhaseSchema accepts valid phases", () => {
  const validPhases: DomainOnboardingPhase[] = [
    "modeling",
    "development_validation",
    "security_certification",
    "canary_launch",
  ];

  for (const phase of validPhases) {
    const result = DomainOnboardingPhaseSchema.safeParse(phase);
    assert.equal(result.success, true, `Expected ${phase} to be valid`);
  }
});

test("DomainOnboardingPhaseSchema rejects invalid phases", () => {
  const invalidPhases = [
    "invalid",
    "MODELING",
    "modeling_phase",
    "",
    null,
    undefined,
  ];

  for (const phase of invalidPhases) {
    const result = DomainOnboardingPhaseSchema.safeParse(phase);
    assert.equal(result.success, false, `Expected ${JSON.stringify(phase)} to be invalid`);
  }
});

test("DomainOnboardingRecordSchema accepts valid records", () => {
  const validRecord = {
    domainId: "test_domain",
    phase: "modeling",
    status: "in_progress",
    evidenceArtifactIds: ["artifact_1", "artifact_2"],
  };

  const result = DomainOnboardingRecordSchema.safeParse(validRecord);
  assert.equal(result.success, true);
});

test("DomainOnboardingRecordSchema applies default evidenceArtifactIds", () => {
  const recordWithoutEvidence = {
    domainId: "test_domain",
    phase: "modeling",
    status: "in_progress",
  };

  const result = DomainOnboardingRecordSchema.safeParse(recordWithoutEvidence);
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.evidenceArtifactIds, []);
});

test("DomainOnboardingRecordSchema rejects invalid status", () => {
  const invalidRecord = {
    domainId: "test_domain",
    phase: "modeling",
    status: "invalid_status",
  };

  const result = DomainOnboardingRecordSchema.safeParse(invalidRecord);
  assert.equal(result.success, false);
});

test("DomainOnboardingRecordSchema rejects empty domainId", () => {
  const invalidRecord = {
    domainId: "",
    phase: "modeling",
    status: "in_progress",
  };

  const result = DomainOnboardingRecordSchema.safeParse(invalidRecord);
  assert.equal(result.success, false);
});

test("nextOnboardingPhase returns correct next phase for modeling", () => {
  const next = nextOnboardingPhase("modeling");
  assert.equal(next, "development_validation");
});

test("nextOnboardingPhase returns correct next phase for development_validation", () => {
  const next = nextOnboardingPhase("development_validation");
  assert.equal(next, "security_certification");
});

test("nextOnboardingPhase returns correct next phase for security_certification", () => {
  const next = nextOnboardingPhase("security_certification");
  assert.equal(next, "canary_launch");
});

test("nextOnboardingPhase returns null for canary_launch (last phase)", () => {
  const next = nextOnboardingPhase("canary_launch");
  assert.equal(next, null);
});

test("nextOnboardingPhase is deterministic", () => {
  const phase = "modeling";
  const result1 = nextOnboardingPhase(phase);
  const result2 = nextOnboardingPhase(phase);
  assert.equal(result1, result2);
  assert.equal(result1, "development_validation");
});

test("DomainOnboardingPhase type matches schema inference", () => {
  const phase: DomainOnboardingPhase = "modeling";
  assert.equal(phase, "modeling");

  const phase2: DomainOnboardingPhase = "canary_launch";
  assert.equal(phase2, "canary_launch");
});

test("valid record status values", () => {
  const validStatuses = ["pending", "in_progress", "completed", "blocked"];

  for (const status of validStatuses) {
    const record = {
      domainId: "test",
      phase: "modeling" as DomainOnboardingPhase,
      status,
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, true, `Expected status ${status} to be valid`);
  }
});

test("invalid record status values are rejected", () => {
  const invalidStatuses = [
    "pending_",
    "inProgress",
    "COMPLETED",
    "blocked_phase",
    "failed",
    "skipped",
  ];

  for (const status of invalidStatuses) {
    const record = {
      domainId: "test",
      phase: "modeling" as DomainOnboardingPhase,
      status,
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, false, `Expected status ${status} to be invalid`);
  }
});

test("evidenceArtifactIds can be empty array", () => {
  const record = {
    domainId: "test",
    phase: "modeling",
    status: "in_progress",
    evidenceArtifactIds: [],
  };

  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.evidenceArtifactIds, []);
});

test("evidenceArtifactIds can contain duplicate values (deduplication happens elsewhere)", () => {
  const record = {
    domainId: "test",
    phase: "modeling",
    status: "in_progress",
    evidenceArtifactIds: ["a", "b", "a", "c", "b"],
  };

  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.evidenceArtifactIds, ["a", "b", "a", "c", "b"]);
});

test("all onboarding phases are covered by nextOnboardingPhase", () => {
  const phases: DomainOnboardingPhase[] = [
    "modeling",
    "development_validation",
    "security_certification",
    "canary_launch",
  ];

  for (let i = 0; i < phases.length; i++) {
    const current = phases[i]!;
    const next = nextOnboardingPhase(current);
    if (i < phases.length - 1) {
      assert.notEqual(next, null, `Expected next phase for ${current} to not be null`);
      assert.equal(next, phases[i + 1]);
    } else {
      assert.equal(next, null, `Expected next phase for ${current} (last) to be null`);
    }
  }
});
