import assert from "node:assert/strict";
import test from "node:test";

import { loadDiagnosticsCliEnv } from "../../../../../src/platform/control-plane/config-center/diagnostics-cli-env.js";

test("diagnostics env loader parses required kind and optional scope", () => {
  const config = loadDiagnosticsCliEnv({
    AA_DB_PATH: "/tmp/diag.db",
    AA_DIAGNOSTICS_KIND: "incident-export",
    AA_TASK_ID: "task-1",
    AA_ARTIFACT_ROOT: "/tmp/artifacts",
  });

  assert.equal(config.dbPath, "/tmp/diag.db");
  assert.equal(config.kind, "incident-export");
  assert.equal(config.taskId, "task-1");
  assert.equal(config.artifactRoot, "/tmp/artifacts");
});

test("diagnostics env loader uses default values for optional fields", () => {
  const config = loadDiagnosticsCliEnv({
    AA_DB_PATH: "/tmp/diag.db",
    AA_DIAGNOSTICS_KIND: "incident-export",
  });

  assert.equal(config.dbPath, "/tmp/diag.db");
  assert.equal(config.kind, "incident-export");
});

test("diagnostics env loader handles minimal input", () => {
  const config = loadDiagnosticsCliEnv({
    AA_DIAGNOSTICS_KIND: "metrics",
  });

  assert.equal(config.kind, "metrics");
});
