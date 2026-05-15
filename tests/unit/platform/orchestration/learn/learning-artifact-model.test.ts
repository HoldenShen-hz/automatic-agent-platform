import assert from "node:assert/strict";
import test from "node:test";

import {
  LearningArtifactSchema,
  LearningArtifact,
  createLearningArtifact,
  parseLearningArtifact,
} from "../../../../../src/platform/five-plane-orchestration/learn/learning-artifact-model.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObject> & { learningObjectId: string }): LearningObject {
  return {
    learningObjectId: overrides.learningObjectId,
    learningType: overrides.learningType ?? "failure_pattern",
    title: overrides.title ?? "Test learning object",
    summary: overrides.summary ?? "Test summary",
    confidence: overrides.confidence ?? 0.8,
    evidenceRefs: overrides.evidenceRefs ?? ["ref-1"],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    recommendation: overrides.recommendation ?? "Test recommendation",
    validatedBy: overrides.validatedBy ?? "evidence",
    promotionStatus: overrides.promotionStatus ?? "validated",
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

// =============================================================================
// Schema Validation Tests
// =============================================================================

test("LearningArtifactSchema accepts valid artifact", () => {
  const artifact: LearningArtifact = {
    artifactId: "artifact-123",
    sourceObjectId: "learning-456",
    version: 1,
    title: "Test artifact",
    format: "json",
    content: '{"key": "value"}',
    namespace: "system.learned.patterns",
    tokenSize: 100,
    checksum: "a".repeat(64),
    createdAt: 1700000000000,
  };

  const result = LearningArtifactSchema.parse(artifact);
  assert.equal(result.artifactId, "artifact-123");
  assert.equal(result.version, 1);
});

test("LearningArtifactSchema rejects empty artifactId", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "",
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema rejects empty sourceObjectId", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "",
      version: 1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema rejects non-positive version", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: 0,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema rejects negative version", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: -1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema rejects empty title", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: 1,
      title: "",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema accepts all valid format values", () => {
  const formats = ["json", "yaml", "markdown", "policy_bundle"] as const;
  for (const format of formats) {
    const artifact: LearningArtifact = {
      artifactId: `artifact-${format}`,
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format,
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    };
    const result = LearningArtifactSchema.parse(artifact);
    assert.equal(result.format, format);
  }
});

test("LearningArtifactSchema rejects invalid format", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format: "xml",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema allows empty content", () => {
  const result = LearningArtifactSchema.parse({
    artifactId: "artifact-123",
    sourceObjectId: "learning-456",
    version: 1,
    title: "Test",
    format: "json",
    content: "",
    namespace: "test",
    tokenSize: 100,
    checksum: "a".repeat(64),
    createdAt: 1700000000000,
  });

  assert.equal(result.content, "");
});

test("LearningArtifactSchema rejects negative tokenSize", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: -1,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema accepts zero tokenSize", () => {
  const artifact: LearningArtifact = {
    artifactId: "artifact-123",
    sourceObjectId: "learning-456",
    version: 1,
    title: "Test",
    format: "json",
    content: "{}",
    namespace: "test",
    tokenSize: 0,
    checksum: "a".repeat(64),
    createdAt: 1700000000000,
  };

  const result = LearningArtifactSchema.parse(artifact);
  assert.equal(result.tokenSize, 0);
});

test("LearningArtifactSchema rejects invalid checksum format", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "invalid",
      createdAt: 1700000000000,
    });
  });
});

test("LearningArtifactSchema accepts valid 64-char hex checksum", () => {
  const artifact: LearningArtifact = {
    artifactId: "artifact-123",
    sourceObjectId: "learning-456",
    version: 1,
    title: "Test",
    format: "json",
    content: "{}",
    namespace: "test",
    tokenSize: 100,
    checksum: "deadbeef".repeat(8),
    createdAt: 1700000000000,
  };

  const result = LearningArtifactSchema.parse(artifact);
  assert.equal(result.checksum, "deadbeef".repeat(8));
});

test("LearningArtifactSchema rejects negative createdAt", () => {
  assert.throws(() => {
    LearningArtifactSchema.parse({
      artifactId: "artifact-123",
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: -1,
    });
  });
});

// =============================================================================
// createLearningArtifact Tests
// =============================================================================

test("createLearningArtifact creates valid artifact from learning object", async () => {
  const learningObject = makeLearningObject({
    learningObjectId: "learning-create-1",
  });

  const artifact = await createLearningArtifact(learningObject, "test.namespace");

  assert.equal(artifact.sourceObjectId, "learning-create-1");
  assert.equal(artifact.title, learningObject.title);
  assert.equal(artifact.format, "json");
  assert.equal(artifact.namespace, "test.namespace");
  assert.equal(artifact.version, 1);
  assert.ok(artifact.artifactId.startsWith("artifact_learning-create-1"));
  assert.ok(artifact.checksum.length === 64);
});

test("createLearningArtifact computes SHA-256 checksum", async () => {
  const learningObject = makeLearningObject({
    learningObjectId: "learning-checksum-1",
  });

  const artifact = await createLearningArtifact(learningObject, "test.namespace");

  // Checksum should be a valid 64-character hex string
  assert.ok(/^[a-f0-9]{64}$/.test(artifact.checksum));
});

test("createLearningArtifact calculates tokenSize correctly", async () => {
  const learningObject = makeLearningObject({
    learningObjectId: "learning-token-1",
  });

  const artifact = await createLearningArtifact(learningObject, "test.namespace");

  // tokenSize is ceil(content.length / 4)
  assert.equal(artifact.tokenSize, Math.ceil(artifact.content.length / 4));
});

test("createLearningArtifact uses specified format", async () => {
  const learningObject = makeLearningObject({
    learningObjectId: "learning-format-1",
  });

  const artifact = await createLearningArtifact(learningObject, "test.namespace", "yaml");

  assert.equal(artifact.format, "yaml");
});

test("createLearningArtifact uses markdown format", async () => {
  const learningObject = makeLearningObject({
    learningObjectId: "learning-md-1",
  });

  const artifact = await createLearningArtifact(learningObject, "test.namespace", "markdown");

  assert.equal(artifact.format, "markdown");
});

test("createLearningArtifact creates different checksums for different content", async () => {
  const obj1 = makeLearningObject({ learningObjectId: "learning-diff-1", title: "Title 1" });
  const obj2 = makeLearningObject({ learningObjectId: "learning-diff-2", title: "Title 2" });

  const artifact1 = await createLearningArtifact(obj1, "test.namespace");
  const artifact2 = await createLearningArtifact(obj2, "test.namespace");

  assert.notEqual(artifact1.checksum, artifact2.checksum);
});

// =============================================================================
// parseLearningArtifact Tests
// =============================================================================

test("parseLearningArtifact parses valid artifact", () => {
  const artifact = {
    artifactId: "artifact-parse-1",
    sourceObjectId: "learning-parse-1",
    version: 1,
    title: "Parsed",
    format: "json",
    content: "{}",
    namespace: "test",
    tokenSize: 10,
    checksum: "b".repeat(64),
    createdAt: 1700000000000,
  };

  const result = parseLearningArtifact(artifact);
  assert.equal(result.artifactId, "artifact-parse-1");
});

test("parseLearningArtifact rejects invalid artifact", () => {
  assert.throws(() => {
    parseLearningArtifact({
      artifactId: "",
      sourceObjectId: "learning-456",
      version: 1,
      title: "Test",
      format: "json",
      content: "{}",
      namespace: "test",
      tokenSize: 100,
      checksum: "a".repeat(64),
      createdAt: 1700000000000,
    });
  });
});
