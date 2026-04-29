/**
 * Golden Test: Artifact Model Schema Output
 *
 * Verifies artifact-model.ts produces correct output shape for
 * artifact records, bundles, and links across the platform.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ArtifactRecordSchema,
  ArtifactRecordExtendedSchema,
  ArtifactLinkSchema,
  ArtifactLinkExtendedSchema,
  ArtifactBundleSchema,
  ArtifactBundleExtendedSchema,
  ArtifactTypeSchema,
  type ArtifactRecord,
  type ArtifactBundle,
  type ArtifactLink,
  type ArtifactType,
} from "../../src/platform/five-plane-state-evidence/artifacts/artifact-model.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: ArtifactRecord schema produces correct structure", () => {
  const validRecord = {
    artifactId: "art_001",
    harnessRunId: "hrun_001",
    nodeRunId: "noderun_001",
    planGraphBundleId: "bundle_001",
    taskId: "task_001",
    executionId: "exec_001",
    type: "source_code",
    path: "/artifacts/src/index.ts",
    mimeType: "text/typescript",
    sizeBytes: 1234,
    checksum: "abc123def456",
    refs: [
      {
        refId: "ref_001",
        targetType: "execution" as const,
        targetId: "exec_001",
      },
    ],
    publishStatus: "published",
    createdAt: "2026-04-15T10:00:00.000Z",
    metadata: { language: "typescript", lineCount: 100 },
  };

  const parsed = ArtifactRecordSchema.parse(validRecord);

  // Verify structure
  assert.equal(parsed.artifactId, "art_001");
  assert.equal(parsed.harnessRunId, "hrun_001");
  assert.equal(parsed.nodeRunId, "noderun_001");
  assert.equal(parsed.planGraphBundleId, "bundle_001");
  assert.equal(parsed.taskId, "task_001");
  assert.equal(parsed.executionId, "exec_001");
  assert.equal(parsed.type, "source_code");
  assert.equal(parsed.path, "/artifacts/src/index.ts");
  assert.equal(parsed.mimeType, "text/typescript");
  assert.equal(parsed.sizeBytes, 1234);
  assert.equal(parsed.checksum, "abc123def456");
  assert.ok(parsed.refs);
  assert.equal(parsed.refs!.length, 1);
  assert.equal(parsed.publishStatus, "published");
  assert.ok(parsed.createdAt);
  assert.ok(parsed.metadata);

  // Golden assertion
  assertGolden("artifact-record-structure-v1", {
    artifactId: parsed.artifactId,
    harnessRunId: parsed.harnessRunId,
    type: parsed.type,
    path: parsed.path,
    sizeBytes: parsed.sizeBytes,
    publishStatus: parsed.publishStatus,
    hasRefs: parsed.refs !== undefined && parsed.refs.length > 0,
    refCount: parsed.refs?.length ?? 0,
  });
});

test("golden: ArtifactType enum values are valid", () => {
  const validTypes: ArtifactType[] = [
    "source_code",
    "config",
    "document",
    "report",
    "evidence_bundle",
    "timeline_export",
    "diagnostic_bundle",
    "workflow_checkpoint",
    "feedback_snapshot",
    "learning_object_bundle",
    "improvement_candidate_bundle",
    "rollout_evidence",
    "policy_explain_export",
    "plan_dag_export",
    "execution_output",
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
  ];

  for (const artifactType of validTypes) {
    const result = ArtifactTypeSchema.safeParse(artifactType);
    assert.equal(result.success, true, `Type ${artifactType} should be valid`);
  }

  const invalidType = ArtifactTypeSchema.safeParse("invalid_type");
  assert.equal(invalidType.success, false, "Invalid type should fail");

  assertGolden("artifact-type-enum-v1", {
    totalTypes: validTypes.length,
    typeList: validTypes,
  });
});

test("golden: ArtifactRecord with minimal fields works", () => {
  const minimalRecord = {
    artifactId: "art_minimal",
    harnessRunId: "hrun_min",
    type: "log",
    path: "/artifacts/log.txt",
    mimeType: "text/plain",
    sizeBytes: 0,
    publishStatus: "draft",
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const parsed = ArtifactRecordSchema.parse(minimalRecord);

  assert.equal(parsed.artifactId, "art_minimal");
  assert.equal(parsed.nodeRunId, undefined, "Should not have nodeRunId");
  assert.equal(parsed.planGraphBundleId, undefined);
  assert.equal(parsed.taskId, undefined);
  assert.equal(parsed.executionId, undefined);
  assert.equal(parsed.checksum, undefined);
  assert.equal(parsed.refs, undefined);
  assert.deepEqual(parsed.metadata, {}, "Should have empty metadata");

  assertGolden("artifact-record-minimal-v1", {
    artifactId: parsed.artifactId,
    type: parsed.type,
    hasNodeRunId: parsed.nodeRunId !== undefined,
    hasChecksum: parsed.checksum !== undefined,
    hasRefs: parsed.refs !== undefined,
    metadataEmpty: Object.keys(parsed.metadata ?? {}).length === 0,
  });
});

test("golden: ArtifactRecordExtended schema extends base correctly", () => {
  const extendedRecord = {
    artifactId: "art_extended",
    harnessRunId: "hrun_ext",
    type: "report",
    path: "/artifacts/report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 5000,
    publishStatus: "published",
    createdAt: "2026-04-15T10:00:00.000Z",
    namespace: "production",
    artifactType: "report",
    storageUri: "s3://artifacts/production/report.pdf",
    createdBy: "system",
    metadata: { department: "engineering" },
  };

  const parsed = ArtifactRecordExtendedSchema.parse(extendedRecord);

  // Verify extended fields
  assert.equal(parsed.namespace, "production");
  assert.equal(parsed.artifactType, "report");
  assert.equal(parsed.storageUri, "s3://artifacts/production/report.pdf");
  assert.equal(parsed.createdBy, "system");
  assert.deepEqual(parsed.metadata, { department: "engineering" });

  // Verify base fields still present
  assert.equal(parsed.artifactId, "art_extended");
  assert.equal(parsed.harnessRunId, "hrun_ext");
  assert.equal(parsed.type, "report");

  assertGolden("artifact-record-extended-v1", {
    artifactId: parsed.artifactId,
    namespace: parsed.namespace,
    artifactType: parsed.artifactType,
    storageUri: parsed.storageUri,
    createdBy: parsed.createdBy,
  });
});

test("golden: ArtifactLink schema produces correct structure", () => {
  const validLink = {
    linkId: "link_001",
    fromArtifactId: "art_source",
    toArtifactId: "art_target",
    relation: "derived_from",
  };

  const parsed = ArtifactLinkSchema.parse(validLink);

  assert.equal(parsed.linkId, "link_001");
  assert.equal(parsed.fromArtifactId, "art_source");
  assert.equal(parsed.toArtifactId, "art_target");
  assert.equal(parsed.relation, "derived_from");

  assertGolden("artifact-link-structure-v1", {
    linkId: parsed.linkId,
    fromArtifactId: parsed.fromArtifactId,
    toArtifactId: parsed.toArtifactId,
    relation: parsed.relation,
  });
});

test("golden: ArtifactLinkExtended schema has additional relations", () => {
  const extendedRelations = [
    "derived_from",
    "replaces",
    "depends_on",
    "tested_by",
    "reviewed_by",
    "uses",
    "published_from",
    "summarizes",
    "attached_to",
  ];

  for (const relation of extendedRelations) {
    const link = {
      linkId: `link_${relation}`,
      fromArtifactId: "art_a",
      toRefId: "art_b",
      relation,
    };
    const parsed = ArtifactLinkExtendedSchema.parse(link);
    assert.equal(parsed.relation, relation);
  }

  assertGolden("artifact-link-extended-relations-v1", {
    totalRelations: extendedRelations.length,
    relations: extendedRelations,
  });
});

test("golden: ArtifactBundle schema produces correct structure", () => {
  const validBundle = {
    bundleId: "bundle_001",
    taskId: "task_001",
    artifacts: [
      {
        artifactId: "art_001",
        harnessRunId: "hrun_001",
        type: "source_code",
        path: "/src/main.ts",
        mimeType: "text/typescript",
        sizeBytes: 1000,
        publishStatus: "published",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
      {
        artifactId: "art_002",
        harnessRunId: "hrun_001",
        type: "test_result",
        path: "/tests/results.json",
        mimeType: "application/json",
        sizeBytes: 500,
        publishStatus: "published",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ],
    links: [
      {
        linkId: "link_001",
        fromArtifactId: "art_001",
        toArtifactId: "art_002",
        relation: "tested_by",
      },
    ],
    finalDeliverables: ["art_001"],
    totalSize: 1500,
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const parsed = ArtifactBundleSchema.parse(validBundle);

  assert.equal(parsed.bundleId, "bundle_001");
  assert.equal(parsed.taskId, "task_001");
  assert.equal(parsed.artifacts.length, 2);
  assert.equal(parsed.links.length, 1);
  assert.deepEqual(parsed.finalDeliverables, ["art_001"]);
  assert.equal(parsed.totalSize, 1500);
  assert.ok(parsed.createdAt);

  assertGolden("artifact-bundle-structure-v1", {
    bundleId: parsed.bundleId,
    taskId: parsed.taskId,
    artifactCount: parsed.artifacts.length,
    linkCount: parsed.links.length,
    finalDeliverableCount: parsed.finalDeliverables.length,
    totalSize: parsed.totalSize,
  });
});

test("golden: ArtifactBundle with empty arrays works", () => {
  const emptyBundle = {
    bundleId: "bundle_empty",
    taskId: "task_empty",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const parsed = ArtifactBundleSchema.parse(emptyBundle);

  assert.equal(parsed.bundleId, "bundle_empty");
  assert.deepEqual(parsed.artifacts, []);
  assert.deepEqual(parsed.links, []);
  assert.deepEqual(parsed.finalDeliverables, []);
  assert.equal(parsed.totalSize, 0);

  assertGolden("artifact-bundle-empty-v1", {
    bundleId: parsed.bundleId,
    artifactCount: parsed.artifacts.length,
    linkCount: parsed.links.length,
    totalSize: parsed.totalSize,
  });
});

test("golden: ArtifactBundleExtended schema extends base correctly", () => {
  const extendedBundle = {
    bundleId: "bundle_ext",
    taskId: "task_ext",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-04-15T10:00:00.000Z",
    bundleType: "task_result",
    domainId: "engineering",
    publishStatus: "preview",
    publishedAt: "2026-04-15T12:00:00.000Z",
  };

  const parsed = ArtifactBundleExtendedSchema.parse(extendedBundle);

  // Verify extended fields
  assert.equal(parsed.bundleType, "task_result");
  assert.equal(parsed.domainId, "engineering");
  assert.equal(parsed.publishStatus, "preview");
  assert.equal(parsed.publishedAt, "2026-04-15T12:00:00.000Z");

  // Verify base fields still present
  assert.equal(parsed.bundleId, "bundle_ext");
  assert.equal(parsed.taskId, "task_ext");

  assertGolden("artifact-bundle-extended-v1", {
    bundleId: parsed.bundleId,
    bundleType: parsed.bundleType,
    domainId: parsed.domainId,
    publishStatus: parsed.publishStatus,
    hasPublishedAt: parsed.publishedAt !== null,
  });
});

test("golden: ArtifactRecord rejects invalid data", () => {
  // Missing required field
  const missingArtifactId = {
    harnessRunId: "hrun_001",
    type: "source_code",
    path: "/src/main.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    publishStatus: "draft",
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const result1 = ArtifactRecordSchema.safeParse(missingArtifactId);
  assert.equal(result1.success, false, "Missing artifactId should fail");

  // Invalid artifact type
  const invalidType = {
    artifactId: "art_001",
    harnessRunId: "hrun_001",
    type: "invalid_type",
    path: "/src/main.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    publishStatus: "draft",
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const result2 = ArtifactRecordSchema.safeParse(invalidType);
  assert.equal(result2.success, false, "Invalid type should fail");

  // Invalid publishStatus
  const invalidStatus = {
    artifactId: "art_002",
    harnessRunId: "hrun_001",
    type: "source_code",
    path: "/src/main.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    publishStatus: "invalid_status",
    createdAt: "2026-04-15T10:00:00.000Z",
  };

  const result3 = ArtifactRecordSchema.safeParse(invalidStatus);
  assert.equal(result3.success, false, "Invalid publishStatus should fail");

  assertGolden("artifact-record-rejects-invalid-v1", {
    missingArtifactIdFails: !result1.success,
    invalidTypeFails: !result2.success,
    invalidStatusFails: !result3.success,
  });
});

test("golden: ArtifactRecord refs structure validates correctly", () => {
  const recordWithRefs = {
    artifactId: "art_refs",
    harnessRunId: "hrun_refs",
    type: "evidence_bundle",
    path: "/evidence/bundle.zip",
    mimeType: "application/zip",
    sizeBytes: 10000,
    publishStatus: "published",
    createdAt: "2026-04-15T10:00:00.000Z",
    refs: [
      {
        refId: "ref_001",
        targetType: "execution" as const,
        targetId: "exec_001",
      },
      {
        refId: "ref_002",
        targetType: "learning" as const,
        targetId: "learn_001",
      },
    ],
  };

  const parsed = ArtifactRecordSchema.parse(recordWithRefs);

  assert.ok(parsed.refs);
  assert.equal(parsed.refs!.length, 2);
  assert.equal(parsed.refs![0].refId, "ref_001");
  assert.equal(parsed.refs![0].targetType, "execution");
  assert.equal(parsed.refs![0].targetId, "exec_001");
  assert.equal(parsed.refs![1].targetType, "learning");

  assertGolden("artifact-record-refs-v1", {
    artifactId: parsed.artifactId,
    refCount: parsed.refs!.length,
    targetTypes: parsed.refs!.map((r) => r.targetType),
  });
});

test("golden: ArtifactRecord metadata preserves custom fields", () => {
  const recordWithMetadata = {
    artifactId: "art_meta",
    harnessRunId: "hrun_meta",
    type: "document",
    path: "/docs/readme.md",
    mimeType: "text/markdown",
    sizeBytes: 500,
    publishStatus: "published",
    createdAt: "2026-04-15T10:00:00.000Z",
    metadata: {
      author: "system",
      version: "1.0.0",
      tags: ["documentation", "readme"],
      nested: { field: "value" },
    },
  };

  const parsed = ArtifactRecordSchema.parse(recordWithMetadata);

  assert.equal(parsed.metadata.author, "system");
  assert.equal(parsed.metadata.version, "1.0.0");
  assert.deepEqual(parsed.metadata.tags, ["documentation", "readme"]);
  assert.equal(parsed.metadata.nested.field, "value");

  assertGolden("artifact-record-metadata-v1", {
    artifactId: parsed.artifactId,
    author: parsed.metadata.author,
    version: parsed.metadata.version,
    tagCount: (parsed.metadata.tags as string[]).length,
    hasNested: parsed.metadata.nested !== undefined,
  });
});