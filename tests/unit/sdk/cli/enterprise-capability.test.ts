/**
 * Enterprise Capability CLI Tests
 *
 * Tests for enterprise-capability CLI module which manages environment readiness
 * assessment and capability matrix reporting.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadEnterpriseCapabilityCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadEnterpriseCapabilityCliEnv", () => {
  it("parses register_readiness action", () => {
    const config = loadEnterpriseCapabilityCliEnv({
      AA_ENTERPRISE_CAPABILITY_ACTION: "register_readiness",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
      AA_COMPONENT_TYPE: "provider",
      AA_COMPONENT_ID: "test-component",
      AA_OWNER: "test-owner",
      AA_CREDENTIAL_READY: "true",
      AA_IS_ACTIVE: "true",
    });

    assert.equal(config.action, "register_readiness");
    assert.equal(config.environment, "dev");
    assert.equal(config.componentType, "provider");
    assert.equal(config.componentId, "test-component");
    assert.equal(config.credentialReady, true);
    assert.equal(config.isActive, true);
  });

  it("parses summary action", () => {
    const config = loadEnterpriseCapabilityCliEnv({
      AA_ENTERPRISE_CAPABILITY_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "staging",
      AA_DEPLOYMENT_MODE: "cloud_shared",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.environment, "staging");
    assert.equal(config.deploymentMode, "cloud_shared");
  });

  it("parses export action", () => {
    const config = loadEnterpriseCapabilityCliEnv({
      AA_ENTERPRISE_CAPABILITY_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "prod",
    });

    assert.equal(config.action, "export");
    assert.equal(config.environment, "prod");
  });

  it("parses list_readiness action", () => {
    const config = loadEnterpriseCapabilityCliEnv({
      AA_ENTERPRISE_CAPABILITY_ACTION: "list_readiness",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENVIRONMENT: "dev",
    });

    assert.equal(config.action, "list_readiness");
    assert.equal(config.environment, "dev");
  });

  it("parses list_reports action with limit", () => {
    const config = loadEnterpriseCapabilityCliEnv({
      AA_ENTERPRISE_CAPABILITY_ACTION: "list_reports",
      AA_DB_PATH: "/tmp/test.db",
      AA_LIMIT: "50",
    });

    assert.equal(config.action, "list_reports");
    assert.equal(config.limit, 50);
  });

  it("parses optional artifact root", () => {
    const config = loadEnterpriseCapabilityCliEnv({
      AA_ENTERPRISE_CAPABILITY_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_ENTERPRISE_CAPABILITY_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("throws ValidationError for unknown action", () => {
    assert.throws(
      () =>
        loadEnterpriseCapabilityCliEnv({
          AA_ENTERPRISE_CAPABILITY_ACTION: "unknown_action",
          AA_DB_PATH: "/tmp/test.db",
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("unknown_enterprise"),
    );
  });
});
