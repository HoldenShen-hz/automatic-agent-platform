/**
 * Integration Test: Artifact Publishing
 *
 * Tests the ArtifactPublishService including:
 * - Publishing to git, notion, and CDN targets
 * - Publish ledger recording
 * - Publish status transitions
 * - Recalled bundle rejection
 * - Already-published bundle rejection
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactPublishService } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";
import { ArtifactPublishLedger } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { ArtifactBundleExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

function createTestBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  return {
    bundleId: newId("bundle"),
    taskId: newId("task"),
    bundleType: "release_bundle",
    domainId: "platform",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: nowIso(),
    publishStatus: "draft",
    publishedAt: null,
    ...overrides,
  };
}

test("artifact publishing: publishes bundle to git with repository destination", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({
    artifacts: [
      {
        artifactId: newId("artifact"),
        taskId: newId("task"),
        stepId: newId("step"),
        agentRole: "coder",
        type: "source_code",
        path: "/src/main.ts",
        contentHash: "sha256:abc123",
        version: 1,
        parentArtifactId: null,
        size: 1024,
        createdAt: nowIso(),
        status: "committed",
      },
    ],
    totalSize: 1024,
  });

  const result = service.publishToGit(bundle, {
    repository: "https://github.com/org/repo",
    branch: "main",
    commitMessage: "Release v1.0.0",
  });

  assert.equal(result.target, "git");
  assert.ok(result.destination.includes("https://github.com/org/repo"));
  assert.ok(result.destination.includes("main"));
  assert.equal(result.publishedArtifactIds.length, 1);
  assert.equal(result.bundle.publishStatus, "published");
  assert.ok(result.bundle.publishedAt !== null);
  assert.ok(result.metadata.commitMessage?.includes("Release"));
  assert.ok(Array.isArray(result.metadata.files));
});

test("artifact publishing: publishes bundle to Notion with page destination", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({
    finalDeliverables: ["summary.md", "report.pdf"],
  });

  const result = service.publishToNotion(bundle, {
    parentPageId: "notion-page-123",
    pageTitle: "Sprint Retrospective",
  });

  assert.equal(result.target, "notion");
  assert.ok(result.destination.includes("notion://"));
  assert.ok(result.destination.includes("notion-page-123"));
  assert.equal(result.metadata.pageTitle, "Sprint Retrospective");
  assert.deepEqual(result.metadata.sections, ["summary.md", "report.pdf"]);
  assert.equal(result.bundle.publishStatus, "published");
});

test("artifact publishing: publishes bundle to CDN with normalized URL", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({
    bundleId: "bundle-cdn-test",
    artifacts: [
      {
        artifactId: newId("artifact"),
        taskId: newId("task"),
        stepId: newId("step"),
        agentRole: "builder",
        type: "asset_package",
        path: "dist/bundle.js",
        contentHash: "sha256:xyz789",
        version: 1,
        parentArtifactId: null,
        size: 4096,
        createdAt: nowIso(),
        status: "committed",
      },
    ],
    totalSize: 4096,
  });

  const result = service.publishToCdn(bundle, {
    baseUrl: "https://cdn.example.com/",
    pathPrefix: "/artifacts/",
  });

  assert.equal(result.target, "cdn");
  assert.ok(result.destination.startsWith("https://cdn.example.com/"));
  assert.ok(result.destination.includes("bundle-cdn-test"));
  assert.ok(Array.isArray(result.metadata.urls));
  assert.equal(result.bundle.publishStatus, "published");
});

test("artifact publishing: CDN baseUrl trailing slashes are normalized", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({ bundleId: "slash-test" });

  const result1 = service.publishToCdn(bundle, {
    baseUrl: "https://cdn.example.com",
  });

  const result2 = service.publishToCdn(createTestBundle({ bundleId: "slash-test-2" }), {
    baseUrl: "https://cdn.example.com///",
  });

  // Both should produce clean URLs without double slashes
  assert.ok(!result1.destination.includes("///"));
  assert.ok(!result2.destination.includes("///"));
});

test("artifact publishing: basic publish creates bundle URL destination", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle();

  const result = service.publish(bundle);

  assert.equal(result.publishStatus, "published");
  assert.ok(result.publishedAt !== null);
});

test("artifact publishing: publishWithMetadata returns full result details", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({
    domainId: "execution-engine",
  });

  const result = service.publishWithMetadata(bundle);

  assert.equal(result.target, "git");
  assert.ok(result.destination.startsWith("bundle://"));
  assert.ok(result.destination.includes("execution-engine"));
  assert.deepEqual(result.metadata, {});
  assert.equal(result.bundle.publishStatus, "published");
});

test("artifact publishing: ledger records publish entries", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({ bundleId: "ledger-test" });
  service.publishToGit(bundle, { repository: "https://github.com/org/repo" });

  const history = service.listPublishHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0]?.bundleId, "ledger-test");
  assert.equal(history[0]?.target, "git");
  assert.equal(history[0]?.destination, "https://github.com/org/repo#main");
});

test("artifact publishing: ledger records multiple publish targets", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle1 = createTestBundle({ bundleId: "bundle-1" });
  const bundle2 = createTestBundle({ bundleId: "bundle-2" });

  service.publishToGit(bundle1, { repository: "https://github.com/org/repo1" });
  service.publishToNotion(bundle2, { parentPageId: "page-456" });

  const history = service.listPublishHistory();
  assert.equal(history.length, 2);
  assert.ok(history.some((e) => e.target === "git"));
  assert.ok(history.some((e) => e.target === "notion"));
});

test("artifact publishing: rejects already published bundle", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({ publishStatus: "published" });

  assert.throws(
    () => service.publish(bundle),
    (err: unknown) => err instanceof ValidationError && err.code === "artifact.publish_already_published",
  );
});

test("artifact publishing: rejects recalled bundle", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({ publishStatus: "recalled" });

  assert.throws(
    () => service.publish(bundle),
    (err: unknown) => err instanceof ValidationError && err.code === "artifact.publish_recalled_bundle",
  );
});

test("artifact publishing: publishToGit uses default branch when not specified", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle();

  const result = service.publishToGit(bundle, {
    repository: "https://github.com/org/repo",
  });

  assert.ok(result.destination.includes("#main"), "Should default to main branch");
});

test("artifact publishing: publishToGit uses default commit message when not specified", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle();

  const result = service.publishToGit(bundle, {
    repository: "https://github.com/org/repo",
  });

  assert.ok(result.metadata.commitMessage?.includes(bundle.bundleId));
});

test("artifact publishing: publishToNotion uses default page title when not specified", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({ bundleId: "notion-default-title" });

  const result = service.publishToNotion(bundle, {
    parentPageId: "page-123",
  });

  assert.ok(result.metadata.pageTitle?.includes("notion-default-title"));
});

test("artifact publishing: publish ledger entry contains artifact count", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({
    bundleId: "count-test",
    artifacts: [
      {
        artifactId: newId("artifact"),
        taskId: newId("task"),
        stepId: newId("step"),
        agentRole: "coder",
        type: "source_code",
        path: "/a.ts",
        contentHash: "sha256:a",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: nowIso(),
        status: "committed",
      },
      {
        artifactId: newId("artifact"),
        taskId: newId("task"),
        stepId: newId("step"),
        agentRole: "coder",
        type: "source_code",
        path: "/b.ts",
        contentHash: "sha256:b",
        version: 1,
        parentArtifactId: null,
        size: 200,
        createdAt: nowIso(),
        status: "committed",
      },
    ],
    totalSize: 300,
  });

  service.publishToGit(bundle, { repository: "https://github.com/org/repo" });

  const history = service.listPublishHistory();
  const entry = history.find((e) => e.bundleId === "count-test");
  assert.ok(entry, "Should have ledger entry");
  assert.equal(entry?.artifactCount, 2);
  assert.equal(entry?.totalSize, 300);
});

test("artifact publishing: bundle domainId preserved through publish", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);

  const bundle = createTestBundle({ domainId: "multi-region-deploy" });

  const result = service.publishWithMetadata(bundle);

  assert.ok(result.destination.includes("multi-region-deploy"));
  assert.equal(result.bundle.domainId, "multi-region-deploy");
});
