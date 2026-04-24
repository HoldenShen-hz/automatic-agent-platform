import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactPublishService } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import type { ArtifactBundleExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";
import { ArtifactPublishLedger } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import type { ArtifactPublishLedgerEntry } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";

function createMockBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  const now = new Date().toISOString();
  return {
    bundleId: "bundle_001",
    taskId: "task_001",
    artifacts: [
      { artifactId: "a1", taskId: "t1", stepId: "s1", agentRole: "agent", type: "source_code" as const, path: "/file.js", contentHash: "hash1", version: 1, parentArtifactId: null, size: 100, createdAt: now, status: "committed" as const },
      { artifactId: "a2", taskId: "t1", stepId: "s1", agentRole: "agent", type: "config" as const, path: "/config.json", contentHash: "hash2", version: 1, parentArtifactId: null, size: 50, createdAt: now, status: "committed" as const },
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

function createMockLedger(): { ledger: ArtifactPublishLedger; entries: ArtifactPublishLedgerEntry[] } {
  const entries: ArtifactPublishLedgerEntry[] = [];
  const ledger = {
    record(bundle: ArtifactBundleExtended, metadata: { target?: string | null; destination?: string | null }) {
      const entry: ArtifactPublishLedgerEntry = {
        publishId: "publish_001",
        bundleId: bundle.bundleId,
        taskId: bundle.taskId,
        domainId: bundle.domainId,
        bundleType: bundle.bundleType,
        artifactCount: bundle.artifacts.length,
        totalSize: bundle.totalSize,
        publishedAt: bundle.publishedAt ?? new Date().toISOString(),
        publishStatus: bundle.publishStatus,
        target: metadata.target ?? null,
        destination: metadata.destination ?? null,
      };
      entries.push(entry);
      return entry;
    },
    list() {
      return [...entries];
    },
  } as ArtifactPublishLedger;
  return { ledger, entries };
}

test("publish sets bundle publishStatus to published", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const published = service.publish(bundle);

  assert.equal(published.publishStatus, "published");
});

test("publish sets publishedAt timestamp", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const published = service.publish(bundle);

  assert.ok(published.publishedAt !== null);
  assert.ok(published.publishedAt.length > 0);
});

test("publish returns ArtifactBundleExtended with same bundleId", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const published = service.publish(bundle);

  assert.equal(published.bundleId, bundle.bundleId);
  assert.equal(published.taskId, bundle.taskId);
  assert.equal(published.domainId, bundle.domainId);
});

test("publish throws ValidationError for already published bundle", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle({ publishStatus: "published" });

  assert.throws(
    () => service.publish(bundle),
    (err: unknown) => err instanceof ValidationError && err.code === "artifact.publish_already_published",
  );
});

test("publish throws ValidationError for recalled bundle", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle({ publishStatus: "recalled" });

  assert.throws(
    () => service.publish(bundle),
    (err: unknown) => err instanceof ValidationError && err.code === "artifact.publish_recalled_bundle",
  );
});

test("publishWithMetadata returns bundle, target, destination, and publishedArtifactIds", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishWithMetadata(bundle);

  assert.equal(result.bundle.publishStatus, "published");
  assert.equal(result.target, "git");
  assert.ok(result.destination.startsWith("bundle://"));
  assert.deepEqual(result.publishedArtifactIds, ["a1", "a2"]);
  assert.deepEqual(result.metadata, {});
});

test("publishWithMetadata records to ledger with git target", () => {
  const { ledger, entries } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  service.publishWithMetadata(bundle);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.target, "git");
  assert.equal(entries[0]!.destination, `bundle://${bundle.domainId}/${bundle.bundleId}`);
});

test("publishToGit returns git target and repository destination", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, { repository: "github.com/repo" });

  assert.equal(result.target, "git");
  assert.equal(result.destination, "github.com/repo#main");
});

test("publishToGit uses custom branch in destination", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, { repository: "github.com/repo", branch: "develop" });

  assert.equal(result.destination, "github.com/repo#develop");
});

test("publishToGit includes commitMessage and files in metadata", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, {
    repository: "github.com/repo",
    commitMessage: "Custom commit",
  });

  assert.equal(result.metadata.commitMessage, "Custom commit");
  assert.deepEqual(result.metadata.files, ["/file.js", "/config.json"]);
});

test("publishToGit uses default commit message when not provided", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToGit(bundle, { repository: "github.com/repo" });

  assert.equal(result.metadata.commitMessage, `Publish artifact bundle ${bundle.bundleId}`);
});

test("publishToNotion returns notion target and destination", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToNotion(bundle, { parentPageId: "page_123" });

  assert.equal(result.target, "notion");
  assert.equal(result.destination, "notion://page_123/bundle_001");
});

test("publishToNotion uses custom page title in metadata", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToNotion(bundle, {
    parentPageId: "page_123",
    pageTitle: "My Custom Title",
  });

  assert.equal(result.metadata.pageTitle, "My Custom Title");
});

test("publishToNotion uses default page title when not provided", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToNotion(bundle, { parentPageId: "page_123" });

  assert.equal(result.metadata.pageTitle, `Artifact Bundle ${bundle.bundleId}`);
});

test("publishToNotion includes sections in metadata from finalDeliverables", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToNotion(bundle, { parentPageId: "page_123" });

  assert.deepEqual(result.metadata.sections, bundle.finalDeliverables);
});

test("publishToCdn returns cdn target and normalized destination", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });

  assert.equal(result.target, "cdn");
  assert.ok(result.destination.startsWith("https://cdn.example.com/"));
  assert.ok(result.destination.endsWith("/bundle_001"));
});

test("publishToCdn normalizes trailing slashes on baseUrl", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com///" });

  assert.ok(!result.destination.includes("///"));
  assert.ok(result.destination.startsWith("https://cdn.example.com/"));
});

test("publishToCdn normalizes pathPrefix with leading and trailing slashes", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, {
    baseUrl: "https://cdn.example.com",
    pathPrefix: "//artifacts///",
  });

  assert.ok(result.destination.includes("/artifacts/"));
  assert.ok(!result.destination.includes("//artifacts"));
});

test("publishToCdn uses default pathPrefix when not provided", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });

  assert.ok(result.destination.includes("/artifacts/"));
});

test("publishToCdn includes urls array in metadata", () => {
  const { ledger } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });

  assert.ok(Array.isArray(result.metadata.urls));
  assert.equal((result.metadata.urls as string[]).length, 2);
  assert.ok((result.metadata.urls as string[])[0]!.includes("/file.js"));
});

test("listPublishHistory returns all recorded ledger entries", () => {
  const { ledger, entries } = createMockLedger();
  const service = new ArtifactPublishService(ledger);

  service.publishToGit(createMockBundle({ bundleId: "bundle_1" }), { repository: "r1" });
  service.publishToGit(createMockBundle({ bundleId: "bundle_2" }), { repository: "r2" });
  service.publishToNotion(createMockBundle({ bundleId: "bundle_3" }), { parentPageId: "p1" });

  const history = service.listPublishHistory();

  assert.equal(history.length, 3);
  assert.equal(entries.length, 3);
});

test("each publish method records to the ledger", () => {
  const { ledger, entries } = createMockLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMockBundle();

  service.publishWithMetadata(bundle);
  service.publishToGit(bundle, { repository: "r1" });
  service.publishToNotion(bundle, { parentPageId: "p1" });
  service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });

  assert.equal(entries.length, 4);
  assert.equal(entries[0]!.target, "git");
  assert.equal(entries[1]!.target, "git");
  assert.equal(entries[2]!.target, "notion");
  assert.equal(entries[3]!.target, "cdn");
});
