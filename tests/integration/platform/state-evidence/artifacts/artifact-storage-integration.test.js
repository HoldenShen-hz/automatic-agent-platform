/**
 * Integration Test: Artifact Storage
 *
 * Tests the ArtifactStore service including:
 * - Writing text and JSON artifacts
 * - Directory structure validation
 * - Checksum verification
 * - Sensitive content scanning
 * - Sandbox policy enforcement
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ArtifactStore } from "../../../../../src/platform/state-evidence/artifacts/artifact-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import { SandboxError } from "../../../../../src/platform/contracts/errors.js";

test("artifact storage: writes text artifact and creates proper directory structure", () => {
  const workspace = createTempWorkspace("aa-artifact-store-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });

    const taskId = newId("task");
    const result = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "output.ts",
      content: "export const greeting = 'hello';\n",
    });

    assert.ok(result.record.artifactId.startsWith("artifact_"), "Should generate valid artifact ID");
    assert.equal(result.record.taskId, taskId);
    assert.equal(result.record.kind, "code");
    assert.equal(result.record.fileName, "output.ts");
    assert.equal(result.record.mimeType, "text/plain");
    assert.ok(result.record.sizeBytes > 0, "Should compute size");
    assert.ok(result.record.checksum.startsWith("sha256:"), "Should compute SHA-256 checksum");

    // Verify directory structure: rootDir/taskId/artifactId/filename
    const expectedPathPattern = new RegExp(`^${workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/artifacts/${taskId}/[^/]+/output\\.ts$`);
    assert.ok(expectedPathPattern.test(result.record.storagePath), `Path should match structure: ${result.record.storagePath}`);

    // Verify ref
    assert.equal(result.ref.artifactId, result.record.artifactId);
    assert.equal(result.ref.kind, "code");
    assert.ok(result.ref.uri.length > 0);

    // Verify scan summary
    assert.equal(typeof result.scan.redactionCount, "number");
    assert.equal(typeof result.scan.injectionRisk, "string");
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: writes JSON artifact with automatic serialization", () => {
  const workspace = createTempWorkspace("aa-artifact-json-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });

    const taskId = newId("task");
    const content = {
      name: "test-config",
      version: "1.0.0",
      settings: {
        enabled: true,
        maxRetries: 3,
      },
    };

    const result = store.writeJsonArtifact({
      taskId,
      kind: "config",
      fileName: "config.json",
      content,
    });

    assert.equal(result.record.kind, "config");
    assert.equal(result.record.mimeType, "application/json");
    assert.ok(result.record.fileName.endsWith(".json"), "Should append .json if not present");
    assert.ok(result.record.sizeBytes > 0);
    assert.ok(result.record.checksum.startsWith("sha256:"));

    // Verify lineage contains artifact safety info
    const lineage = JSON.parse(result.record.lineageJson);
    assert.ok(lineage.artifactSafety, "Should include artifactSafety in lineage");
    assert.ok(typeof lineage.artifactSafety.contentSanitized === "boolean");
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: computes unique checksums for different content", () => {
  const workspace = createTempWorkspace("aa-artifact-checksum-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");

    const result1 = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "file1.txt",
      content: "content version 1",
    });

    const result2 = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "file2.txt",
      content: "content version 2",
    });

    assert.notEqual(result1.record.checksum, result2.record.checksum, "Different content should produce different checksums");
    assert.equal(result1.ref.checksum, result1.record.checksum);
    assert.equal(result2.ref.checksum, result2.record.checksum);
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: generates same checksum for identical content", () => {
  const workspace = createTempWorkspace("aa-artifact-stable-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");

    const result1 = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "original.txt",
      content: "identical content",
    });

    const result2 = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "duplicate.txt",
      content: "identical content",
    });

    assert.equal(result1.record.checksum, result2.record.checksum, "Same content should produce same checksum");
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: rejects path traversal in filename", () => {
  const workspace = createTempWorkspace("aa-artifact-traversal-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");

    // Attempt path traversal should be sanitized
    const result = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "../../../etc/passwd",
      content: "malicious content",
    });

    // Filename should be sanitized - no path traversal
    assert.ok(!result.record.fileName.includes(".."), "Path traversal should be removed from filename");
    assert.ok(!result.record.storagePath.includes(".."), "Storage path should not contain traversal");
    assert.ok(result.record.fileName !== "../../../etc/passwd");
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: stores execution and step IDs when provided", () => {
  const workspace = createTempWorkspace("aa-artifact-ids-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");
    const executionId = newId("exec");
    const stepId = newId("step");

    const result = store.writeTextArtifact({
      taskId,
      executionId,
      stepId,
      kind: "log",
      fileName: "execution.log",
      content: "Step completed successfully",
    });

    assert.equal(result.record.taskId, taskId);
    assert.equal(result.record.executionId, executionId);
    assert.equal(result.record.stepId, stepId);
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: preserves lineage metadata", () => {
  const workspace = createTempWorkspace("aa-artifact-lineage-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");

    const lineage = {
      parentArtifactId: "artifact_parent_123",
      source: "code-generation",
      version: 2,
    };

    const result = store.writeTextArtifact({
      taskId,
      kind: "code",
      fileName: "derived.ts",
      content: "// derived from parent",
      lineage,
    });

    const storedLineage = JSON.parse(result.record.lineageJson);
    assert.equal(storedLineage.parentArtifactId, "artifact_parent_123");
    assert.equal(storedLineage.source, "code-generation");
    assert.equal(storedLineage.version, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: handles special characters in filename", () => {
  const workspace = createTempWorkspace("aa-artifact-special-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");

    const result = store.writeTextArtifact({
      taskId,
      kind: "document",
      fileName: "report (final) [v1].txt",
      content: "Report content with special chars",
    });

    // Filename should be sanitized
    assert.ok(result.record.fileName.length > 0, "Should have a valid filename");
    assert.ok(!result.record.fileName.includes("/"), "Should not have forward slashes");
  } finally {
    cleanupPath(workspace);
  }
});

test("artifact storage: scan summary reflects content sanitization", () => {
  const workspace = createTempWorkspace("aa-artifact-scan-");

  try {
    const rootDir = join(workspace, "artifacts");
    const store = new ArtifactStore({ rootDir });
    const taskId = newId("task");

    // Content with control characters that should be sanitized
    const contentWithControlChars = "Normal text\u0000with\u0001control\u0002chars";

    const result = store.writeTextArtifact({
      taskId,
      kind: "log",
      fileName: "raw.log",
      content: contentWithControlChars,
    });

    assert.ok(typeof result.scan.controlCharsRemoved === "number");
    assert.ok(typeof result.scan.contentSanitized === "boolean");
  } finally {
    cleanupPath(workspace);
  }
});
