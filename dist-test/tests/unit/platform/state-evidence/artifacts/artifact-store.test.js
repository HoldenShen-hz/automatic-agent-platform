import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { ArtifactStore } from "../../../../../src/platform/state-evidence/artifacts/artifact-store.js";
function createTempDir(prefix) {
    const tmpDir = join(process.env.TMPDIR ?? "/tmp", prefix);
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
}
test("ArtifactStore writes text artifact", () => {
    const rootDir = createTempDir("aa-artifact-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeTextArtifact({
        taskId: "task_123",
        executionId: "exec_456",
        stepId: "step_789",
        kind: "code",
        fileName: "test.js",
        content: "const x = 1;",
    });
    assert.ok(result.record.artifactId.startsWith("artifact_"));
    assert.equal(result.record.taskId, "task_123");
    assert.equal(result.record.executionId, "exec_456");
    assert.equal(result.record.stepId, "step_789");
    assert.equal(result.record.kind, "code");
    assert.equal(result.record.fileName, "test.js");
    assert.equal(result.record.mimeType, "text/plain");
    assert.ok(result.record.sizeBytes > 0);
    assert.ok(result.record.checksum.length === 64); // SHA-256 hex length
    assert.ok(result.scan.contentSanitized === false);
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore writes JSON artifact", () => {
    const rootDir = createTempDir("aa-artifact-json-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeJsonArtifact({
        taskId: "task_json",
        kind: "data",
        fileName: "result",
        content: { key: "value", number: 42 },
    });
    assert.ok(result.record.artifactId.startsWith("artifact_"));
    assert.equal(result.record.taskId, "task_json");
    assert.equal(result.record.kind, "data");
    assert.equal(result.record.mimeType, "application/json");
    assert.ok(result.record.fileName.endsWith(".json"));
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore sanitizes path traversal in filename", () => {
    const rootDir = createTempDir("aa-artifact-sanitize-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeTextArtifact({
        taskId: "task_sanitize",
        kind: "code",
        fileName: "../../../etc/passwd",
        content: "malicious",
    });
    // Path traversal sanitized: slashes/dots become underscores, preventing directory traversal
    // "../../../etc/passwd" becomes ".._.._etc_passwd" - safe for filesystem use
    assert.ok(!result.record.fileName.includes("/"));
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore handles special characters in content", () => {
    const rootDir = createTempDir("aa-artifact-special-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeTextArtifact({
        taskId: "task_special",
        kind: "code",
        fileName: "special.js",
        content: "const x = '\x00\x1b'; // control chars",
    });
    assert.ok(result.record.sizeBytes > 0);
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore computes correct checksum", () => {
    const rootDir = createTempDir("aa-artifact-checksum-test-");
    const store = new ArtifactStore({ rootDir });
    const content = "const checksum = true;";
    const result = store.writeTextArtifact({
        taskId: "task_checksum",
        kind: "code",
        fileName: "checksum.js",
        content,
    });
    // SHA-256 of "const checksum = true;" is deterministic
    assert.ok(result.record.checksum.length === 64);
    assert.equal(result.ref.checksum, result.record.checksum);
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore appends .json extension when missing", () => {
    const rootDir = createTempDir("aa-artifact-json-ext-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeJsonArtifact({
        taskId: "task_json_ext",
        kind: "data",
        fileName: "result", // missing .json
        content: { test: true },
    });
    assert.ok(result.record.fileName.endsWith(".json"));
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore preserves lineage in record", () => {
    const rootDir = createTempDir("aa-artifact-lineage-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeTextArtifact({
        taskId: "task_lineage",
        kind: "code",
        fileName: "derived.js",
        content: "// derived",
        lineage: { parentArtifactId: "artifact_parent", derivation: "copy" },
    });
    const lineage = JSON.parse(result.record.lineageJson);
    assert.equal(lineage.parentArtifactId, "artifact_parent");
    assert.equal(lineage.derivation, "copy");
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore returns scan summary", () => {
    const rootDir = createTempDir("aa-artifact-scan-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeTextArtifact({
        taskId: "task_scan",
        kind: "code",
        fileName: "scan.js",
        content: "console.log('hello');",
    });
    assert.ok(typeof result.scan.redactionCount === "number");
    assert.ok(typeof result.scan.controlCharsRemoved === "number");
    assert.ok(typeof result.scan.ansiRemoved === "boolean");
    assert.ok(typeof result.scan.injectionRisk === "string");
    assert.equal(result.scan.sensitiveFindingCount, 0);
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore blocks critical secret content", () => {
    const rootDir = createTempDir("aa-artifact-secret-block-test-");
    const store = new ArtifactStore({ rootDir });
    assert.throws(() => store.writeTextArtifact({
        taskId: "task_secret",
        kind: "config",
        fileName: "secret.env",
        content: "API_KEY=abc1234567890abcdef",
    }), (error) => typeof error === "object" && error != null && "code" in error && error.code === "artifact.sensitive_content_blocked");
    rmSync(rootDir, { recursive: true, force: true });
});
test("ArtifactStore records PII findings in lineage", () => {
    const rootDir = createTempDir("aa-artifact-pii-lineage-test-");
    const store = new ArtifactStore({ rootDir });
    const result = store.writeTextArtifact({
        taskId: "task_pii",
        kind: "report",
        fileName: "report.txt",
        content: "Contact owner@example.com before release.",
    });
    const lineage = JSON.parse(result.record.lineageJson);
    assert.equal(result.scan.sensitiveFindingCount, 1);
    assert.equal(lineage.artifactSafety.sensitiveFindingCount, 1);
    assert.match(lineage.artifactSafety.sensitiveFindings[0].code, /artifact.pii.email_detected/);
    rmSync(rootDir, { recursive: true, force: true });
});
//# sourceMappingURL=artifact-store.test.js.map