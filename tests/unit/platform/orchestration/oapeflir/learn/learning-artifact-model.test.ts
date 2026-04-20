import assert from "node:assert/strict";
import test from "node:test";

import {
  LearningArtifactSchema,
  ArtifactFormatSchema,
  createLearningArtifact,
  parseLearningArtifact,
  type LearningArtifact,
} from "../../../../../../src/platform/orchestration/oapeflir/learn/learning-artifact-model.js";
import { LearningObjectSchema } from "../../../../../../src/platform/orchestration/oapeflir/learn/learning-object-model.js";

test("ArtifactFormatSchema accepts valid formats", () => {
  assert.equal(ArtifactFormatSchema.parse("json"), "json");
  assert.equal(ArtifactFormatSchema.parse("yaml"), "yaml");
  assert.equal(ArtifactFormatSchema.parse("markdown"), "markdown");
  assert.equal(ArtifactFormatSchema.parse("policy_bundle"), "policy_bundle");
});

test("ArtifactFormatSchema rejects invalid format", () => {
  assert.throws(() => ArtifactFormatSchema.parse("invalid"));
});

test("LearningArtifactSchema validates correct artifact", () => {
  const validArtifact = {
    artifactId: "artifact_test_123",
    sourceObjectId: "lo_test_123",
    version: 1,
    title: "Test Artifact",
    format: "json",
    content: '{"key": "value"}',
    namespace: "test-namespace",
    tokenSize: 100,
    checksum: "a".repeat(64),
    createdAt: Date.now(),
  };

  const result = LearningArtifactSchema.parse(validArtifact);
  assert.equal(result.artifactId, "artifact_test_123");
  assert.equal(result.format, "json");
});

test("LearningArtifactSchema rejects invalid checksum length", () => {
  const invalidArtifact = {
    artifactId: "artifact_test_123",
    sourceObjectId: "lo_test_123",
    version: 1,
    title: "Test Artifact",
    format: "json",
    content: '{"key": "value"}',
    namespace: "test-namespace",
    tokenSize: 100,
    checksum: "abc",
    createdAt: Date.now(),
  };

  assert.throws(() => LearningArtifactSchema.parse(invalidArtifact));
});

test("LearningArtifactSchema rejects negative version", () => {
  const invalidArtifact = {
    artifactId: "artifact_test_123",
    sourceObjectId: "lo_test_123",
    version: -1,
    title: "Test Artifact",
    format: "json",
    content: '{"key": "value"}',
    namespace: "test-namespace",
    tokenSize: 100,
    checksum: "a".repeat(64),
    createdAt: Date.now(),
  };

  assert.throws(() => LearningArtifactSchema.parse(invalidArtifact));
});

test("createLearningArtifact creates valid artifact from learning object", async () => {
  const learningObject = LearningObjectSchema.parse({
    learningObjectId: "lo_create_test",
    learningType: "failure_pattern",
    title: "Test Strategy",
    summary: "A test strategy for unit testing",
    recommendation: "Use this pattern in similar cases",
    evidenceRefs: ["evidence_1", "evidence_2"],
    confidence: 0.85,
    createdAt: Date.now(),
  });

  const artifact = await createLearningArtifact(learningObject, "test-namespace");

  assert.ok(artifact.artifactId.startsWith("artifact_"));
  assert.equal(artifact.sourceObjectId, "lo_create_test");
  assert.equal(artifact.version, 1);
  assert.equal(artifact.title, "Test Strategy");
  assert.equal(artifact.format, "json");
  assert.ok(artifact.content.length > 0);
  assert.equal(artifact.namespace, "test-namespace");
  assert.ok(artifact.tokenSize > 0);
  assert.equal(artifact.checksum.length, 64);
  assert.ok(artifact.createdAt > 0);
});

test("createLearningArtifact uses specified format", async () => {
  const learningObject = LearningObjectSchema.parse({
    learningObjectId: "lo_format_test",
    learningType: "user_correction",
    title: "Format Test",
    summary: "Testing format option",
    recommendation: "Recommendation here",
    evidenceRefs: [],
    confidence: 0.9,
    createdAt: Date.now(),
  });

  const artifact = await createLearningArtifact(learningObject, "test-namespace", "markdown");

  assert.equal(artifact.format, "markdown");
});

test("createLearningArtifact includes correct content structure", async () => {
  const learningObject = LearningObjectSchema.parse({
    learningObjectId: "lo_content_test",
    learningType: "recovery_playbook",
    title: "Content Test",
    summary: "Summary for content",
    recommendation: "Recommendation here",
    evidenceRefs: ["ref1"],
    confidence: 0.7,
    createdAt: Date.now(),
  });

  const artifact = await createLearningArtifact(learningObject, "content-test");

  const parsedContent = JSON.parse(artifact.content);
  assert.equal(parsedContent.learningType, "recovery_playbook");
  assert.equal(parsedContent.title, "Content Test");
  assert.equal(parsedContent.summary, "Summary for content");
  assert.equal(parsedContent.recommendation, "Recommendation here");
  assert.deepEqual(parsedContent.evidenceRefs, ["ref1"]);
});

test("createLearningArtifact computes valid checksum", async () => {
  const learningObject = LearningObjectSchema.parse({
    learningObjectId: "lo_checksum_test",
    learningType: "failure_pattern",
    title: "Checksum Test",
    summary: "Testing checksum",
    recommendation: "Check this",
    evidenceRefs: [],
    confidence: 0.8,
    createdAt: Date.now(),
  });

  const artifact = await createLearningArtifact(learningObject, "checksum-test");

  // Checksum should be 64 hex characters
  assert.match(artifact.checksum, /^[a-f0-9]{64}$/);
});

test("parseLearningArtifact parses valid input", () => {
  const validArtifact = {
    artifactId: "artifact_parse_123",
    sourceObjectId: "lo_parse_123",
    version: 2,
    title: "Parsed Artifact",
    format: "yaml",
    content: "key: value",
    namespace: "parse-namespace",
    tokenSize: 50,
    checksum: "b".repeat(64),
    createdAt: 1234567890,
  };

  const result = parseLearningArtifact(validArtifact);

  assert.equal(result.artifactId, "artifact_parse_123");
  assert.equal(result.version, 2);
  assert.equal(result.format, "yaml");
});

test("parseLearningArtifact throws on invalid input", () => {
  const invalidArtifact = {
    artifactId: "",
    sourceObjectId: "lo_123",
    version: 1,
    title: "Test",
    format: "xml",
    content: "data",
    namespace: "ns",
    tokenSize: 10,
    checksum: "c".repeat(64),
    createdAt: Date.now(),
  };

  assert.throws(() => parseLearningArtifact(invalidArtifact));
});

test("createLearningArtifact tokenSize approximates content length divided by 4", async () => {
  const learningObject = LearningObjectSchema.parse({
    learningObjectId: "lo_token_test",
    learningType: "user_correction",
    title: "Token Size Test",
    summary: "Token calculation test",
    recommendation: "Test recommendation",
    evidenceRefs: [],
    confidence: 0.85,
    createdAt: Date.now(),
  });

  const artifact = await createLearningArtifact(learningObject, "token-test");

  // Token size should be approximately content.length / 4 (rounded up)
  const expectedTokenSize = Math.ceil(artifact.content.length / 4);
  assert.equal(artifact.tokenSize, expectedTokenSize);
});
