import test from "node:test";
import assert from "node:assert/strict";

import { ArtifactPreviewService } from "../../../../../src/platform/state-evidence/artifacts/artifact-preview-service.js";
import type { ArtifactBundleExtended, ArtifactRecord } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

function createArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "artifact_test_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "agent",
    type: "source_code",
    path: "/tmp/artifact.txt",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-04-01T00:00:00.000Z",
    status: "published",
    ...overrides,
  };
}

function createBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  return {
    bundleId: "bundle_1",
    taskId: "task_1",
    bundleType: "release_bundle",
    domainId: "test_domain",
    publishStatus: "published",
    publishedAt: "2026-04-01T00:00:00.000Z",
    artifacts: [createArtifact()],
    links: [],
    finalDeliverables: ["/tmp/output.txt"],
    totalSize: 1024,
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

test("ArtifactPreviewService.renderBundle formats bundle with all fields", () => {
  const service = new ArtifactPreviewService();
  const bundle = createBundle();
  const rendered = service.renderBundle(bundle);

  assert.ok(rendered.includes("# Artifact Bundle bundle_1"));
  assert.ok(rendered.includes("- domain: test_domain"));
  assert.ok(rendered.includes("- status: published"));
  assert.ok(rendered.includes("## Artifacts"));
  assert.ok(rendered.includes("## Deliverables"));
});

test("ArtifactPreviewService.renderBundle includes artifact previews", () => {
  const service = new ArtifactPreviewService();
  const bundle = createBundle({
    artifacts: [
      createArtifact({ artifactId: "artifact_a" }),
      createArtifact({ artifactId: "artifact_b" }),
    ],
  });
  const rendered = service.renderBundle(bundle);

  assert.ok(rendered.includes("artifact_a"));
  assert.ok(rendered.includes("artifact_b"));
});

test("ArtifactPreviewService.renderArtifact formats single artifact", () => {
  const service = new ArtifactPreviewService();
  const artifact = createArtifact({
    artifactId: "my_artifact",
    type: "source_code",
    version: 5,
  });
  const rendered = service.renderArtifact(artifact);

  assert.ok(rendered.includes("# Artifact my_artifact"));
  assert.ok(rendered.includes("- type: source_code"));
  assert.ok(rendered.includes("- version: 5"));
});

test("ArtifactPreviewService.previewDiff shows no changes for identical content", () => {
  const service = new ArtifactPreviewService();
  const content = "line1\nline2\nline3";
  const rendered = service.previewDiff(content, content);

  assert.ok(rendered.includes("--- previous"));
  assert.ok(rendered.includes("+++ current"));
  assert.ok(rendered.includes(" line1"));
});

test("ArtifactPreviewService.previewDiff highlights added lines", () => {
  const service = new ArtifactPreviewService();
  const previous = "line1\nline2";
  const current = "line1\nline2\nline3";
  const rendered = service.previewDiff(previous, current);

  assert.ok(rendered.includes("+line3"));
});

test("ArtifactPreviewService.previewDiff highlights removed lines", () => {
  const service = new ArtifactPreviewService();
  const previous = "line1\nline2\nline3";
  const current = "line1\nline2";
  const rendered = service.previewDiff(previous, current);

  assert.ok(rendered.includes("-line3"));
});

test("ArtifactPreviewService.previewJson renders JSON with tree structure", () => {
  const service = new ArtifactPreviewService();
  const value = { key: "hello", nested: { foo: "bar" } };
  const rendered = service.previewJson(value);

  assert.ok(rendered.includes("# JSON Preview"));
  assert.ok(rendered.includes("```json"));
  assert.ok(rendered.includes("## Tree"));
  assert.ok(rendered.includes("- key"));
  assert.ok(rendered.includes("- nested"));
});

test("ArtifactPreviewService.previewJson handles arrays", () => {
  const service = new ArtifactPreviewService();
  const value = ["a", "b", "c"];
  const rendered = service.previewJson(value);

  assert.ok(rendered.includes("- [0]"));
  assert.ok(rendered.includes("- [1]"));
  assert.ok(rendered.includes("- [2]"));
});

test("ArtifactPreviewService.previewMarkdown extracts headings", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Main\n## Section\n### Subsection\n\nSome text";
  const rendered = service.previewMarkdown(markdown);

  assert.ok(rendered.includes("# Markdown Preview"));
  assert.ok(rendered.includes("## Headings"));
  assert.ok(rendered.includes("- Main"));
  assert.ok(rendered.includes("- Section"));
  assert.ok(rendered.includes("- Subsection"));
});

test("ArtifactPreviewService.previewMarkdown handles markdown without headings", () => {
  const service = new ArtifactPreviewService();
  const markdown = "Just some plain text without headings";
  const rendered = service.previewMarkdown(markdown);

  assert.ok(rendered.includes("# Markdown Preview"));
  assert.ok(rendered.includes("## Raw"));
  assert.ok(rendered.includes("Just some plain text"));
});

test("ArtifactPreviewService.previewMarkdown handles empty markdown", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewMarkdown("");

  assert.ok(rendered.includes("# Markdown Preview"));
  assert.ok(rendered.includes("## Raw"));
});
