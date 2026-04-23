import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactPreviewService } from "../../../../../../src/platform/state-evidence/artifacts/artifact-preview-service.js";

test("ArtifactPreviewService can be instantiated", () => {
  const service = new ArtifactPreviewService();
  assert.ok(service != null);
});

test("renderBundle returns string with bundleId", () => {
  const service = new ArtifactPreviewService();
  const bundle = {
    bundleId: "bundle_123",
    taskId: "task_456",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_a",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const result = service.renderBundle(bundle);
  assert.ok(result.includes("bundle_123"));
});

test("renderBundle includes domain and status", () => {
  const service = new ArtifactPreviewService();
  const bundle = {
    bundleId: "bundle_123",
    taskId: "task_456",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "my_domain",
    publishStatus: "published" as const,
    publishedAt: "2026-01-02T00:00:00.000Z",
  };
  const result = service.renderBundle(bundle);
  assert.ok(result.includes("my_domain"));
  assert.ok(result.includes("published"));
});

test("renderBundle lists artifacts", () => {
  const service = new ArtifactPreviewService();
  const bundle = {
    bundleId: "bundle_123",
    taskId: "task_456",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_456",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code" as const,
        path: "/path/to/file.js",
        contentHash: "abc123",
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
    domainId: "domain_a",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const result = service.renderBundle(bundle);
  assert.ok(result.includes("artifact_1"));
  assert.ok(result.includes("source_code"));
  assert.ok(result.includes("/path/to/file.js"));
});

test("renderBundle lists deliverables", () => {
  const service = new ArtifactPreviewService();
  const bundle = {
    bundleId: "bundle_123",
    taskId: "task_456",
    artifacts: [],
    links: [],
    finalDeliverables: ["deliverable_1", "deliverable_2"],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_a",
    publishStatus: "draft" as const,
    publishedAt: null,
  };
  const result = service.renderBundle(bundle);
  assert.ok(result.includes("deliverable_1"));
  assert.ok(result.includes("deliverable_2"));
  assert.ok(result.includes("## Deliverables"));
});

test("renderArtifact returns artifact details", () => {
  const service = new ArtifactPreviewService();
  const artifact = {
    artifactId: "artifact_xyz",
    taskId: "task_456",
    stepId: "step_1",
    agentRole: "builder",
    type: "document" as const,
    path: "/docs/readme.md",
    contentHash: "def456",
    version: 3,
    parentArtifactId: "artifact_old",
    size: 2048,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "committed" as const,
  };
  const result = service.renderArtifact(artifact);
  assert.ok(result.includes("artifact_xyz"));
  assert.ok(result.includes("document"));
  assert.ok(result.includes("/docs/readme.md"));
  assert.ok(result.includes("3"));
  assert.ok(result.includes("committed"));
});

test("previewDiff shows unified diff format", () => {
  const service = new ArtifactPreviewService();
  const previous = "line1\nline2\nline3";
  const current = "line1\nmodified\nline3";
  const result = service.previewDiff(previous, current);
  assert.ok(result.includes("--- previous"));
  assert.ok(result.includes("+++ current"));
  assert.ok(result.includes("-line2"));
  assert.ok(result.includes("+modified"));
});

test("previewDiff shows unchanged lines with space prefix", () => {
  const service = new ArtifactPreviewService();
  const previous = "line1\nline2";
  const current = "line1\nline2";
  const result = service.previewDiff(previous, current);
  assert.ok(result.includes(" line1"));
  assert.ok(result.includes(" line2"));
});

test("previewJson returns JSON preview with tree structure", () => {
  const service = new ArtifactPreviewService();
  const value = { name: "test", items: ["a", "b"] };
  const result = service.previewJson(value);
  assert.ok(result.includes("# JSON Preview"));
  assert.ok(result.includes("```json"));
  assert.ok(result.includes('"name": "test"'));
  assert.ok(result.includes("## Tree"));
  assert.ok(result.includes("- name"));
  assert.ok(result.includes("- items"));
});

test("previewJson handles nested objects in tree", () => {
  const service = new ArtifactPreviewService();
  const value = { outer: { inner: "value" } };
  const result = service.previewJson(value);
  assert.ok(result.includes("## Tree"));
  assert.ok(result.includes("- outer"));
  assert.ok(result.includes("- inner"));
});

test("previewJson handles arrays in tree", () => {
  const service = new ArtifactPreviewService();
  const value = { items: [{ id: 1 }, { id: 2 }] };
  const result = service.previewJson(value);
  assert.ok(result.includes("## Tree"));
  assert.ok(result.includes("- items"));
  assert.ok(result.includes("- - id"));
});

test("previewMarkdown extracts headings", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Title\n\n## Section One\n\nSome content\n\n### Subsection\n\nMore content";
  const result = service.previewMarkdown(markdown);
  assert.ok(result.includes("# Markdown Preview"));
  assert.ok(result.includes("## Headings"));
  assert.ok(result.includes("- Title"));
  assert.ok(result.includes("- Section One"));
  assert.ok(result.includes("- Subsection"));
});

test("previewMarkdown shows raw markdown", () => {
  const service = new ArtifactPreviewService();
  const markdown = "# Title\n\nContent here";
  const result = service.previewMarkdown(markdown);
  assert.ok(result.includes("## Raw"));
  assert.ok(result.includes("# Title"));
  assert.ok(result.includes("Content here"));
});

test("previewMarkdown handles document with no headings", () => {
  const service = new ArtifactPreviewService();
  const markdown = "Just plain text without any headings at all.";
  const result = service.previewMarkdown(markdown);
  assert.ok(result.includes("# Markdown Preview"));
  // Should not have Headings section if no headings found
  assert.ok(!result.includes("## Headings"));
  assert.ok(result.includes("## Raw"));
});