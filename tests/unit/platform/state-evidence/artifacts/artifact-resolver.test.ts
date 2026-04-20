import test from "node:test";
import assert from "node:assert/strict";

import {
  ArtifactBundleService,
  ArtifactGovernanceService,
  ArtifactPublishLedger,
  ArtifactPreviewService,
  ArtifactPublishService,
  ArtifactResolver,
} from "../../../../../src/platform/state-evidence/artifacts/index.js";

function createBundle(bundleType: "release_bundle" | "workflow_snapshot" = "release_bundle") {
  const bundleService = new ArtifactBundleService();
  return bundleService.build({
    taskId: "task_1",
    domainId: "coding",
    bundleType,
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "src/foo.ts",
        contentHash: "hash",
        version: 1,
        parentArtifactId: null,
        size: 120,
        createdAt: new Date().toISOString(),
        status: "draft",
      },
    ],
    finalDeliverables: ["summary.md"],
  });
}

test("ArtifactResolver builds deduplicated bundles", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["artifact:a", "artifact:a", "artifact:b"], ["artifact:b", "artifact:b"]);
  assert.deepEqual(bundle.artifactRefs, ["artifact:a", "artifact:b"]);
  assert.deepEqual(bundle.primaryRefs, ["artifact:b"]);
  assert.equal(resolver.resolveRef("artifact:a", [{ artifactId: "a" }, { artifactId: "b" }])?.artifactId, "a");
});

test("ArtifactResolver resolveRef returns null for missing artifact", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.resolveRef("artifact:missing", [{ artifactId: "a" }, { artifactId: "b" }]);
  assert.equal(result, null);
});

test("ArtifactBundleService calculates total size correctly", () => {
  const bundleService = new ArtifactBundleService();
  const bundle = bundleService.build({
    taskId: "task_1",
    domainId: "coding",
    bundleType: "release_bundle",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "src/foo.ts",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: new Date().toISOString(),
        status: "draft",
      },
      {
        artifactId: "artifact_2",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "src/bar.ts",
        contentHash: "hash2",
        version: 1,
        parentArtifactId: null,
        size: 200,
        createdAt: new Date().toISOString(),
        status: "draft",
      },
    ],
  });

  assert.equal(bundle.totalSize, 300);
});

test("Artifact services build, govern, preview, and publish bundles", () => {
  const governance = new ArtifactGovernanceService();
  const preview = new ArtifactPreviewService();
  const publish = new ArtifactPublishService();
  const bundle = createBundle();

  assert.equal(governance.review(bundle).allowed, true);
  assert.match(preview.renderBundle(bundle), /Artifact Bundle/);
  assert.equal(publish.publish(bundle).publishStatus, "published");
});

test("ArtifactPublishService publishes to git, notion, and cdn without duplicate ledger entries", () => {
  const ledger = new ArtifactPublishLedger();
  const publish = new ArtifactPublishService(ledger);

  const gitResult = publish.publishToGit(createBundle(), {
    repository: "github.com/example/repo",
    branch: "release",
    commitMessage: "ship bundle",
  });
  assert.equal(gitResult.target, "git");
  assert.equal(gitResult.destination, "github.com/example/repo#release");
  assert.deepEqual(gitResult.metadata.files, ["src/foo.ts"]);

  const notionResult = publish.publishToNotion(createBundle(), {
    parentPageId: "page_123",
    pageTitle: "Bundle Page",
  });
  assert.equal(notionResult.target, "notion");
  assert.equal(notionResult.destination, `notion://page_123/${notionResult.bundle.bundleId}`);
  assert.equal(notionResult.metadata.pageTitle, "Bundle Page");

  const cdnResult = publish.publishToCdn(createBundle("workflow_snapshot"), {
    baseUrl: "https://cdn.example.com/",
    pathPrefix: "/bundles/",
  });
  assert.equal(cdnResult.target, "cdn");
  assert.equal(cdnResult.destination, `https://cdn.example.com/bundles/${cdnResult.bundle.bundleId}`);
  assert.deepEqual(cdnResult.metadata.urls, [`${cdnResult.destination}/src/foo.ts`]);

  const history = publish.listPublishHistory();
  assert.equal(history.length, 3);
  assert.deepEqual(history.map((entry) => entry.target), ["git", "notion", "cdn"]);
});

test("ArtifactPreviewService renders artifact, diff, json, and markdown previews", () => {
  const preview = new ArtifactPreviewService();
  const bundle = createBundle("workflow_snapshot");
  const artifact = bundle.artifacts[0]!;

  assert.match(preview.renderArtifact(artifact), /Artifact artifact_1/);

  const diff = preview.previewDiff("alpha\nbeta", "alpha\ngamma");
  assert.match(diff, /\+\+\+ current/);
  assert.match(diff, /-beta/);
  assert.match(diff, /\+gamma/);

  const jsonPreview = preview.previewJson({ task: "task_1", outputs: ["summary.md"] });
  assert.match(jsonPreview, /```json/);
  assert.match(jsonPreview, /- task/);
  assert.match(jsonPreview, /- outputs/);

  const markdownPreview = preview.previewMarkdown("# Title\n\n## Section\nBody");
  assert.match(markdownPreview, /Headings/);
  assert.match(markdownPreview, /- Title/);
  assert.match(markdownPreview, /- Section/);
});
