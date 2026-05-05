/**
 * Golden Test: Learning Object Model Schema Output
 *
 * Verifies learning-object-model.ts and learning-artifact-model.ts produce
 * correct output structure for learning objects and artifacts.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LearningObjectSchema,
  parseLearningObject,
  type LearningObject,
} from "../../src/platform/five-plane-orchestration/learn/learning-object-model.js";
import {
  LearningArtifactSchema,
  ArtifactFormatSchema,
  createLearningArtifact,
  parseLearningArtifact,
  type ArtifactFormat,
} from "../../src/platform/five-plane-orchestration/learn/learning-artifact-model.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: LearningObjectSchema produces correct structure", () => {
  const validObject = {
    learningObjectId: "lo_001",
    learningType: "failure_pattern" as const,
    title: "Retry on timeout errors",
    summary: "When a tool call times out, retry up to 3 times with exponential backoff",
    confidence: 0.85,
    evidenceRefs: ["evidence_1", "evidence_2"],
    sourceSignalIds: ["signal_001", "signal_002"],
    recommendation: "Implement retry logic with exponential backoff",
    validatedBy: "evidence" as const,
    promotionStatus: "validated" as const,
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const parsed = LearningObjectSchema.parse(validObject);

  // Verify structure
  assert.equal(parsed.learningObjectId, "lo_001");
  assert.equal(parsed.learningType, "failure_pattern");
  assert.equal(parsed.title, "Retry on timeout errors");
  assert.equal(parsed.summary, "When a tool call times out, retry up to 3 times with exponential backoff");
  assert.equal(parsed.confidence, 0.85);
  assert.deepEqual(parsed.evidenceRefs, ["evidence_1", "evidence_2"]);
  assert.deepEqual(parsed.sourceSignalIds, ["signal_001", "signal_002"]);
  assert.equal(parsed.recommendation, "Implement retry logic with exponential backoff");
  assert.equal(parsed.validatedBy, "evidence");
  assert.equal(parsed.promotionStatus, "validated");

  // Golden assertion
  assertGolden("learning-object-structure-v1", {
    learningObjectId: parsed.learningObjectId,
    learningType: parsed.learningType,
    confidence: parsed.confidence,
    evidenceRefCount: parsed.evidenceRefs.length,
    sourceSignalCount: parsed.sourceSignalIds.length,
    validatedBy: parsed.validatedBy,
    promotionStatus: parsed.promotionStatus,
  });
});

test("golden: LearningType enum values are valid", () => {
  // Phase 1 only supports 3 learning types per ADR-080 §R4-TYPES constraint
  // model_retraining and dataset_gap are mapped to Phase 1 types via normalizeLearningType
  const validTypes: LearningObject["learningType"][] = [
    "failure_pattern",
    "user_correction",
    "recovery_playbook",
  ];

  for (const learningType of validTypes) {
    const result = LearningObjectSchema.safeParse({
      learningObjectId: "lo_test",
      learningType,
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      recommendation: "Test recommendation",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(result.success, true, `Type ${learningType} should be valid`);
  }

  const invalidType = LearningObjectSchema.safeParse({
    learningObjectId: "lo_test",
    learningType: "invalid_type",
    title: "Test",
    summary: "Test summary",
    confidence: 0.5,
    recommendation: "Test recommendation",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(invalidType.success, false, "Invalid type should fail");

  assertGolden("learning-type-enum-v1", {
    validTypes,
    totalTypes: validTypes.length,
  });
});

test("golden: ValidatedBy enum values are valid", () => {
  const validValues: LearningObject["validatedBy"][] = [
    "none",
    "evidence",
    "human_review",
    "shadow_execution",
  ];

  for (const validatedBy of validValues) {
    const result = LearningObjectSchema.safeParse({
      learningObjectId: "lo_test",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      recommendation: "Test recommendation",
      validatedBy,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(result.success, true, `ValidatedBy ${validatedBy} should be valid`);
  }

  assertGolden("validated-by-enum-v1", {
    validValues,
    totalValues: validValues.length,
  });
});

test("golden: PromotionStatus enum values are valid", () => {
  const validStatuses: LearningObject["promotionStatus"][] = [
    "draft",
    "quarantine",
    "validated",
    "promoted",
    "retired",
  ];

  for (const status of validStatuses) {
    const result = LearningObjectSchema.safeParse({
      learningObjectId: "lo_test",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      recommendation: "Test recommendation",
      promotionStatus: status,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(result.success, true, `Status ${status} should be valid`);
  }

  assertGolden("promotion-status-enum-v1", {
    validStatuses,
    totalStatuses: validStatuses.length,
  });
});

test("golden: LearningObject confidence boundaries work correctly", () => {
  // Valid boundaries
  const minConfidence = LearningObjectSchema.parse({
    learningObjectId: "lo_min",
    learningType: "failure_pattern",
    title: "Min",
    summary: "Min confidence",
    confidence: 0,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(minConfidence.confidence, 0);

  const maxConfidence = LearningObjectSchema.parse({
    learningObjectId: "lo_max",
    learningType: "failure_pattern",
    title: "Max",
    summary: "Max confidence",
    confidence: 1,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(maxConfidence.confidence, 1);

  // Invalid boundaries
  const belowMin = LearningObjectSchema.safeParse({
    learningObjectId: "lo_invalid",
    learningType: "failure_pattern",
    title: "Invalid",
    summary: "Below min",
    confidence: -0.1,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(belowMin.success, false, "Confidence below 0 should fail");

  const aboveMax = LearningObjectSchema.safeParse({
    learningObjectId: "lo_invalid",
    learningType: "failure_pattern",
    title: "Invalid",
    summary: "Above max",
    confidence: 1.1,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(aboveMax.success, false, "Confidence above 1 should fail");

  assertGolden("learning-object-confidence-boundaries-v1", {
    minConfidence: minConfidence.confidence,
    maxConfidence: maxConfidence.confidence,
    belowMinFails: !belowMin.success,
    aboveMaxFails: !aboveMax.success,
  });
});

test("golden: LearningObject defaults are applied", () => {
  const minimalObject = {
    learningObjectId: "lo_minimal",
    learningType: "user_correction" as const,
    title: "Minimal",
    summary: "Minimal object",
    confidence: 0.5,
    recommendation: "Be careful",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const parsed = LearningObjectSchema.parse(minimalObject);

  assert.deepEqual(parsed.evidenceRefs, []);
  assert.deepEqual(parsed.sourceSignalIds, []);
  assert.equal(parsed.validatedBy, "none");
  assert.equal(parsed.promotionStatus, "quarantine");

  assertGolden("learning-object-defaults-v1", {
    learningObjectId: parsed.learningObjectId,
    evidenceRefsDefault: parsed.evidenceRefs.length === 0,
    sourceSignalIdsDefault: parsed.sourceSignalIds.length === 0,
    validatedByDefault: parsed.validatedBy,
    promotionStatusDefault: parsed.promotionStatus,
  });
});

test("golden: parseLearningObject produces valid output", () => {
  const input = {
    learningObjectId: "lo_parse_test",
    learningType: "recovery_playbook",
    title: "Parse Test",
    summary: "Testing parse function",
    confidence: 0.75,
    recommendation: "Use parse function",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const parsed = parseLearningObject(input);

  assert.ok(parsed.learningObjectId);
  assert.equal(parsed.learningType, "recovery_playbook");
  assert.equal(parsed.title, "Parse Test");

  assertGolden("parse-learning-object-v1", {
    learningObjectId: parsed.learningObjectId,
    learningType: parsed.learningType,
    title: parsed.title,
  });
});

test("golden: LearningObject rejects invalid data", () => {
  // Missing required field
  const missingTitle = {
    learningObjectId: "lo_001",
    learningType: "failure_pattern",
    summary: "Test summary",
    confidence: 0.5,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const result1 = LearningObjectSchema.safeParse(missingTitle);
  assert.equal(result1.success, false, "Missing title should fail");

  // Empty string title
  const emptyTitle = {
    learningObjectId: "lo_002",
    learningType: "failure_pattern",
    title: "",
    summary: "Test summary",
    confidence: 0.5,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const result2 = LearningObjectSchema.safeParse(emptyTitle);
  assert.equal(result2.success, false, "Empty title should fail");

  // Empty string summary
  const emptySummary = {
    learningObjectId: "lo_003",
    learningType: "failure_pattern",
    title: "Test",
    summary: "",
    confidence: 0.5,
    recommendation: "Test",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const result3 = LearningObjectSchema.safeParse(emptySummary);
  assert.equal(result3.success, false, "Empty summary should fail");

  assertGolden("learning-object-rejects-invalid-v1", {
    missingTitleFails: !result1.success,
    emptyTitleFails: !result2.success,
    emptySummaryFails: !result3.success,
  });
});

test("golden: ArtifactFormatSchema enum values are valid", () => {
  const validFormats: ArtifactFormat[] = ["json", "yaml", "markdown", "policy_bundle"];

  for (const format of validFormats) {
    const result = ArtifactFormatSchema.safeParse(format);
    assert.equal(result.success, true, `Format ${format} should be valid`);
  }

  const invalidFormat = ArtifactFormatSchema.safeParse("invalid_format");
  assert.equal(invalidFormat.success, false, "Invalid format should fail");

  assertGolden("artifact-format-enum-v1", {
    validFormats,
    totalFormats: validFormats.length,
  });
});

test("golden: LearningArtifactSchema produces correct structure", () => {
  const validArtifact = {
    artifactId: "artifact_lo_001",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Retry on timeout errors",
    format: "json" as const,
    content: '{"learningType":"failure_pattern","title":"Retry on timeout errors"}',
    namespace: "engineering",
    tokenSize: 50,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  };

  const parsed = LearningArtifactSchema.parse(validArtifact);

  // Verify structure
  assert.equal(parsed.artifactId, "artifact_lo_001");
  assert.equal(parsed.sourceObjectId, "lo_001");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.title, "Retry on timeout errors");
  assert.equal(parsed.format, "json");
  assert.ok(parsed.content.length > 0);
  assert.equal(parsed.namespace, "engineering");
  assert.equal(parsed.tokenSize, 50);
  assert.equal(parsed.checksum.length, 64);

  // Golden assertion
  assertGolden("learning-artifact-structure-v1", {
    artifactId: parsed.artifactId,
    sourceObjectId: parsed.sourceObjectId,
    version: parsed.version,
    format: parsed.format,
    namespace: parsed.namespace,
    tokenSize: parsed.tokenSize,
    checksumLength: parsed.checksum.length,
  });
});

test("golden: LearningArtifact checksum validation works correctly", () => {
  // Valid 64-char hex checksum
  const validChecksum = LearningArtifactSchema.safeParse({
    artifactId: "artifact_001",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  });
  assert.equal(validChecksum.success, true, "Valid 64-char hex should pass");

  // Invalid checksum (too short)
  const shortChecksum = LearningArtifactSchema.safeParse({
    artifactId: "artifact_002",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "abc123",
    createdAt: 1713174400000,
  });
  assert.equal(shortChecksum.success, false, "Short checksum should fail");

  // Invalid checksum (non-hex)
  const nonHexChecksum = LearningArtifactSchema.safeParse({
    artifactId: "artifact_003",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "g".repeat(64), // 'g' is not valid hex
    createdAt: 1713174400000,
  });
  assert.equal(nonHexChecksum.success, false, "Non-hex checksum should fail");

  assertGolden("learning-artifact-checksum-validation-v1", {
    validChecksumPasses: validChecksum.success,
    shortChecksumFails: !shortChecksum.success,
    nonHexChecksumFails: !nonHexChecksum.success,
  });
});

test("golden: LearningArtifact version must be positive", () => {
  // Valid version
  const validVersion = LearningArtifactSchema.safeParse({
    artifactId: "artifact_001",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  });
  assert.equal(validVersion.success, true, "Version 1 should be valid");

  // Zero version
  const zeroVersion = LearningArtifactSchema.safeParse({
    artifactId: "artifact_002",
    sourceObjectId: "lo_001",
    version: 0,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  });
  assert.equal(zeroVersion.success, false, "Version 0 should fail");

  // Negative version
  const negativeVersion = LearningArtifactSchema.safeParse({
    artifactId: "artifact_003",
    sourceObjectId: "lo_001",
    version: -1,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  });
  assert.equal(negativeVersion.success, false, "Negative version should fail");

  assertGolden("learning-artifact-version-validation-v1", {
    validVersionPasses: validVersion.success,
    zeroVersionFails: !zeroVersion.success,
    negativeVersionFails: !negativeVersion.success,
  });
});

test("golden: parseLearningArtifact produces valid output", () => {
  const input = {
    artifactId: "artifact_parse_test",
    sourceObjectId: "lo_parse",
    version: 2,
    title: "Parse Test Artifact",
    format: "markdown",
    content: "# Test Content",
    namespace: "test",
    tokenSize: 5,
    checksum: "b".repeat(64),
    createdAt: 1713174400000,
  };

  const parsed = parseLearningArtifact(input);

  assert.ok(parsed.artifactId);
  assert.equal(parsed.sourceObjectId, "lo_parse");
  assert.equal(parsed.version, 2);
  assert.equal(parsed.format, "markdown");

  assertGolden("parse-learning-artifact-v1", {
    artifactId: parsed.artifactId,
    sourceObjectId: parsed.sourceObjectId,
    version: parsed.version,
    format: parsed.format,
  });
});

test("golden: LearningArtifact rejects invalid data", () => {
  // Missing required field
  const missingArtifactId = {
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "json",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  };

  const result1 = LearningArtifactSchema.safeParse(missingArtifactId);
  assert.equal(result1.success, false, "Missing artifactId should fail");

  // Invalid format
  const invalidFormat = {
    artifactId: "artifact_001",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "invalid_format",
    content: '{"test":true}',
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  };

  const result2 = LearningArtifactSchema.safeParse(invalidFormat);
  assert.equal(result2.success, false, "Invalid format should fail");

  // Empty content - this is actually valid per the schema (z.string() allows empty)
  const emptyContentObj = {
    artifactId: "artifact_002",
    sourceObjectId: "lo_001",
    version: 1,
    title: "Test",
    format: "json",
    content: "",
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  };

  const result3 = LearningArtifactSchema.safeParse(emptyContentObj);
  assert.equal(result3.success, true, "Empty content should be valid per schema");

  // Missing sourceObjectId should fail
  const missingSourceObjectId = {
    artifactId: "artifact_003",
    version: 1,
    title: "Test",
    format: "json",
    content: "{}",
    namespace: "test",
    tokenSize: 10,
    checksum: "a".repeat(64),
    createdAt: 1713174400000,
  };

  const result4 = LearningArtifactSchema.safeParse(missingSourceObjectId);
  assert.equal(result4.success, false, "Missing sourceObjectId should fail");

  assertGolden("learning-artifact-rejects-invalid-v1", {
    missingArtifactIdFails: !result1.success,
    invalidFormatFails: !result2.success,
    emptyContentIsValid: result3.success,
    missingSourceObjectIdFails: !result4.success,
  });
});
