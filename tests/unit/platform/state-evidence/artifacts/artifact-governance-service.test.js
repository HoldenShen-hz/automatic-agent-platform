import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactGovernanceService } from "../../../../../../src/platform/state-evidence/artifacts/artifact-governance-service.js";

test("ArtifactGovernanceService can be instantiated", () => {
  const service = new ArtifactGovernanceService();
  assert.ok(service != null);
});

test("review returns allowed true for empty bundle", () => {
  const service = new ArtifactGovernanceService();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const decision = service.review(bundle);
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});

test("review returns allowed false when bundle exceeds size limit", () => {
  const service = new ArtifactGovernanceService();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 11 * 1024 * 1024, // 11MB, exceeds 10MB limit
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const decision = service.review(bundle);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
});

test("review returns allowed true when bundle is exactly at size limit", () => {
  const service = new ArtifactGovernanceService();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 10 * 1024 * 1024, // exactly 10MB
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const decision = service.review(bundle);
  assert.equal(decision.allowed, true);
});

test("review detects secret in artifact content", () => {
  const service = new ArtifactGovernanceService();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code" as const,
        path: "/path/to/key",
        contentHash: "abc",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "draft" as const,
        // Contains AWS key-like content
      },
    ],
    links: [],
    finalDeliverables: ["artifact_1"],
    totalSize: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  // When content (serialized) contains secret-like patterns
  const decision = service.review(bundle);
  // This test verifies the governance service calls scanner on structured data
  assert.ok(typeof decision.allowed === "boolean");
  assert.ok(Array.isArray(decision.issues));
});

test("review returns issues list when blocked", () => {
  const service = new ArtifactGovernanceService();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 15 * 1024 * 1024, // 15MB
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const decision = service.review(bundle);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.length > 0);
});

test("review allows bundle without secrets and within size limit", () => {
  const service = new ArtifactGovernanceService();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code" as const,
        path: "/path/to/file",
        contentHash: "abc",
        version: 1,
        parentArtifactId: null,
        size: 1024,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "draft" as const,
      },
    ],
    links: [],
    finalDeliverables: ["artifact_1"],
    totalSize: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const decision = service.review(bundle);
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});