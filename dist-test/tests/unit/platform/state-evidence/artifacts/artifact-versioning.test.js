import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactVersioningService } from "../../../../../src/platform/state-evidence/artifacts/artifact-versioning.js";
function createMinimalArtifact(overrides = {}) {
    const base = {
        artifactId: "artifact:test",
        taskId: "task:test",
        stepId: "step:test",
        agentRole: "agent",
        type: "source_code",
        path: "/test/path",
        contentHash: "abc123",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "2024-01-01T00:00:00.000Z",
        status: "draft",
        namespace: "test",
        artifactType: "config",
        storageUri: "file:///test",
        createdBy: "test-user",
        metadata: {},
        ...overrides,
    };
    return base;
}
test("ArtifactVersioningService.createNextVersion increments version", () => {
    const service = new ArtifactVersioningService();
    const previous = createMinimalArtifact({ version: 1 });
    const next = service.createNextVersion(previous, {});
    assert.equal(next.version, 2);
});
test("ArtifactVersioningService.createNextVersion sets parentArtifactId", () => {
    const service = new ArtifactVersioningService();
    const previous = createMinimalArtifact({ artifactId: "artifact:v1", version: 1 });
    const next = service.createNextVersion(previous, {});
    assert.equal(next.parentArtifactId, "artifact:v1");
});
test("ArtifactVersioningService.createNextVersion preserves previous fields", () => {
    const service = new ArtifactVersioningService();
    const previous = createMinimalArtifact({
        artifactId: "artifact:test",
        taskId: "task:123",
        version: 5,
        namespace: "my-namespace",
    });
    const next = service.createNextVersion(previous, {});
    assert.equal(next.taskId, "task:123");
    assert.equal(next.namespace, "my-namespace");
});
test("ArtifactVersioningService.createNextVersion applies overrides but version is always incremented", () => {
    const service = new ArtifactVersioningService();
    const previous = createMinimalArtifact({ version: 1, namespace: "Original" });
    const next = service.createNextVersion(previous, { namespace: "Updated" });
    assert.equal(next.namespace, "Updated");
    assert.equal(next.version, 2); // Version is ALWAYS incremented from previous, not from overrides
});
test("ArtifactVersioningService.createNextVersion version override is ignored", () => {
    const service = new ArtifactVersioningService();
    const previous = createMinimalArtifact({ version: 5 });
    const next = service.createNextVersion(previous, { version: 99 });
    assert.equal(next.version, 6); // Version is always previous.version + 1, not 99
});
test("ArtifactVersioningService.createNextVersion allows multiple consecutive versions", () => {
    const service = new ArtifactVersioningService();
    // parentArtifactId is always set to previous.artifactId
    let current = createMinimalArtifact({ artifactId: "artifact:base", version: 1 });
    assert.equal(current.parentArtifactId, null); // Initial version has no parent
    current = service.createNextVersion(current, { artifactId: "artifact:v2" });
    assert.equal(current.version, 2);
    assert.equal(current.parentArtifactId, "artifact:base");
    current = service.createNextVersion(current, { artifactId: "artifact:v3" });
    assert.equal(current.version, 3);
    assert.equal(current.parentArtifactId, "artifact:v2");
});
test("ArtifactVersioningService.createNextVersion handles zero version", () => {
    const service = new ArtifactVersioningService();
    const previous = createMinimalArtifact({ version: 0 });
    const next = service.createNextVersion(previous, {});
    assert.equal(next.version, 1);
});
//# sourceMappingURL=artifact-versioning.test.js.map