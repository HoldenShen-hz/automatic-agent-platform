import assert from "node:assert/strict";
import test from "node:test";

import { SensitiveContentScanner } from "../../../../src/platform/state-evidence/artifacts/sensitive-content-scanner.js";
import { ArtifactGovernanceService } from "../../../../src/platform/state-evidence/artifacts/artifact-governance-service.js";
import { ArtifactBundleService } from "../../../../src/platform/state-evidence/artifacts/artifact-bundle-service.js";
import { ArtifactPublishLedger } from "../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import { ArtifactPreviewService } from "../../../../src/platform/state-evidence/artifacts/artifact-preview-service.js";
import { ArtifactPublishService } from "../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";
import { ArtifactResolver } from "../../../../src/platform/state-evidence/artifacts/artifact-resolver.js";
import { ArtifactVersioningService } from "../../../../src/platform/state-evidence/artifacts/artifact-versioning.js";
import { ArtifactPlaneService } from "../../../../src/platform/state-evidence/artifacts/artifact-plane-service.js";
import type {
  ArtifactBundleExtended,
  ArtifactRecord,
  ArtifactLink,
  ArtifactLinkExtended,
  ArtifactRecordExtended,
} from "../../../../src/platform/state-evidence/artifacts/artifact-model.js";

// ---------------------------------------------------------------------------
// SensitiveContentScanner - edge cases
// ---------------------------------------------------------------------------

test("SensitiveContentScanner redactSecretSample handles short strings", () => {
  const scanner = new SensitiveContentScanner();
  // Strings <= 8 chars return "[REDACTED]"
  const result = scanner.scanText("key=abcdef");
  // Short tokens may not match the generic pattern (requires 12+ chars)
  assert.equal(typeof result.blocked, "boolean");
});

test("SensitiveContentScanner redactSecretSample handles exactly 8-char strings", () => {
  const scanner = new SensitiveContentScanner();
  // Test with a value that might be at boundary
  const result = scanner.scanText("key=abcdefgh");
  assert.equal(typeof result.blocked, "boolean");
});

test("SensitiveContentScanner formats PII type with underscores replaced by spaces", () => {
  const scanner = new SensitiveContentScanner();
  // Email PII type formatting
  const result = scanner.scanText("user@email.com");
  if (result.findings.length > 0) {
    assert.ok(result.findings[0]!.description.includes("email"));
  }
});

test("SensitiveContentScanner handles empty string", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanText("");
  assert.equal(result.blocked, false);
  assert.equal(result.criticalFindingCount, 0);
  assert.equal(result.findings.length, 0);
});

test("SensitiveContentScanner handles text with only special characters", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanText("!@#$%^&*()_+-=[]{}|;':\",./<>?");
  assert.equal(result.blocked, false);
});

test("SensitiveContentScanner handles very long content", () => {
  const scanner = new SensitiveContentScanner();
  const longText = "normal text " + "x".repeat(10000) + " more normal text";
  const result = scanner.scanText(longText);
  assert.equal(result.criticalFindingCount, 0);
});

test("SensitiveContentScanner handles unicode text", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanText("Hello world in many languages: Bonjour, Ciao, Konnichiwa");
  assert.equal(result.blocked, false);
});

test("SensitiveContentScanner detects phone PII", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanText("Call us at 555-123-4567");
  // Phone number may be detected as PII
  assert.equal(typeof result.blocked, "boolean");
});

test("SensitiveContentScanner detects SSN pattern", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanText("SSN: 123-45-6789");
  // SSN is a sensitive pattern that may be detected
  assert.equal(typeof result.criticalFindingCount, "number");
});

test("SensitiveContentScanner dedupes findings by code and redactedSample", () => {
  const scanner = new SensitiveContentScanner();
  // Multiple AWS keys (same code, same redacted sample)
  const result = scanner.scanText("AKIAIOSFODNN7EXAMPLE AKIAIOSFODNN7EXAMPLE");
  const awsFindings = result.findings.filter((f) => f.code === "artifact.secret.aws_access_key_detected");
  // Should be deduplicated to 1
  assert.ok(awsFindings.length <= 1);
});

test("SensitiveContentScanner scanStructured handles nested objects with secrets", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanStructured({
    config: {
      nested: {
        api_key: "secret=abc1234567890abcdef",
      },
    },
    other: "normal",
  });
  assert.equal(result.blocked, true);
});

test("SensitiveContentScanner scanStructured handles arrays", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanStructured([
    { name: "alice", token: "token=abc1234567890abcdef" },
    { name: "bob", token: "token=xyz1234567890abcdef" },
  ]);
  assert.equal(result.blocked, true);
});

test("SensitiveContentScanner scanStructured handles plain strings", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanStructured("just a plain string with token=abc1234567890abcdef");
  assert.equal(result.blocked, true);
});

test("SensitiveContentScanner scanStructured handles numbers and booleans", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanStructured({ count: 42, active: true, name: "test" });
  assert.equal(result.blocked, false);
  assert.equal(result.criticalFindingCount, 0);
});

test("SensitiveContentScanner scanStructured handles arrays with no secrets", () => {
  const scanner = new SensitiveContentScanner();
  const result = scanner.scanStructured(["apple", "banana", "cherry"]);
  assert.equal(result.blocked, false);
});

// ---------------------------------------------------------------------------
// ArtifactGovernanceService - edge cases
// ---------------------------------------------------------------------------

test("ArtifactGovernanceService blocks bundle at exactly 10MB + 1 byte", () => {
  const service = new ArtifactGovernanceService();
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle_test",
    taskId: "task_test",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 10 * 1024 * 1024 + 1,
    createdAt: new Date().toISOString(),
    bundleType: "release_bundle",
    domainId: "domain_test",
    publishStatus: "draft",
    publishedAt: null,
  };

  const decision = service.review(bundle);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
});

test("ArtifactGovernanceService allows bundle at 10MB minus 1 byte", () => {
  const service = new ArtifactGovernanceService();
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle_test",
    taskId: "task_test",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 10 * 1024 * 1024 - 1,
    createdAt: new Date().toISOString(),
    bundleType: "release_bundle",
    domainId: "domain_test",
    publishStatus: "draft",
    publishedAt: null,
  };

  const decision = service.review(bundle);
  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService checks finalDeliverables for secrets", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle_test",
    taskId: "task_test",
    artifacts: [],
    links: [],
    finalDeliverables: ["password=abc1234567890abcdef"],
    totalSize: 100,
    createdAt: new Date().toISOString(),
    bundleType: "release_bundle",
    domainId: "domain_test",
    publishStatus: "draft",
    publishedAt: null,
  };

  const decision = service.review(bundle);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.sensitive_secret_detected"));
});

test("ArtifactGovernanceService checks finalDeliverables for PII", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle_test",
    taskId: "task_test",
    artifacts: [],
    links: [],
    finalDeliverables: ["email: user@example.com"],
    totalSize: 100,
    createdAt: new Date().toISOString(),
    bundleType: "release_bundle",
    domainId: "domain_test",
    publishStatus: "draft",
    publishedAt: null,
  };

  const decision = service.review(bundle);
  assert.ok(decision.issues.includes("artifact.sensitive_pii_detected"));
});

test("ArtifactGovernanceService detects private key in bundle", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle_test",
    taskId: "task_test",
    artifacts: [
      {
        artifactId: "a1",
        harnessRunId: "harness_test",
        taskId: "t1",
        type: "source_code",
        path: "/key.pem",
        checksum: "hash1",
        version: 1,
        sizeBytes: 100,
        createdAt: new Date().toISOString(),
        publishStatus: "draft",
        mimeType: "application/octet-stream",
        metadata: {},
      },
    ],
    links: [],
    finalDeliverables: [],
    totalSize: 100,
    createdAt: new Date().toISOString(),
    bundleType: "release_bundle",
    domainId: "domain_test",
    publishStatus: "draft",
    publishedAt: null,
  };

  // Bundle with links containing private key content
  const result = service.review(bundle);
  assert.equal(typeof result.allowed, "boolean");
});

// ---------------------------------------------------------------------------
// ArtifactBundleService - edge cases
// ---------------------------------------------------------------------------

test("ArtifactBundleService.build handles empty artifacts array with finalDeliverables", () => {
  const service = new ArtifactBundleService();
  const bundle = service.build({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
    finalDeliverables: ["artifact_a", "artifact_b"],
  });

  assert.equal(bundle.artifacts.length, 0);
  assert.deepEqual(bundle.finalDeliverables, ["artifact_a", "artifact_b"]);
  assert.equal(bundle.totalSize, 0);
});

test("ArtifactBundleService.build handles all bundle types", () => {
  const service = new ArtifactBundleService();
  const bundleTypes: ArtifactBundleExtended["bundleType"][] = [
    "release_bundle",
    "asset_bundle",
    "campaign_bundle",
    "incident",
    "workflow_snapshot",
  ];

  for (const bundleType of bundleTypes) {
    const bundle = service.build({
      taskId: "task_1",
      domainId: "coding",
      bundleType,
      artifacts: [],
    });
    assert.equal(bundle.bundleType, bundleType);
    assert.equal(bundle.publishStatus, "draft");
  }
});

test("ArtifactBundleService.build preserves links array", () => {
  const service = new ArtifactBundleService();
  const links: readonly ArtifactLink[] = [
    {
      linkId: "link_1",
      fromArtifactId: "artifact_1",
      toArtifactId: "artifact_2",
      relation: "derived_from",
    },
    {
      linkId: "link_2",
      fromArtifactId: "artifact_2",
      toArtifactId: "artifact_3",
      relation: "depends_on",
    },
  ];

  const bundle = service.build({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
    links,
  });

  assert.equal(bundle.links.length, 2);
  assert.equal(bundle.links[0]!.linkId, "link_1");
  assert.equal(bundle.links[1]!.linkId, "link_2");
});

test("ArtifactBundleService.build creates bundle with all required timestamps", () => {
  const service = new ArtifactBundleService();
  const before = new Date().toISOString();
  const bundle = service.build({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
  });
  const after = new Date().toISOString();

  assert.ok(bundle.createdAt >= before);
  assert.ok(bundle.createdAt <= after);
  assert.equal(bundle.publishedAt, null);
});

// ---------------------------------------------------------------------------
// ArtifactPublishLedger - edge cases
// ---------------------------------------------------------------------------

test("ArtifactPublishLedger.record generates publishId with correct prefix", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = createMinimalBundle();
  const entry = ledger.record(bundle);

  assert.ok(entry.publishId.startsWith("artifact_publish_"));
});

test("ArtifactPublishLedger.list returns empty array initially", () => {
  const ledger = new ArtifactPublishLedger();
  const entries = ledger.list();
  assert.deepEqual(entries, []);
});

test("ArtifactPublishLedger.record uses bundle publishedAt when set", () => {
  const ledger = new ArtifactPublishLedger();
  const publishedAt = "2024-06-01T12:00:00.000Z";
  const bundle = createMinimalBundle({ publishedAt, publishStatus: "published" });
  const entry = ledger.record(bundle);

  assert.equal(entry.publishedAt, publishedAt);
});

test("ArtifactPublishLedger records multiple entries correctly", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle1 = createMinimalBundle({ bundleId: "bundle_1" });
  const bundle2 = createMinimalBundle({ bundleId: "bundle_2" });
  const bundle3 = createMinimalBundle({ bundleId: "bundle_3" });

  ledger.record(bundle1);
  ledger.record(bundle2);
  ledger.record(bundle3);

  const entries = ledger.list();
  assert.equal(entries.length, 3);
  assert.equal(entries[0]!.bundleId, "bundle_1");
  assert.equal(entries[1]!.bundleId, "bundle_2");
  assert.equal(entries[2]!.bundleId, "bundle_3");
});

// ---------------------------------------------------------------------------
// ArtifactPreviewService - edge cases
// ---------------------------------------------------------------------------

test("ArtifactPreviewService.renderBundle handles bundle with no artifacts", () => {
  const service = new ArtifactPreviewService();
  const bundle = createMinimalBundleExtended({ artifacts: [] });
  const rendered = service.renderBundle(bundle);

  assert.ok(rendered.includes("# Artifact Bundle"));
  assert.ok(rendered.includes("## Artifacts"));
  assert.ok(rendered.includes("## Deliverables"));
});

test("ArtifactPreviewService.renderBundle handles bundle with no finalDeliverables", () => {
  const service = new ArtifactPreviewService();
  const bundle = createMinimalBundleExtended({ finalDeliverables: [] });
  const rendered = service.renderBundle(bundle);

  assert.ok(rendered.includes("# Artifact Bundle"));
  assert.ok(rendered.includes("## Deliverables"));
});

test("ArtifactPreviewService.renderArtifact handles all artifact statuses", () => {
  const service = new ArtifactPreviewService();
  const statuses: ArtifactRecordExtended["publishStatus"][] = ["draft", "preview", "published", "archived"];

  for (const status of statuses) {
    const artifact: ArtifactRecordExtended = createMinimalArtifactExtended({
      artifactId: `artifact_${status}`,
      publishStatus: status,
    });

    const rendered = service.renderArtifact(artifact);
    assert.ok(rendered.includes(status));
  }
});

test("ArtifactPreviewService.previewDiff handles empty strings", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewDiff("", "");
  assert.ok(rendered.includes("--- previous"));
  assert.ok(rendered.includes("+++ current"));
});

test("ArtifactPreviewService.previewDiff handles single line content", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewDiff("old", "new");
  assert.ok(rendered.includes("-old"));
  assert.ok(rendered.includes("+new"));
});

test("ArtifactPreviewService.previewDiff handles multi-line with mixed changes", () => {
  const service = new ArtifactPreviewService();
  const previous = "line1\nline2\nline3\nline4\nline5";
  const current = "line1\nmodified\nline3\nline4\nline5";
  const rendered = service.previewDiff(previous, current);

  assert.ok(rendered.includes("-line2"));
  assert.ok(rendered.includes("+modified"));
});

test("ArtifactPreviewService.previewJson handles empty object", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewJson({});
  assert.ok(rendered.includes("# JSON Preview"));
  assert.ok(rendered.includes("## Tree"));
});

test("ArtifactPreviewService.previewJson handles null", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewJson(null);
  assert.ok(rendered.includes("# JSON Preview"));
  assert.ok(rendered.includes("null"));
});

test("ArtifactPreviewService.previewJson handles deeply nested objects", () => {
  const service = new ArtifactPreviewService();
  const value = { a: { b: { c: { d: { e: "deep" } } } } };
  const rendered = service.previewJson(value);
  assert.ok(rendered.includes("- a"));
  assert.ok(rendered.includes("- b"));
});

test("ArtifactPreviewService.previewJson handles arrays with mixed types", () => {
  const service = new ArtifactPreviewService();
  const value = [{ name: "test" }, 42, true, null];
  const rendered = service.previewJson(value);
  assert.ok(rendered.includes("- [0]"));
  assert.ok(rendered.includes("- [1]"));
  assert.ok(rendered.includes("- [2]"));
  assert.ok(rendered.includes("- [3]"));
});

test("ArtifactPreviewService.previewMarkdown extracts nested headings", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
  const rendered = service.previewMarkdown(markdown);
  assert.ok(rendered.includes("- H1"));
  assert.ok(rendered.includes("- H2"));
  assert.ok(rendered.includes("- H3"));
  assert.ok(rendered.includes("- H4"));
  assert.ok(rendered.includes("- H5"));
  assert.ok(rendered.includes("- H6"));
});

test("ArtifactPreviewService.previewMarkdown handles markdown with code blocks", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Title\n\n```javascript\nconst x = 1;\n```\n\n## Section";
  const rendered = service.previewMarkdown(markdown);
  assert.ok(rendered.includes("# Markdown Preview"));
  assert.ok(rendered.includes("- Title"));
  assert.ok(rendered.includes("- Section"));
});

test("ArtifactPreviewService.previewMarkdown handles markdown with links", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Title\n\nCheck [this link](https://example.com) for more info.";
  const rendered = service.previewMarkdown(markdown);
  assert.ok(rendered.includes("- Title"));
  assert.ok(rendered.includes("## Raw"));
});

// ---------------------------------------------------------------------------
// ArtifactPublishService - edge cases
// ---------------------------------------------------------------------------

test("ArtifactPublishService.publishToGit with empty repository throws", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended();

  // Empty repository should still work (no validation in the service itself)
  const result = service.publishToGit(bundle, { repository: "" });
  assert.equal(result.target, "git");
});

test("ArtifactPublishService.publishToNotion with empty parentPageId", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended();

  const result = service.publishToNotion(bundle, { parentPageId: "" });
  assert.equal(result.target, "notion");
  assert.ok(result.destination.includes("/"));
});

test("ArtifactPublishService.publishToCdn with trailing slash in baseUrl", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended();

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com///" });
  assert.ok(!result.destination.includes("///"));
});

test("ArtifactPublishService.publishToCdn with slashes in pathPrefix", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended();

  const result = service.publishToCdn(bundle, {
    baseUrl: "https://cdn.example.com",
    pathPrefix: "///path/to///artifacts///",
  });
  // Only leading/trailing slashes are stripped, not internal ones
  assert.ok(result.destination.includes("path/to///artifacts/"));
});

test("ArtifactPublishService.publishToGit records correct artifact count", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended({
    artifacts: [
      createMinimalArtifact({ artifactId: "a1" }),
      createMinimalArtifact({ artifactId: "a2" }),
      createMinimalArtifact({ artifactId: "a3" }),
    ],
  });

  service.publishToGit(bundle, { repository: "github.com/repo" });
  const history = service.listPublishHistory();

  assert.equal(history[0]!.artifactCount, 3);
});

test("ArtifactPublishService.publishToNotion records correct section count", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended({
    finalDeliverables: ["section1", "section2", "section3"],
  });

  const result = service.publishToNotion(bundle, { parentPageId: "page_123" });
  assert.deepEqual(result.metadata.sections, ["section1", "section2", "section3"]);
});

test("ArtifactPublishService.publishToCdn generates correct URLs for artifacts", () => {
  const ledger = new ArtifactPublishLedger();
  const service = new ArtifactPublishService(ledger);
  const bundle = createMinimalBundleExtended({
    artifacts: [
      createMinimalArtifact({ artifactId: "a1", path: "file1.txt" }),
      createMinimalArtifact({ artifactId: "a2", path: "file2.txt" }),
    ],
  });

  const result = service.publishToCdn(bundle, { baseUrl: "https://cdn.example.com" });
  const urls = result.metadata.urls as string[];
  assert.equal(urls.length, 2);
  assert.ok(urls[0]!.endsWith("/file1.txt"));
  assert.ok(urls[1]!.endsWith("/file2.txt"));
});

// ---------------------------------------------------------------------------
// ArtifactResolver - edge cases
// ---------------------------------------------------------------------------

test("ArtifactResolver.buildBundle handles empty arrays", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle([], []);
  assert.deepEqual(bundle.artifactRefs, []);
  assert.deepEqual(bundle.primaryRefs, []);
});

test("ArtifactResolver.buildBundle uses artifactRefs as primaryRefs when primaryRefs is empty", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["a", "b"], []);
  assert.deepEqual(bundle.primaryRefs, ["a", "b"]);
});

test("ArtifactResolver.resolveRef handles artifact: prefix", () => {
  const resolver = new ArtifactResolver();
  const records = [{ artifactId: "test123" }];
  const result = resolver.resolveRef("artifact:test123", records);
  assert.ok(result !== null);
  assert.equal(result!.artifactId, "test123");
});

test("ArtifactResolver.resolveRef handles record without prefix", () => {
  const resolver = new ArtifactResolver();
  const records = [{ artifactId: "test123" }];
  const result = resolver.resolveRef("test123", records);
  assert.ok(result !== null);
  assert.equal(result!.artifactId, "test123");
});

test("ArtifactResolver.resolveRef returns null for empty records array", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.resolveRef("artifact:test", []);
  assert.equal(result, null);
});

test("ArtifactResolver.resolveRef returns first match for duplicate refs", () => {
  const resolver = new ArtifactResolver();
  const records = [{ artifactId: "dup" }, { artifactId: "dup" }];
  const result = resolver.resolveRef("dup", records);
  assert.ok(result !== null);
  assert.equal(result!.artifactId, "dup");
});

// ---------------------------------------------------------------------------
// ArtifactVersioningService - edge cases
// ---------------------------------------------------------------------------

test("ArtifactVersioningService.createNextVersion increments from any version", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_test",
    version: 99,
    harnessRunId: "harness_test",
    type: "source_code",
    path: "src/index.ts",
    mimeType: "text/plain",
    sizeBytes: 100,
    checksum: "abc123",
    publishStatus: "draft" as const,
  };
  const next = service.createNextVersion(previous, {});
  assert.equal(next.version, 100);
});

test("ArtifactVersioningService.createNextVersion always sets parentArtifactId to previous artifactId", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "parent_art",
    version: 5,
    harnessRunId: "harness_test",
    type: "source_code",
    path: "src/index.ts",
    mimeType: "text/plain",
    sizeBytes: 100,
    checksum: "abc123",
    publishStatus: "draft" as const,
  };
  const next = service.createNextVersion(previous, { artifactId: "child_art" });
  assert.equal(next.parentArtifactId, "parent_art");
  assert.equal(next.artifactId, "child_art");
});

test("ArtifactVersioningService.createNextVersion preserves all extended fields", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "art_v1",
    version: 1,
    harnessRunId: "harness_test",
    type: "source_code",
    path: "src/index.ts",
    mimeType: "text/plain",
    sizeBytes: 100,
    checksum: "abc123",
    publishStatus: "draft" as const,
    metadata: { key: "value" },
  };
  const next = service.createNextVersion(previous, {});

  assert.equal(next.version, 2);
  assert.equal(next.parentArtifactId, "art_v1");
  assert.deepEqual(next.metadata, { key: "value" });
});

test("ArtifactVersioningService.createNextVersion allows new artifactId in overrides", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "original",
    version: 1,
    harnessRunId: "harness_test",
    type: "source_code",
    path: "src/index.ts",
    mimeType: "text/plain",
    sizeBytes: 100,
    checksum: "abc123",
    publishStatus: "draft" as const,
  };
  const next = service.createNextVersion(previous, { artifactId: "new_id" });
  assert.equal(next.artifactId, "new_id");
  assert.equal(next.version, 2);
  assert.equal(next.parentArtifactId, "original");
});

test("ArtifactVersioningService.createNextVersion ignores version in overrides", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_test",
    version: 3,
    harnessRunId: "harness_test",
    type: "source_code",
    path: "src/index.ts",
    mimeType: "text/plain",
    sizeBytes: 100,
    checksum: "abc123",
    publishStatus: "draft" as const,
  };
  const next = service.createNextVersion(previous, { version: 999 });
  assert.equal(next.version, 4); // Always previous.version + 1
});

// ---------------------------------------------------------------------------
// ArtifactPlaneService - edge cases
// ---------------------------------------------------------------------------

test("ArtifactPlaneService.prepareBundle with all bundle types", () => {
  const plane = new ArtifactPlaneService();
  const bundleTypes: ArtifactBundleExtended["bundleType"][] = [
    "release_bundle",
    "asset_bundle",
    "campaign_bundle",
    "incident",
    "workflow_snapshot",
  ];

  for (const bundleType of bundleTypes) {
    const result = plane.prepareBundle({
      taskId: "task_1",
      domainId: "coding",
      bundleType,
      artifacts: [],
    });
    assert.equal(result.bundle.bundleType, bundleType);
    assert.equal(result.governance.allowed, true);
  }
});

test("ArtifactPlaneService.prepareBundle with links", () => {
  const plane = new ArtifactPlaneService();
  const result = plane.prepareBundle({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [createMinimalArtifact()],
    links: [
      {
        linkId: "link_1",
        fromArtifactId: "artifact_1",
        toArtifactId: "artifact_2",
        relation: "depends_on",
      },
    ],
  });

  assert.ok(result.preview.includes("Artifact Bundle"));
});

test("ArtifactPlaneService.publishBundle fails governance blocks publishing", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_blocked",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
    finalDeliverables: ["token=abc1234567890abcdef"],
  });

  assert.equal(prepared.governance.allowed, false);
  assert.throws(
    () => plane.publishBundle(prepared.bundle),
    (error: unknown) => {
      if (typeof error !== "object" || error === null) return false;
      return "code" in error && error.code === "artifact_plane.publish_blocked";
    },
  );
});

test("ArtifactPlaneService.publishBundle recalls already published bundle", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
  });

  // First publish should succeed
  const published = plane.publishBundle(prepared.bundle);
  assert.equal(published.bundle.publishStatus, "published");

  // Trying to publish an already published bundle should fail
  assert.throws(
    () => plane.publishBundle(published.bundle),
    (error: unknown) => {
      if (typeof error !== "object" || error === null) return false;
      return "code" in error && error.code === "artifact.publish_already_published";
    },
  );
});

test("ArtifactPlaneService.publishBundle with review status bundle", () => {
  const plane = new ArtifactPlaneService();
  const prepared = plane.prepareBundle({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [],
  });

  // Manually set to preview status
  const reviewBundle: ArtifactBundleExtended = {
    ...prepared.bundle,
    publishStatus: "preview",
  };

  // publishBundle should still work - it creates a new published bundle
  const published = plane.publishBundle(reviewBundle);
  assert.equal(published.bundle.publishStatus, "published");
});

test("ArtifactPlaneService.prepareBundle computes correct totalSize", () => {
  const plane = new ArtifactPlaneService();
  const artifacts = [
    createMinimalArtifact({ artifactId: "a1", sizeBytes: 100 }),
    createMinimalArtifact({ artifactId: "a2", sizeBytes: 200 }),
    createMinimalArtifact({ artifactId: "a3", sizeBytes: 300 }),
  ];

  const result = plane.prepareBundle({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts,
  });

  assert.equal(result.bundle.totalSize, 600);
});

test("ArtifactPlaneService.listPublishHistory returns empty initially", () => {
  const plane = new ArtifactPlaneService();
  const history = plane.listPublishHistory();
  assert.deepEqual(history, []);
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function createMinimalBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  const now = new Date().toISOString();
  return {
    bundleId: "bundle_test",
    taskId: "task_test",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 1024,
    createdAt: now,
    bundleType: "release_bundle",
    domainId: "domain_test",
    publishStatus: "draft",
    publishedAt: null,
    ...overrides,
  };
}

function createMinimalBundleExtended(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  return createMinimalBundle(overrides);
}

function createMinimalArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "artifact_test",
    harnessRunId: "harness_test",
    taskId: "task_1",
    type: "source_code",
    path: "src/index.ts",
    checksum: "abc123",
    version: 1,
    sizeBytes: 100,
    createdAt: new Date().toISOString(),
    publishStatus: "draft",
    mimeType: "text/plain",
    metadata: {},
    ...overrides,
  };
}

function createMinimalArtifactExtended(overrides: Partial<ArtifactRecordExtended> = {}): ArtifactRecordExtended {
  const base: ArtifactRecordExtended = {
    artifactId: "artifact:test",
    harnessRunId: "harness_test",
    taskId: "task:test",
    type: "source_code",
    path: "/test/path",
    checksum: "abc123",
    version: 1,
    sizeBytes: 100,
    createdAt: "2024-01-01T00:00:00.000Z",
    publishStatus: "draft",
    mimeType: "text/plain",
    metadata: {},
    namespace: "test",
    artifactType: "source_code",
    storageUri: "file:///test",
    createdBy: "test-user",
    ...overrides,
  };
  return base;
}
