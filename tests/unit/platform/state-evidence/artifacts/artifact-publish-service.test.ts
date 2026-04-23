import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactPublishService } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";
import { ArtifactPublishLedger } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import type { ArtifactBundleExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

function createMockBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  const now = new Date().toISOString();
  return {
    bundleId: "bundle_001",
    taskId: "task_001",
    artifacts: [
      { artifactId: "a1", taskId: "t1", stepId: "s1", agentRole: "agent", type: "source_code", path: "/file.js", contentHash: "hash1", version: 1, parentArtifactId: null, size: 100, createdAt: now, status: "committed" } as any,
      { artifactId: "a2", taskId: "t1", stepId: "s1", agentRole: "agent", type: "config", path: "/config.json", contentHash: "hash2", version: 1, parentArtifactId: null, size: 50, createdAt: now, status: "committed" } as any,
    ],
    links: [],
    finalDeliverables: ["a1", "a2"],
    totalSize: 150,
    createdAt: now,
    bundleType: "release_bundle",
    domainId: "domain_001",
    publishStatus: "draft",
    publishedAt: null,
    ...overrides,
  };
}

test("ArtifactPublishService publishes bundle with default target", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const published = service.publish(bundle);

  assert.equal(published.publishStatus, "published");
  assert.ok(published.publishedAt !== null);
});

test("ArtifactPublishService sets publishedAt timestamp on publish", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const before = new Date().toISOString();
  const published = service.publish(bundle);
  const after = new Date().toISOString();

  assert.ok(published.publishedAt !== null);
  assert.ok(published.publishedAt >= before);
  assert.ok(published.publishedAt <= after);
});

test("ArtifactPublishService throws error when publishing already published bundle", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle({ publishStatus: "published" });

  assert.throws(
    () => service.publish(bundle),
    (err: any) => err.code === "artifact.publish_already_published",
  );
});

test("ArtifactPublishService throws error when publishing recalled bundle", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle({ publishStatus: "recalled" });

  assert.throws(
    () => service.publish(bundle),
    (err: any) => err.code === "artifact.publish_recalled_bundle",
  );
});

test("ArtifactPublishService publishWithMetadata returns full result", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishWithMetadata(bundle);

  assert.equal(result.bundle.publishStatus, "published");
  assert.equal(result.target, "git");
  assert.ok(result.destination.startsWith("bundle://"));
  assert.equal(result.publishedArtifactIds.length, 2);
  assert.deepEqual(result.publishedArtifactIds, ["a1", "a2"]);
});

test("ArtifactPublishService publishToGit records ledger entry", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, { repository: "github.com/repo" });

  assert.equal(result.target, "git");
  assert.equal(result.destination, "github.com/repo#main");
  assert.equal(result.metadata.commitMessage, `Publish artifact bundle ${bundle.bundleId}`);
  assert.deepEqual(result.metadata.files, ["/file.js", "/config.json"]);
});

test("ArtifactPublishService publishToGit uses custom branch", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, { repository: "github.com/repo", branch: "develop" });

  assert.equal(result.destination, "github.com/repo#develop");
});

test("ArtifactPublishService publishToGit uses custom commit message", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, {
    repository: "github.com/repo",
    commitMessage: "Custom commit message",
  });

  assert.equal(result.metadata.commitMessage, "Custom commit message");
});

test("ArtifactPublishService publishToNotion creates notion destination", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToNotion(bundle, { parentPageId: "page_123" });

  assert.equal(result.target, "notion");
  assert.equal(result.destination, "notion://page_123/bundle_001");
  assert.equal(result.metadata.pageTitle, `Artifact Bundle ${bundle.bundleId}`);
});

test("ArtifactPublishService publishToNotion uses custom page title", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToNotion(bundle, {
    parentPageId: "page_123",
    pageTitle: "My Custom Title",
  });

  assert.equal(result.metadata.pageTitle, "My Custom Title");
});

test("ArtifactPublishService publishToCdn creates cdn destination", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });

  assert.equal(result.target, "cdn");
  assert.ok(result.destination.startsWith("https://cdn.example.com/"));
  assert.ok(result.destination.endsWith("/bundle_001"));
});

test("ArtifactPublishService publishToCdn normalizes baseUrl trailing slash", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com///" });

  assert.ok(!result.destination.includes("///"));
});

test("ArtifactPublishService publishToCdn normalizes pathPrefix", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, {
    baseUrl: "https://cdn.example.com",
    pathPrefix: "//artifacts///",
  });

  assert.ok(result.destination.includes("/artifacts/"));
});

test("ArtifactPublishService publishToCdn uses default pathPrefix", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });

  assert.ok(result.destination.includes("/artifacts/"));
});

test("ArtifactPublishService listPublishHistory returns recorded entries", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  service.publishToGit(createMockBundle({ bundleId: "bundle_1" }), { repository: "r1" });
  service.publishToGit(createMockBundle({ bundleId: "bundle_2" }), { repository: "r2" });

  const history = service.listPublishHistory();

  assert.equal(history.length, 2);
  assert.equal(history[0]!.bundleId, "bundle_1");
  assert.equal(history[1]!.bundleId, "bundle_2");
});

test("ArtifactPublishService records destination in ledger for git", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  service.publishToGit(bundle, { repository: "github.com/repo" });

  const history = service.listPublishHistory();
  assert.equal(history[0]!.destination, "github.com/repo#main");
});

test("ArtifactPublishService records target in ledger for git", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  service.publishToGit(bundle, { repository: "github.com/repo" });

  const history = service.listPublishHistory();
  assert.equal(history[0]!.target, "git");
});

test("ArtifactPublishService creates published bundle with updated status", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle({ publishStatus: "draft" });

  const published = service.publish(bundle);

  assert.equal(published.publishStatus, "published");
  assert.notEqual(published.publishedAt, null);
});

test("ArtifactPublishService returns ArtifactBundleExtended from publish", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const published = service.publish(bundle);

  assert.equal(published.bundleId, bundle.bundleId);
  assert.equal(published.taskId, bundle.taskId);
  assert.equal(published.domainId, bundle.domainId);
});
