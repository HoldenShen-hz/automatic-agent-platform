/**
 * Ops Program CLI Tests
 *
 * Tests for ops-program CLI module which runs operational diagnostics,
 * health checks, and governance reporting.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadOpsProgramCliEnv } from "../../../../src/platform/control-plane/config-center/operations-cli-env.js";

describe("loadOpsProgramCliEnv", () => {
  it("parses summary action", () => {
    const config = loadOpsProgramCliEnv({
      AA_OPS_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.environment, "dev");
  });

  it("parses export action", () => {
    const config = loadOpsProgramCliEnv({
      AA_OPS_PROGRAM_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
    });

    assert.equal(config.action, "export");
    assert.equal(config.environment, "production");
  });

  it("parses optional task_id", () => {
    const config = loadOpsProgramCliEnv({
      AA_OPS_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "staging",
      AA_TASK_ID: "task-789",
    });

    assert.equal(config.taskId, "task-789");
  });

  it("parses optional shift_owner", () => {
    const config = loadOpsProgramCliEnv({
      AA_OPS_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
      AA_SHIFT_OWNER: "oncall-team",
    });

    assert.equal(config.shiftOwner, "oncall-team");
  });

  it("parses optional artifact root", () => {
    const config = loadOpsProgramCliEnv({
      AA_OPS_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_OPS_PROGRAM_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("uses default environment when not specified", () => {
    const config = loadOpsProgramCliEnv({
      AA_OPS_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
    });

    assert.equal(config.environment, "development");
  });

  it("uses summary as default action", () => {
    const config = loadOpsProgramCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
  });
});
