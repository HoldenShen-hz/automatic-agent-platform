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

test("ArtifactPreviewService.renderBundle handles empty artifacts array", () => {
  const service = new ArtifactPreviewService();
  const bundle = createBundle({ artifacts: [] });
  const rendered = service.renderBundle(bundle);

  assert.ok(rendered.includes("# Artifact Bundle bundle_1"));
  assert.ok(rendered.includes("## Artifacts"));
  assert.ok(!rendered.includes("- artifact"));
});

test("ArtifactPreviewService.renderBundle includes all final deliverables", () => {
  const service = new ArtifactPreviewService();
  const bundle = createBundle({
    finalDeliverables: ["/output/a.txt", "/output/b.txt", "/output/c.txt"],
  });
  const rendered = service.renderBundle(bundle);

  assert.ok(rendered.includes("/output/a.txt"));
  assert.ok(rendered.includes("/output/b.txt"));
  assert.ok(rendered.includes("/output/c.txt"));
});

test("ArtifactPreviewService.renderArtifact shows all artifact fields", () => {
  const service = new ArtifactPreviewService();
  const artifact = createArtifact({
    artifactId: "full_artifact",
    type: "document",
    path: "/docs/readme.md",
    version: 3,
    status: "draft",
  });
  const rendered = service.renderArtifact(artifact);

  assert.ok(rendered.includes("# Artifact full_artifact"));
  assert.ok(rendered.includes("- type: document"));
  assert.ok(rendered.includes("- path: /docs/readme.md"));
  assert.ok(rendered.includes("- version: 3"));
  assert.ok(rendered.includes("- status: draft"));
});

test("ArtifactPreviewService.renderArtifact handles all artifact statuses", () => {
  const service = new ArtifactPreviewService();
  const statuses = ["draft", "committed", "published", "archived"] as const;

  for (const status of statuses) {
    const artifact = createArtifact({ artifactId: `artifact_${status}`, status });
    const rendered = service.renderArtifact(artifact);
    assert.ok(rendered.includes(`- status: ${status}`), `Should render status: ${status}`);
  }
});

test("ArtifactPreviewService.previewDiff handles completely different content", () => {
  const service = new ArtifactPreviewService();
  const previous = "old content\nold line 2";
  const current = "new content\nnew line 2";
  const rendered = service.previewDiff(previous, current);

  assert.ok(rendered.includes("-old content"));
  assert.ok(rendered.includes("-old line 2"));
  assert.ok(rendered.includes("+new content"));
  assert.ok(rendered.includes("+new line 2"));
});

test("ArtifactPreviewService.previewDiff handles multiple mixed changes", () => {
  const service = new ArtifactPreviewService();
  const previous = "line1\nline2\nline3\nline4";
  const current = "line1\nmodified_line2\nline3\nadded_line5";
  const rendered = service.previewDiff(previous, current);

  assert.ok(rendered.includes("-line2"));
  assert.ok(rendered.includes("+modified_line2"));
  assert.ok(rendered.includes("+added_line5"));
});

test("ArtifactPreviewService.previewJson handles null value", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewJson(null);

  assert.ok(rendered.includes("# JSON Preview"));
  assert.ok(rendered.includes("## Tree"));
  assert.ok(rendered.includes("- null"));
});

test("ArtifactPreviewService.previewJson handles empty object", () => {
  const service = new ArtifactPreviewService();
  const rendered = service.previewJson({});

  assert.ok(rendered.includes("# JSON Preview"));
  assert.ok(rendered.includes("## Tree"));
  // Empty object produces no tree entries beyond the header
  assert.ok(rendered.includes("{}"));
});

test("ArtifactPreviewService.previewJson handles nested arrays", () => {
  const service = new ArtifactPreviewService();
  const value = { items: [["a", "b"], ["c", "d"]] };
  const rendered = service.previewJson(value);

  assert.ok(rendered.includes("# JSON Preview"));
  assert.ok(rendered.includes("- items"));
  assert.ok(rendered.includes("- [0]"));
});

test("ArtifactPreviewService.previewMarkdown handles h1 through h6 headings", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Heading1\n## Heading2\n### Heading3\n#### Heading4\n##### Heading5\n###### Heading6";
  const rendered = service.previewMarkdown(markdown);

  assert.ok(rendered.includes("- Heading1"));
  assert.ok(rendered.includes("- Heading2"));
  assert.ok(rendered.includes("- Heading3"));
  assert.ok(rendered.includes("- Heading4"));
  assert.ok(rendered.includes("- Heading5"));
  assert.ok(rendered.includes("- Heading6"));
});

test("ArtifactPreviewService.previewMarkdown handles headings with special characters", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Hello & World <test>\n## Code: `inline` and **bold**";
  const rendered = service.previewMarkdown(markdown);

  assert.ok(rendered.includes("- Hello & World <test>"));
  assert.ok(rendered.includes("- Code: `inline` and **bold**"));
});
