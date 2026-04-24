import test from "node:test";
import assert from "node:assert/strict";

import { loadEnterpriseCapabilityCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("loadEnterpriseCapabilityCliEnv parses readiness registration and list actions", () => {
  const register = loadEnterpriseCapabilityCliEnv({
    AA_ENTERPRISE_ACTION: "register_readiness",
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "dev",
    AA_COMPONENT_TYPE: "provider",
    AA_COMPONENT_ID: "test-component",
    AA_OWNER: "test-owner",
    AA_CREDENTIAL_READY: "true",
    AA_IS_ACTIVE: "true",
    AA_ARTIFACT_ROOT: "/tmp/artifacts",
  });
  const list = loadEnterpriseCapabilityCliEnv({
    AA_ENTERPRISE_ACTION: "list_reports",
    AA_DB_PATH: "/tmp/test.db",
    AA_LIMIT: "50",
  });

  assert.equal(register.action, "register_readiness");
  assert.equal(register.componentType, "provider");
  assert.equal(register.artifactRoot, "/tmp/artifacts");
  assert.equal(list.action, "list_reports");
  assert.equal(list.limit, 50);
});

test("loadEnterpriseCapabilityCliEnv defaults to summary and rejects unknown actions", () => {
  const summary = loadEnterpriseCapabilityCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENVIRONMENT: "staging",
  });

  assert.equal(summary.action, "summary");

  assert.throws(
    () =>
      loadEnterpriseCapabilityCliEnv({
        AA_ENTERPRISE_ACTION: "unknown_action",
        AA_DB_PATH: "/tmp/test.db",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "invalid_env:AA_ENTERPRISE_ACTION",
  );
});
