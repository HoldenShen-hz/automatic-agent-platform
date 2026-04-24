import test from "node:test";
import assert from "node:assert/strict";

import { loadDataPlaneCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("loadDataPlaneCliEnv parses analytics, archive, replay, and movement job actions", () => {
  const analytics = loadDataPlaneCliEnv({
    AA_DATA_PLANE_ACTION: "create_analytics_fact",
    AA_DB_PATH: "/tmp/test.db",
    AA_NAMESPACE_ID: "ns-123",
    AA_METRIC_NAME: "test_metric",
    AA_VALUE: "42",
    AA_WINDOW_START: "2024-01-01T00:00:00Z",
    AA_WINDOW_END: "2024-01-01T01:00:00Z",
    AA_SOURCE_REF: "source-abc",
  });
  const archive = loadDataPlaneCliEnv({
    AA_DATA_PLANE_ACTION: "create_archive_bundle",
    AA_DB_PATH: "/tmp/test.db",
    AA_SOURCE_REFS_JSON: "[\"ref1\",\"ref2\"]",
    AA_SUMMARY_REF: "summary-xyz",
  });
  const replay = loadDataPlaneCliEnv({
    AA_DATA_PLANE_ACTION: "create_replay_dataset",
    AA_DB_PATH: "/tmp/test.db",
    AA_SAMPLE_REFS_JSON: "[\"sample1\"]",
    AA_TRUTH_REFS_JSON: "[\"truth1\"]",
  });
  const movement = loadDataPlaneCliEnv({
    AA_DATA_PLANE_ACTION: "start_movement_job",
    AA_DB_PATH: "/tmp/test.db",
    AA_SOURCE_NAMESPACE_ID: "ns-source",
    AA_TARGET_NAMESPACE_ID: "ns-target",
    AA_MOVEMENT_TYPE: "analytics_etl",
    AA_INPUT_REFS_JSON: "[\"input1\"]",
  });

  assert.equal(analytics.value, 42);
  assert.deepEqual(archive.sourceRefs, ["ref1", "ref2"]);
  assert.deepEqual(replay.truthRefs, ["truth1"]);
  assert.equal(movement.movementType, "analytics_etl");
});

test("loadDataPlaneCliEnv parses summary and export filters", () => {
  const summary = loadDataPlaneCliEnv({
    AA_DATA_PLANE_ACTION: "summary",
    AA_DB_PATH: "/tmp/test.db",
    AA_TENANT_ID: "tenant-456",
    AA_ARTIFACT_ROOT: "/tmp/artifacts",
  });
  const exportConfig = loadDataPlaneCliEnv({
    AA_DATA_PLANE_ACTION: "export",
    AA_DB_PATH: "/tmp/test.db",
    AA_TENANT_ID: "tenant-456",
  });

  assert.equal(summary.tenantId, "tenant-456");
  assert.equal(summary.artifactRoot, "/tmp/artifacts");
  assert.equal(exportConfig.action, "export");
});

test("loadDataPlaneCliEnv rejects unknown actions", () => {
  assert.throws(
    () =>
      loadDataPlaneCliEnv({
        AA_DATA_PLANE_ACTION: "unknown_action",
        AA_DB_PATH: "/tmp/test.db",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "invalid_env:AA_DATA_PLANE_ACTION",
  );
});
