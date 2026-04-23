import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactBundleService } from "../../../../../../src/platform/state-evidence/artifacts/artifact-bundle-service.js";

test("ArtifactBundleService can be instantiated", () => {
  const service = new ArtifactBundleService();
  assert.ok(service != null);
});

test("build creates bundle with generated bundleId", () => {
  const service = new ArtifactBundleService();
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts: [],
  });
  assert.ok(bundle.bundleId.startsWith("artifact_bundle_"), `Expected bundleId to start with artifact_bundle_, got: ${bundle.bundleId}`);
});

test("build sets correct taskId and domainId", () => {
  const service = new ArtifactBundleService();
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "asset_bundle",
    artifacts: [],
  });
  assert.equal(bundle.taskId, "task_123");
  assert.equal(bundle.domainId, "domain_a");
});

test("build sets publishStatus to draft", () => {
  const service = new ArtifactBundleService();
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts: [],
  });
  assert.equal(bundle.publishStatus, "draft");
});

test("build sets publishedAt to null", () => {
  const service = new ArtifactBundleService();
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts: [],
  });
  assert.equal(bundle.publishedAt, null);
});

test("build copies artifacts array", () => {
  const service = new ArtifactBundleService();
  const artifacts = [
    {
      artifactId: "artifact_1",
      taskId: "task_123",
      stepId: "step_1",
      agentRole: "builder",
      type: "source_code" as const,
      path: "/path1",
      contentHash: "hash1",
      version: 1,
      parentArtifactId: null,
      size: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "draft" as const,
    },
  ];
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts,
  });
  assert.equal(bundle.artifacts.length, 1);
  assert.deepEqual(bundle.artifacts, artifacts);
});

test("build copies links array when provided", () => {
  const service = new ArtifactBundleService();
  const links = [
    {
      linkId: "link_1",
      fromArtifactId: "artifact_1",
      toArtifactId: "artifact_2",
      relation: "derived_from" as const,
    },
  ];
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts: [],
    links,
  });
  assert.equal(bundle.links.length, 1);
  assert.deepEqual(bundle.links, links);
});

test("build defaults links to empty array", () => {
  const service = new ArtifactBundleService();
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts: [],
  });
  assert.deepEqual(bundle.links, []);
});

test("build calculates totalSize from artifacts", () => {
  const service = new ArtifactBundleService();
  const artifacts = [
    {
      artifactId: "artifact_1",
      taskId: "task_123",
      stepId: "step_1",
      agentRole: "builder",
      type: "source_code" as const,
      path: "/path1",
      contentHash: "hash1",
      version: 1,
      parentArtifactId: null,
      size: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "draft" as const,
    },
    {
      artifactId: "artifact_2",
      taskId: "task_123",
      stepId: "step_1",
      agentRole: "builder",
      type: "document" as const,
      path: "/path2",
      contentHash: "hash2",
      version: 1,
      parentArtifactId: null,
      size: 200,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "draft" as const,
    },
  ];
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts,
  });
  assert.equal(bundle.totalSize, 300);
});

test("build defaults finalDeliverables to artifactIds", () => {
  const service = new ArtifactBundleService();
  const artifacts = [
    {
      artifactId: "artifact_1",
      taskId: "task_123",
      stepId: "step_1",
      agentRole: "builder",
      type: "source_code" as const,
      path: "/path1",
      contentHash: "hash1",
      version: 1,
      parentArtifactId: null,
      size: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "draft" as const,
    },
    {
      artifactId: "artifact_2",
      taskId: "task_123",
      stepId: "step_1",
      agentRole: "builder",
      type: "document" as const,
      path: "/path2",
      contentHash: "hash2",
      version: 1,
      parentArtifactId: null,
      size: 200,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "draft" as const,
    },
  ];
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts,
  });
  assert.deepEqual(bundle.finalDeliverables, ["artifact_1", "artifact_2"]);
});

test("build uses provided finalDeliverables over defaults", () => {
  const service = new ArtifactBundleService();
  const artifacts = [
    {
      artifactId: "artifact_1",
      taskId: "task_123",
      stepId: "step_1",
      agentRole: "builder",
      type: "source_code" as const,
      path: "/path1",
      contentHash: "hash1",
      version: 1,
      parentArtifactId: null,
      size: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "draft" as const,
    },
  ];
  const bundle = service.build({
    taskId: "task_123",
    domainId: "domain_a",
    bundleType: "release_bundle",
    artifacts,
    finalDeliverables: ["custom_deliverable"],
  });
  assert.deepEqual(bundle.finalDeliverables, ["custom_deliverable"]);
});

test("build accepts all bundle types", () => {
  const service = new ArtifactBundleService();
  const bundleTypes = [
    "release_bundle",
    "asset_bundle",
    "campaign_bundle",
    "incident_bundle",
    "workflow_snapshot",
  ];
  for (const bundleType of bundleTypes) {
    const bundle = service.build({
      taskId: "task_123",
      domainId: "domain_a",
      bundleType,
      artifacts: [],
    });
    assert.equal(bundle.bundleType, bundleType);
  }
});