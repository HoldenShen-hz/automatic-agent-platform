import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../../src/platform/contracts/errors.js";
import { ArtifactPublishService } from "../../../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";

function makeBundle(overrides = {}) {
  return {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code" as const,
        path: "/path",
        contentHash: "abc",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "draft" as const,
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
    ...overrides,
  };
}

test("ArtifactPublishService can be instantiated", () => {
  const service = new ArtifactPublishService();
  assert.ok(service != null);
});

test("publish returns bundle with published status", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const published = service.publish(bundle);
  assert.equal(published.publishStatus, "published");
  assert.ok(published.publishedAt);
});

test("publish sets publishedAt timestamp", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const published = service.publish(bundle);
  assert.ok(published.publishedAt.length > 0);
});

test("publish throws when bundle already published", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "published" });
  assert.throws(
    () => service.publish(bundle),
    (err) => err.code === "artifact.publish_already_published",
  );
});

test("publish throws when bundle is recalled", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "recalled" });
  assert.throws(
    () => service.publish(bundle),
    (err) => err.code === "artifact.publish_recalled_bundle",
  );
});

test("publishWithMetadata returns result with target and destination", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishWithMetadata(bundle);
  assert.ok(result.bundle);
  assert.equal(result.target, "git");
  assert.ok(result.destination.startsWith("bundle://"));
  assert.ok(result.publishedArtifactIds.length > 0);
});

test("publishWithMetadata returns empty metadata", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishWithMetadata(bundle);
  assert.deepEqual(result.metadata, {});
});

test("publishToGit returns git target and destination", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToGit(bundle, { repository: "github.com/user/repo", branch: "main", commitMessage: "Test commit" });
  assert.equal(result.target, "git");
  assert.ok(result.destination.includes("github.com/user/repo"));
  assert.ok(result.destination.includes("main"));
});

test("publishToGit uses default branch when not provided", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToGit(bundle, { repository: "github.com/user/repo" });
  assert.ok(result.destination.includes("#main"));
});

test("publishToGit uses default commit message when not provided", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToGit(bundle, { repository: "github.com/user/repo" });
  assert.ok(result.metadata.commitMessage.includes("bundle_1"));
});

test("publishToNotion returns notion target and destination", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToNotion(bundle, { parentPageId: "page_123", pageTitle: "My Bundle" });
  assert.equal(result.target, "notion");
  assert.ok(result.destination.includes("notion://"));
  assert.ok(result.destination.includes("page_123"));
  assert.equal(result.metadata.pageTitle, "My Bundle");
});

test("publishToNotion uses default page title when not provided", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToNotion(bundle, { parentPageId: "page_123" });
  assert.ok(result.metadata.pageTitle.includes("bundle_1"));
});

test("publishToCdn returns cdn target and destination", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com", pathPrefix: "artifacts" });
  assert.equal(result.target, "cdn");
  assert.ok(result.destination.includes("https://cdn.example.com"));
  assert.ok(result.destination.includes("artifacts"));
  assert.ok(result.destination.includes("bundle_1"));
});

test("publishToCdn normalizes trailing slashes in baseUrl", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com///" });
  assert.ok(!result.destination.includes("//"));
});

test("publishToCdn normalizes pathPrefix", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com", pathPrefix: "//artifacts///" });
  assert.ok(result.destination.endsWith("/artifacts/"));
});

test("publishToCdn uses default pathPrefix when not provided", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });
  assert.ok(result.destination.includes("/artifacts/"));
});

test("listPublishHistory returns ledger entries", () => {
  const service = new ArtifactPublishService();
  const bundle = makeBundle({ publishStatus: "draft" });
  service.publishWithMetadata(bundle);
  const history = service.listPublishHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].bundleId, "bundle_1");
});