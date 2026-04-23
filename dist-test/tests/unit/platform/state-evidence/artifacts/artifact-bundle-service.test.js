import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactBundleService } from "../../../../../src/platform/state-evidence/artifacts/artifact-bundle-service.js";
test("ArtifactBundleService.build creates bundle with correct structure", () => {
    const service = new ArtifactBundleService();
    const artifacts = [
        {
            artifactId: "artifact_1",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "source_code",
            path: "src/index.ts",
            contentHash: "abc123",
            version: 1,
            parentArtifactId: null,
            size: 1024,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
    ];
    const bundle = service.build({
        taskId: "task_1",
        domainId: "coding",
        bundleType: "release_bundle",
        artifacts,
    });
    assert.ok(bundle.bundleId.startsWith("artifact_bundle_"));
    assert.equal(bundle.taskId, "task_1");
    assert.equal(bundle.domainId, "coding");
    assert.equal(bundle.bundleType, "release_bundle");
    assert.equal(bundle.artifacts.length, 1);
    assert.equal(bundle.totalSize, 1024);
    assert.equal(bundle.publishStatus, "draft");
    assert.equal(bundle.publishedAt, null);
    assert.equal(bundle.finalDeliverables.length, 1);
    assert.equal(bundle.finalDeliverables[0], "artifact_1");
});
test("ArtifactBundleService.build calculates totalSize correctly", () => {
    const service = new ArtifactBundleService();
    const artifacts = [
        {
            artifactId: "artifact_1",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "source_code",
            path: "src/a.ts",
            contentHash: "hash1",
            version: 1,
            parentArtifactId: null,
            size: 100,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
        {
            artifactId: "artifact_2",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "source_code",
            path: "src/b.ts",
            contentHash: "hash2",
            version: 1,
            parentArtifactId: null,
            size: 200,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
    ];
    const bundle = service.build({
        taskId: "task_1",
        domainId: "coding",
        bundleType: "release_bundle",
        artifacts,
    });
    assert.equal(bundle.totalSize, 300);
});
test("ArtifactBundleService.build uses provided finalDeliverables", () => {
    const service = new ArtifactBundleService();
    const artifacts = [
        {
            artifactId: "artifact_1",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "source_code",
            path: "src/index.ts",
            contentHash: "abc123",
            version: 1,
            parentArtifactId: null,
            size: 1024,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
    ];
    const bundle = service.build({
        taskId: "task_1",
        domainId: "coding",
        bundleType: "release_bundle",
        artifacts,
        finalDeliverables: ["artifact_1", "artifact_documentation"],
    });
    assert.deepEqual(bundle.finalDeliverables, ["artifact_1", "artifact_documentation"]);
});
test("ArtifactBundleService.build includes links if provided", () => {
    const service = new ArtifactBundleService();
    const artifacts = [
        {
            artifactId: "artifact_1",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "source_code",
            path: "src/index.ts",
            contentHash: "abc123",
            version: 1,
            parentArtifactId: null,
            size: 1024,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
    ];
    const links = [
        {
            linkId: "link_1",
            fromArtifactId: "artifact_1",
            toArtifactId: "artifact_2",
            relation: "depends_on",
        },
    ];
    const bundle = service.build({
        taskId: "task_1",
        domainId: "coding",
        bundleType: "release_bundle",
        artifacts,
        links,
    });
    assert.equal(bundle.links.length, 1);
    const firstLink = bundle.links[0];
    assert.ok(firstLink);
    assert.equal(firstLink.linkId, "link_1");
});
test("ArtifactBundleService.build creates defensive copies of artifacts", () => {
    const service = new ArtifactBundleService();
    const originalArtifacts = [
        {
            artifactId: "artifact_1",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "source_code",
            path: "src/index.ts",
            contentHash: "abc123",
            version: 1,
            parentArtifactId: null,
            size: 1024,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
    ];
    const bundle = service.build({
        taskId: "task_1",
        domainId: "coding",
        bundleType: "release_bundle",
        artifacts: originalArtifacts,
    });
    // Modifying the returned bundle's artifacts should not affect original input
    bundle.artifacts.push({
        artifactId: "artifact_2",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code",
        path: "src/extra.ts",
        contentHash: "extra",
        version: 1,
        parentArtifactId: null,
        size: 50,
        createdAt: "2024-01-01T00:00:00.000Z",
        status: "committed",
    });
    assert.equal(bundle.artifacts.length, 2);
    assert.equal(originalArtifacts.length, 1);
});
test("ArtifactBundleService.build handles workflow_snapshot bundle type", () => {
    const service = new ArtifactBundleService();
    const artifacts = [
        {
            artifactId: "snapshot_1",
            taskId: "task_1",
            stepId: "step_1",
            agentRole: "builder",
            type: "code_bundle",
            path: "workflow.json",
            contentHash: "workflow_hash",
            version: 1,
            parentArtifactId: null,
            size: 512,
            createdAt: "2024-01-01T00:00:00.000Z",
            status: "committed",
        },
    ];
    const bundle = service.build({
        taskId: "task_1",
        domainId: "coding",
        bundleType: "workflow_snapshot",
        artifacts,
    });
    assert.equal(bundle.bundleType, "workflow_snapshot");
    assert.equal(bundle.publishStatus, "draft");
});
//# sourceMappingURL=artifact-bundle-service.test.js.map