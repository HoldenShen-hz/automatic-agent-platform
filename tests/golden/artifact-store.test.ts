/**
 * Golden Test: Artifact Store Output Structure
 *
 * Verifies artifact store produces consistent artifact records
 * with proper checksums, lineage tracking, and content references.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ArtifactStore } from "../../src/platform/state-evidence/artifacts/artifact-store.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: artifact store writeJsonArtifact produces valid artifact ref", () => {
  const workspace = createTempWorkspace("aa-golden-artifact-");

  const store = new ArtifactStore({ rootDir: workspace });

  const result = store.writeJsonArtifact({
    taskId: "artifact_task_001",
    kind: "test_result",
    fileName: "test-output.json",
    content: {
      status: "passed",
      duration: 1500,
      testCount: 42,
    },
    lineage: {
      source: "golden-test",
      testRun: "integration-001",
    },
  });

  // Verify result structure
  assert.ok(result, "Result should exist");
  assert.ok(result.record, "Should have record");
  assert.ok(result.ref, "Should have ref");
  assert.ok(result.scan, "Should have scan");

  assertGolden("artifact-store-json-basic", {
    hasRecord: result.record !== undefined,
    hasRef: result.ref !== undefined,
    hasScan: result.scan !== undefined,
    taskId: result.record.taskId,
    kind: result.record.kind,
  });

  cleanupPath(workspace);
});

test("golden: artifact store writeTextArtifact produces valid artifact ref", () => {
  const workspace = createTempWorkspace("aa-golden-artifact-text-");

  const store = new ArtifactStore({ rootDir: workspace });

  const result = store.writeTextArtifact({
    taskId: "artifact_text_001",
    kind: "log",
    fileName: "output.log",
    mimeType: "text/plain",
    content: "2026-04-27 INFO: Test log entry\n2026-04-27 WARN: Test warning\n",
    lineage: {
      source: "golden-test",
    },
  });

  assert.ok(result, "Result should exist");
  assert.equal(result.record.kind, "log");
  assert.equal(result.record.mimeType, "text/plain");

  assertGolden("artifact-store-text-basic", {
    kind: result.record.kind,
    mimeType: result.record.mimeType,
    contentSize: result.record.sizeBytes,
    hasChecksum: result.record.checksum !== null,
  });

  cleanupPath(workspace);
});

test("golden: artifact store artifact record has all required fields", () => {
  const workspace = createTempWorkspace("aa-golden-artifact-record-");

  const store = new ArtifactStore({ rootDir: workspace });

  const result = store.writeJsonArtifact({
    taskId: "artifact_record_001",
    kind: "config",
    fileName: "config.json",
    content: { key: "value" },
  });

  const record = result.record;

  // Verify all required fields
  assert.ok(record.artifactId, "Should have artifactId");
  assert.ok(record.taskId, "Should have taskId");
  assert.ok(record.kind, "Should have kind");
  assert.ok(record.fileName, "Should have fileName");
  assert.ok(record.mimeType, "Should have mimeType");
  assert.ok(typeof record.sizeBytes === "number", "sizeBytes should be number");
  assert.ok(record.checksum, "Should have checksum");
  assert.ok(record.createdAt, "Should have createdAt");
  assert.ok(record.lineage, "Should have lineage");

  assertGolden("artifact-store-record-fields", {
    artifactId: record.artifactId,
    taskId: record.taskId,
    kind: record.kind,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    hasChecksum: record.checksum !== null,
  });

  cleanupPath(workspace);
});

test("golden: artifact store scan summary has sanitization results", () => {
  const workspace = createTempWorkspace("aa-golden-artifact-scan-");

  const store = new ArtifactStore({ rootDir: workspace });

  const result = store.writeJsonArtifact({
    taskId: "artifact_scan_001",
    kind: "output",
    fileName: "output.json",
    content: { data: "test content" },
  });

  const scan = result.scan;

  assert.ok(typeof scan.redactionCount === "number", "Should have redactionCount");
  assert.ok(typeof scan.controlCharsRemoved === "number", "Should have controlCharsRemoved");
  assert.ok(typeof scan.ansiRemoved === "number", "Should have ansiRemoved");
  assert.ok(typeof scan.injectionRisk === "boolean", "Should have injectionRisk");

  assertGolden("artifact-store-scan-summary", {
    redactionCount: scan.redactionCount,
    controlCharsRemoved: scan.controlCharsRemoved,
    ansiRemoved: scan.ansiRemoved,
    injectionRisk: scan.injectionRisk,
    hasWarnings: scan.warnings !== undefined,
  });

  cleanupPath(workspace);
});

test("golden: artifact store artifact ref is lightweight reference", () => {
  const workspace = createTempWorkspace("aa-golden-artifact-ref-");

  const store = new ArtifactStore({ rootDir: workspace });

  const result = store.writeJsonArtifact({
    taskId: "artifact_ref_001",
    kind: "data",
    fileName: "data.json",
    content: { items: [1, 2, 3] },
  });

  const ref = result.ref;

  // Verify ref is lightweight (has minimal fields)
  assert.ok(ref.artifactId, "Should have artifactId");
  assert.ok(ref.taskId, "Should have taskId");
  assert.ok(ref.kind, "Should have kind");
  assert.ok(ref.fileName, "Should have fileName");

  // Ref should NOT have heavy content fields
  assert.ok(!("content" in ref), "Ref should not have content");
  assert.ok(!("lineage" in ref), "Ref should not have lineage");

  assertGolden("artifact-store-ref-structure", {
    artifactId: ref.artifactId,
    taskId: ref.taskId,
    kind: ref.kind,
    fileName: ref.fileName,
    hasSizeBytes: ref.sizeBytes !== undefined,
  });

  cleanupPath(workspace);
});
