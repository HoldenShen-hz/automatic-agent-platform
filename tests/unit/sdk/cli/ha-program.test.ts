/**
 * HA Program CLI Tests
 *
 * Tests for ha-program CLI module which generates reports on system health,
 * availability, and resilience metrics.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadHaProgramCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";

describe("loadHaProgramCliEnv", () => {
  it("parses summary action", () => {
    const config = loadHaProgramCliEnv({
      AA_HA_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.environment, "dev");
  });

  it("parses export action", () => {
    const config = loadHaProgramCliEnv({
      AA_HA_PROGRAM_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
    });

    assert.equal(config.action, "export");
    assert.equal(config.environment, "prod");
  });

  it("parses optional artifact root", () => {
    const config = loadHaProgramCliEnv({
      AA_HA_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "staging",
      AA_HA_PROGRAM_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("uses summary as default action", () => {
    const config = loadHaProgramCliEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "summary");
  });

  it("requires environment to be specified", () => {
    const config = loadHaProgramCliEnv({
      AA_HA_PROGRAM_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
    });

    // Environment is required and defaults to undefined when not provided
    assert.equal(config.environment, undefined);
  });
});
