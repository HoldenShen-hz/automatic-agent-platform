import assert from "node:assert/strict";
import test from "node:test";

import {
  ArtifactTypeSchema,
  ArtifactRecordSchema,
  ArtifactLinkSchema,
  ArtifactBundleSchema,
} from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

test("ArtifactTypeSchema accepts valid artifact types", () => {
  const validTypes = [
    "source_code",
    "config",
    "document",
    "report",
    "test_result",
    "log",
    "binary",
    "patch",
    "code_bundle",
    "asset_package",
    "image_prompt",
    "render_job_spec",
    "live_runbook",
    "postmortem",
    "diagnostic_bundle",
  ];
  for (const type of validTypes) {
    const result = ArtifactTypeSchema.safeParse(type);
    assert.ok(result.success, `Expected ${type} to be valid`);
  }
});

test("ArtifactTypeSchema rejects invalid artifact types", () => {
  const result = ArtifactTypeSchema.safeParse("invalid_type");
  assert.ok(!result.success);
});

test("ArtifactRecordSchema validates correct artifact record", () => {
  const record = {
    artifactId: "artifact_123",
    taskId: "task_456",
    stepId: "step_789",
    agentRole: "builder",
    type: "source_code",
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "draft",
  };
  const result = ArtifactRecordSchema.safeParse(record);
  assert.ok(result.success, `Expected valid record: ${JSON.stringify(result.error)}`);
});

test("ArtifactRecordSchema rejects missing required fields", () => {
  const record = {
    artifactId: "artifact_123",
  };
  const result = ArtifactRecordSchema.safeParse(record);
  assert.ok(!result.success);
});

test("ArtifactRecordSchema rejects invalid status", () => {
  const record = {
    artifactId: "artifact_123",
    taskId: "task_456",
    stepId: "step_789",
    agentRole: "builder",
    type: "source_code",
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "invalid_status",
  };
  const result = ArtifactRecordSchema.safeParse(record);
  assert.ok(!result.success);
});

test("ArtifactRecordSchema rejects negative size", () => {
  const record = {
    artifactId: "artifact_123",
    taskId: "task_456",
    stepId: "step_789",
    agentRole: "builder",
    type: "source_code",
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: -100,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "draft",
  };
  const result = ArtifactRecordSchema.safeParse(record);
  assert.ok(!result.success);
});

test("ArtifactLinkSchema validates correct artifact link", () => {
  const link = {
    linkId: "link_123",
    fromArtifactId: "artifact_1",
    toArtifactId: "artifact_2",
    relation: "derived_from",
  };
  const result = ArtifactLinkSchema.safeParse(link);
  assert.ok(result.success, `Expected valid link: ${JSON.stringify(result.error)}`);
});

test("ArtifactLinkSchema rejects invalid relation", () => {
  const link = {
    linkId: "link_123",
    fromArtifactId: "artifact_1",
    toArtifactId: "artifact_2",
    relation: "invalid_relation",
  };
  const result = ArtifactLinkSchema.safeParse(link);
  assert.ok(!result.success);
});

test("ArtifactBundleSchema validates correct bundle", () => {
  const bundle = {
    bundleId: "bundle_123",
    taskId: "task_456",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const result = ArtifactBundleSchema.safeParse(bundle);
  assert.ok(result.success, `Expected valid bundle: ${JSON.stringify(result.error)}`);
});

test("ArtifactBundleSchema accepts artifacts and links arrays", () => {
  const bundle = {
    bundleId: "bundle_123",
    taskId: "task_456",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_456",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "/path",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "draft",
      },
    ],
    links: [
      {
        linkId: "link_1",
        fromArtifactId: "artifact_1",
        toArtifactId: "artifact_2",
        relation: "derived_from",
      },
    ],
    finalDeliverables: ["artifact_1"],
    totalSize: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const result = ArtifactBundleSchema.safeParse(bundle);
  assert.ok(result.success, `Expected valid bundle: ${JSON.stringify(result.error)}`);
});

test("ArtifactBundleSchema rejects empty bundleId", () => {
  const bundle = {
    bundleId: "",
    taskId: "task_456",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const result = ArtifactBundleSchema.safeParse(bundle);
  assert.ok(!result.success);
});