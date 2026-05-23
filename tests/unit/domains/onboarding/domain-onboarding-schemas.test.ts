import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainOnboardingPhaseSchema,
  DomainOnboardingRecordSchema,
  nextOnboardingPhase,
  normalizeDomainOnboardingPhase,
  type DomainOnboardingPhase,
} from "../../../../src/domains/operations/index.js";

test("normalizeDomainOnboardingPhase maps alias 'modeling' to 'domain_modeling'", () => {
  assert.equal(normalizeDomainOnboardingPhase("modeling"), "domain_modeling");
});

test("normalizeDomainOnboardingPhase maps alias 'development_validation' to 'pack_development'", () => {
  assert.equal(normalizeDomainOnboardingPhase("development_validation"), "pack_development");
});

test("normalizeDomainOnboardingPhase maps alias 'canary_launch' to 'gray_rollout'", () => {
  assert.equal(normalizeDomainOnboardingPhase("canary_launch"), "gray_rollout");
});

test("normalizeDomainOnboardingPhase returns input for canonical phase names", () => {
  assert.equal(normalizeDomainOnboardingPhase("domain_modeling"), "domain_modeling");
  assert.equal(normalizeDomainOnboardingPhase("pack_development"), "pack_development");
  assert.equal(normalizeDomainOnboardingPhase("security_certification"), "security_certification");
  assert.equal(normalizeDomainOnboardingPhase("gray_rollout"), "gray_rollout");
});

test("normalizeDomainOnboardingPhase is case sensitive", () => {
  assert.equal(normalizeDomainOnboardingPhase("MODELING"), "MODELING");
  assert.equal(normalizeDomainOnboardingPhase("Domain_Modeling"), "Domain_Modeling");
});

test("DomainOnboardingPhaseSchema parses valid phases", () => {
  const phases: DomainOnboardingPhase[] = [
    "domain_modeling",
    "pack_development",
    "security_certification",
    "gray_rollout",
  ];

  for (const phase of phases) {
    const result = DomainOnboardingPhaseSchema.safeParse(phase);
    assert.equal(result.success, true, `Expected ${phase} to parse successfully`);
  }
});

test("DomainOnboardingPhaseSchema parses aliases via normalization", () => {
  const aliasTests = [
    { input: "modeling", expected: "domain_modeling" },
    { input: "development_validation", expected: "pack_development" },
    { input: "canary_launch", expected: "gray_rollout" },
  ];

  for (const { input, expected } of aliasTests) {
    const result = DomainOnboardingPhaseSchema.safeParse(input);
    assert.equal(result.success, true, `Expected ${input} to parse successfully`);
    assert.equal(result.success ? result.data : null, expected);
  }
});

test("DomainOnboardingPhaseSchema rejects invalid phases", () => {
  const invalidPhases = [
    "invalid",
    "MODELING",
    "modeling_phase",
    "",
    "pending",
    "in_progress",
    "completed",
    "blocked",
    "null",
    "undefined",
  ];

  for (const phase of invalidPhases) {
    const result = DomainOnboardingPhaseSchema.safeParse(phase);
    assert.equal(result.success, false, `Expected ${JSON.stringify(phase)} to fail validation`);
  }
});

test("DomainOnboardingPhaseSchema rejects non-string inputs", () => {
  const nonStringInputs = [null, undefined, 123, {}, [], true, false];

  for (const input of nonStringInputs) {
    const result = DomainOnboardingPhaseSchema.safeParse(input);
    assert.equal(result.success, false, `Expected ${JSON.stringify(input)} to fail validation`);
  }
});

test("DomainOnboardingRecordSchema parses valid records", () => {
  const validRecord = {
    domainId: "test_domain",
    phase: "domain_modeling",
    status: "in_progress",
    evidenceArtifactIds: ["artifact_1", "artifact_2"],
  };

  const result = DomainOnboardingRecordSchema.safeParse(validRecord);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.domainId, "test_domain");
    assert.equal(result.data.phase, "domain_modeling");
    assert.equal(result.data.status, "in_progress");
    assert.deepEqual(result.data.evidenceArtifactIds, ["artifact_1", "artifact_2"]);
  }
});

test("DomainOnboardingRecordSchema applies default for evidenceArtifactIds", () => {
  const recordWithoutEvidence = {
    domainId: "test_domain",
    phase: "domain_modeling",
    status: "pending",
  };

  const result = DomainOnboardingRecordSchema.safeParse(recordWithoutEvidence);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.evidenceArtifactIds, []);
  }
});

test("DomainOnboardingRecordSchema rejects empty domainId", () => {
  const invalidRecord = {
    domainId: "",
    phase: "domain_modeling",
    status: "in_progress",
  };

  const result = DomainOnboardingRecordSchema.safeParse(invalidRecord);
  assert.equal(result.success, false);
});

test("DomainOnboardingRecordSchema accepts all valid status values", () => {
  const validStatuses = ["pending", "in_progress", "completed", "blocked"];

  for (const status of validStatuses) {
    const record = {
      domainId: "test",
      phase: "domain_modeling" as DomainOnboardingPhase,
      status,
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, true, `Expected status ${status} to be valid`);
  }
});

test("DomainOnboardingRecordSchema rejects invalid status values", () => {
  const invalidStatuses = [
    "pending_",
    "inProgress",
    "COMPLETED",
    "blocked_phase",
    "failed",
    "skipped",
    "active",
    "",
  ];

  for (const status of invalidStatuses) {
    const record = {
      domainId: "test",
      phase: "domain_modeling" as DomainOnboardingPhase,
      status,
    };
    const result = DomainOnboardingRecordSchema.safeParse(record);
    assert.equal(result.success, false, `Expected status ${status} to be invalid`);
  }
});

test("DomainOnboardingRecordSchema validates phase via DomainOnboardingPhaseSchema", () => {
  const recordWithInvalidPhase = {
    domainId: "test",
    phase: "invalid_phase",
    status: "in_progress",
  };

  const result = DomainOnboardingRecordSchema.safeParse(recordWithInvalidPhase);
  assert.equal(result.success, false);
});

test("nextOnboardingPhase returns pack_development for domain_modeling", () => {
  assert.equal(nextOnboardingPhase("domain_modeling"), "pack_development");
});

test("nextOnboardingPhase returns security_certification for pack_development", () => {
  assert.equal(nextOnboardingPhase("pack_development"), "security_certification");
});

test("nextOnboardingPhase returns gray_rollout for security_certification", () => {
  assert.equal(nextOnboardingPhase("security_certification"), "gray_rollout");
});

test("nextOnboardingPhase returns null for gray_rollout (last phase)", () => {
  assert.equal(nextOnboardingPhase("gray_rollout"), null);
});

test("nextOnboardingPhase handles aliases correctly", () => {
  assert.equal(nextOnboardingPhase("modeling" as DomainOnboardingPhase), "pack_development");
  assert.equal(nextOnboardingPhase("development_validation" as DomainOnboardingPhase), "security_certification");
  assert.equal(nextOnboardingPhase("canary_launch" as DomainOnboardingPhase), null);
});

test("nextOnboardingPhase is deterministic - same input gives same output", () => {
  const phases: DomainOnboardingPhase[] = [
    "domain_modeling",
    "pack_development",
    "security_certification",
    "gray_rollout",
  ];

  for (const phase of phases) {
    const result1 = nextOnboardingPhase(phase);
    const result2 = nextOnboardingPhase(phase);
    assert.equal(result1, result2);
  }
});

test("nextOnboardingPhase chain covers all phases in order", () => {
  const chain: DomainOnboardingPhase[] = ["domain_modeling"];
  let current: DomainOnboardingPhase | null = "domain_modeling";

  while (current !== null) {
    const next = nextOnboardingPhase(current);
    if (next !== null) {
      chain.push(next);
    }
    current = next;
  }

  assert.deepEqual(chain, [
    "domain_modeling",
    "pack_development",
    "security_certification",
    "gray_rollout",
  ]);
});

test("nextOnboardingPhase invalid phase returns null", () => {
  assert.equal(nextOnboardingPhase("invalid_phase" as DomainOnboardingPhase), null);
});

test("DomainOnboardingPhase type is string literal union", () => {
  const phase: DomainOnboardingPhase = "domain_modeling";
  assert.equal(phase, "domain_modeling");

  const phase2: DomainOnboardingPhase = "gray_rollout";
  assert.equal(phase2, "gray_rollout");
});

test("DomainOnboardingRecordSchema can infer type", () => {
  const record = {
    domainId: "test",
    phase: "domain_modeling" as DomainOnboardingPhase,
    status: "in_progress" as const,
  };

  const result = DomainOnboardingRecordSchema.parse(record);
  assert.equal(result.domainId, "test");
  assert.equal(result.phase, "domain_modeling");
  assert.equal(result.status, "in_progress");
});

test("normalizeDomainOnboardingPhase preserves already canonical phases", () => {
  const canonicalPhases: DomainOnboardingPhase[] = [
    "domain_modeling",
    "pack_development",
    "security_certification",
    "gray_rollout",
  ];

  for (const phase of canonicalPhases) {
    assert.equal(normalizeDomainOnboardingPhase(phase), phase);
  }
});

test("DomainOnboardingPhaseSchema preprocesses before validating", () => {
  // The schema uses z.preprocess to normalize first, then validate
  const result = DomainOnboardingPhaseSchema.safeParse("modeling");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data, "domain_modeling");
  }
});

test("DomainOnboardingRecordSchema evidenceArtifactIds can be empty", () => {
  const record = {
    domainId: "test",
    phase: "domain_modeling",
    status: "in_progress",
    evidenceArtifactIds: [],
  };

  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.evidenceArtifactIds, []);
  }
});

test("DomainOnboardingRecordSchema evidenceArtifactIds preserves duplicates", () => {
  const record = {
    domainId: "test",
    phase: "domain_modeling",
    status: "in_progress",
    evidenceArtifactIds: ["a", "b", "a", "c", "b"],
  };

  const result = DomainOnboardingRecordSchema.safeParse(record);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.evidenceArtifactIds, ["a", "b", "a", "c", "b"]);
  }
});
