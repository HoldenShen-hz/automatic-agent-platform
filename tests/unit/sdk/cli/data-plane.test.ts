/**
 * Data Plane CLI Tests
 *
 * Tests for data-plane CLI module which manages analytics facts, archive bundles,
 * replay datasets, and data movement jobs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadDataPlaneCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadDataPlaneCliEnv", () => {
  it("parses create_analytics_fact action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "create_analytics_fact",
      AA_DB_PATH: "/tmp/test.db",
      AA_NAMESPACE_ID: "ns-123",
      AA_METRIC_NAME: "test_metric",
      AA_VALUE: "42",
      AA_WINDOW_START: "2024-01-01T00:00:00Z",
      AA_WINDOW_END: "2024-01-01T01:00:00Z",
      AA_SOURCE_REF: "source-abc",
    });

    assert.equal(config.action, "create_analytics_fact");
    assert.equal(config.namespaceId, "ns-123");
    assert.equal(config.metricName, "test_metric");
    assert.equal(config.value, 42);
    assert.equal(config.windowStart, "2024-01-01T00:00:00Z");
    assert.equal(config.windowEnd, "2024-01-01T01:00:00Z");
    assert.equal(config.sourceRef, "source-abc");
  });

  it("parses create_archive_bundle action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "create_archive_bundle",
      AA_DB_PATH: "/tmp/test.db",
      AA_NAMESPACE_ID: "ns-123",
      AA_BUNDLE_TYPE: "compressed",
      AA_SOURCE_REFS: '["ref1","ref2"]',
      AA_SUMMARY_REF: "summary-xyz",
    });

    assert.equal(config.action, "create_archive_bundle");
    assert.equal(config.bundleType, "compressed");
    assert.deepEqual(config.sourceRefs, ["ref1", "ref2"]);
    assert.equal(config.summaryRef, "summary-xyz");
  });

  it("parses create_replay_dataset action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "create_replay_dataset",
      AA_DB_PATH: "/tmp/test.db",
      AA_NAMESPACE_ID: "ns-123",
      AA_DATASET_TYPE: "test_replay",
      AA_SAMPLE_REFS: '["sample1"]',
      AA_TRUTH_REFS: '["truth1"]',
      AA_VERSION: "v1.0",
    });

    assert.equal(config.action, "create_replay_dataset");
    assert.equal(config.datasetType, "test_replay");
    assert.deepEqual(config.sampleRefs, ["sample1"]);
    assert.deepEqual(config.truthRefs, ["truth1"]);
    assert.equal(config.version, "v1.0");
  });

  it("parses start_movement_job action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "start_movement_job",
      AA_DB_PATH: "/tmp/test.db",
      AA_SOURCE_NAMESPACE_ID: "ns-source",
      AA_TARGET_NAMESPACE_ID: "ns-target",
      AA_MOVEMENT_TYPE: "analytics_etl",
      AA_INPUT_REFS: '["input1"]',
    });

    assert.equal(config.action, "start_movement_job");
    assert.equal(config.sourceNamespaceId, "ns-source");
    assert.equal(config.targetNamespaceId, "ns-target");
    assert.equal(config.movementType, "analytics_etl");
    assert.deepEqual(config.inputRefs, ["input1"]);
  });

  it("parses complete_movement_job action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "complete_movement_job",
      AA_DB_PATH: "/tmp/test.db",
      AA_JOB_ID: "job-123",
      AA_STATUS: "completed",
    });

    assert.equal(config.action, "complete_movement_job");
    assert.equal(config.jobId, "job-123");
    assert.equal(config.status, "completed");
  });

  it("parses summary action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_TENANT_ID: "tenant-456",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.tenantId, "tenant-456");
  });

  it("parses export action", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_TENANT_ID: "tenant-456",
    });

    assert.equal(config.action, "export");
  });

  it("parses optional artifact root", () => {
    const config = loadDataPlaneCliEnv({
      AA_DATA_PLANE_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_TENANT_ID: "tenant-456",
      AA_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("throws ValidationError for unknown action", () => {
    assert.throws(
      () =>
        loadDataPlaneCliEnv({
          AA_DATA_PLANE_ACTION: "unknown_action",
          AA_DB_PATH: "/tmp/test.db",
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("unknown_data_plane_action"),
    );
  });
});
