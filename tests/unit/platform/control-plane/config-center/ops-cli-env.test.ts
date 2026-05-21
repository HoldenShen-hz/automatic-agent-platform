import assert from "node:assert/strict";
import test from "node:test";
import { loadOpsCliEnv } from "../../../../../src/platform/five-plane-control-plane/config-center/ops-cli-env.js";

test("loadOpsCliEnv returns config with action from AA_OPS_ACTION", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
    AA_OPS_ACTION: "check",
  });
  assert.equal(config.action, "check");
});

test("loadOpsCliEnv falls back to AA_OPS_GOVERNANCE_ACTION", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
    AA_OPS_GOVERNANCE_ACTION: "report",
  });
  assert.equal(config.action, "report");
});

test("loadOpsCliEnv defaults action to check", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
  });
  assert.equal(config.action, "check");
});

test("loadOpsCliEnv requires environment", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "staging",
  });
  assert.equal(config.environment, "staging");
});

test("loadOpsCliEnv parses optional taskId", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
    AA_OPS_TASK_ID: "task-123",
  });
  assert.equal(config.taskId, "task-123");
});

test("loadOpsCliEnv parses optional artifactRoot", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
    AA_OPS_ARTIFACT_ROOT: "/artifacts",
  });
  assert.equal(config.artifactRoot, "/artifacts");
});

test("loadOpsCliEnv parses optional generatedAt", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
    AA_GENERATED_AT: "2024-01-01T00:00:00Z",
  });
  assert.equal(config.generatedAt, "2024-01-01T00:00:00Z");
});

test("loadOpsCliEnv returns dbPath", () => {
  const config = loadOpsCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "production",
  });
  assert.equal(config.dbPath, "/tmp/test.db");
});
