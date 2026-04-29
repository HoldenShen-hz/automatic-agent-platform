/**
 * @fileoverview P2 Engineering Defect Tests - SYS-SEC-4.1: Environment Variable Startup Validation
 *
 * Tests that the startup environment validation schema includes all critical
 * AA_* environment variables for plugin and security configurations.
 *
 * Corresponding defect: Plugin/security-related AA_* environment variables
 * are not within Zod startup validation scope.
 * Test type: Unit
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateStartupEnv,
  StartupEnvSchema,
  PluginSandboxRootSchema,
} from "../../../../../src/platform/five-plane-control-plane/config-center/startup-env-schema.js";

test("[SYS-SEC-4.1] startup env schema validates plugin sandbox root", () => {
  // Empty sandbox root should be rejected at startup
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_SANDBOX_ROOT: "",
  });

  assert.equal(result.success, false, "Empty sandbox root must be rejected at startup");
  assert.ok(
    result.errors.some((e) => e.key === "AA_PLUGIN_SANDBOX_ROOT"),
    "Error should mention AA_PLUGIN_SANDBOX_ROOT",
  );
});

test("[SYS-SEC-4.1] startup env schema rejects empty AA_PLUGIN_SANDBOX_ROOT", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_SANDBOX_ROOT: "",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "true",
  });

  // When network egress is enabled, sandbox root must be non-empty
  assert.equal(result.success, false, "Empty sandbox root must be rejected when network egress enabled");
  assert.ok(
    result.errors.some((e) => e.key === "AA_PLUGIN_SANDBOX_ROOT"),
    "Error should mention AA_PLUGIN_SANDBOX_ROOT",
  );
});

test("[SYS-SEC-4.1] startup env schema accepts valid plugin sandbox root", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_SANDBOX_ROOT: "/opt/aa/plugins",
  });

  assert.equal(result.success, true, "Valid sandbox root should be accepted");
});

test("[SYS-SEC-4.1] startup env schema validates all critical AA_ vars are in schema", () => {
  const schemaShape = StartupEnvSchema.shape;
  const requiredKeys = Object.keys(schemaShape);

  // Critical AA_* variables that must be in the startup env schema
  const criticalVars = [
    "AA_STORAGE_DRIVER",
    "AA_API_HOST",
    "AA_API_PORT",
    "AA_PLUGIN_SANDBOX_ROOT",
    "AA_LOG_LEVEL",
  ];

  for (const v of criticalVars) {
    assert.ok(
      requiredKeys.includes(v),
      `${v} must be in startup env schema (found: ${requiredKeys.filter((k) => k.startsWith("AA_")).join(", ")})`,
    );
  }
});

test("[SYS-SEC-4.1] startup env schema includes AA_PLUGIN_ALLOW_NETWORK_EGRESS", () => {
  const schemaShape = StartupEnvSchema.shape;
  assert.ok(
    "AA_PLUGIN_ALLOW_NETWORK_EGRESS" in schemaShape,
    "AA_PLUGIN_ALLOW_NETWORK_EGRESS must be in schema",
  );
});

test("[SYS-SEC-4.1] startup env schema includes AA_PLUGIN_RUNTIME_ISOLATION", () => {
  const schemaShape = StartupEnvSchema.shape;
  assert.ok(
    "AA_PLUGIN_RUNTIME_ISOLATION" in schemaShape,
    "AA_PLUGIN_RUNTIME_ISOLATION must be in schema",
  );
});

test("[SYS-SEC-4.1] startup env schema includes AA_PLUGIN_REGISTRY_URL", () => {
  const schemaShape = StartupEnvSchema.shape;
  assert.ok(
    "AA_PLUGIN_REGISTRY_URL" in schemaShape,
    "AA_PLUGIN_REGISTRY_URL must be in schema",
  );
});

test("[SYS-SEC-4.1] startup env schema includes AA_SECURITY_ENFORCE_SANDBOX", () => {
  const schemaShape = StartupEnvSchema.shape;
  assert.ok(
    "AA_SECURITY_ENFORCE_SANDBOX" in schemaShape,
    "AA_SECURITY_ENFORCE_SANDBOX must be in schema",
  );
});

test("[SYS-SEC-4.1] startup env schema validates AA_PLUGIN_ALLOW_UNVERIFIED", () => {
  // Test that the schema includes this field
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_ALLOW_UNVERIFIED: "invalid-value",
  });

  assert.equal(result.success, false, "Invalid boolean string should be rejected");
  assert.ok(
    result.errors.some((e) => e.key === "AA_PLUGIN_ALLOW_UNVERIFIED"),
    "Error should mention AA_PLUGIN_ALLOW_UNVERIFIED",
  );
});

test("[SYS-SEC-4.1] startup env schema accepts valid AA_PLUGIN_ALLOW_UNVERIFIED", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_ALLOW_UNVERIFIED: "true",
  });

  assert.equal(result.success, true, "Valid boolean string should be accepted");
});

test("[SYS-SEC-4.1] startup env schema validates AA_PLUGIN_RUNTIME_ISOLATION", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_RUNTIME_ISOLATION: "invalid_mode",
  });

  assert.equal(result.success, false, "Invalid isolation mode should be rejected");
});

test("[SYS-SEC-4.1] startup env schema accepts all valid AA_PLUGIN_RUNTIME_ISOLATION modes", () => {
  const validModes = [
    "shared_process",
    "serialized_in_process",
    "forked_process",
    "sandboxed_process",
    "containerized_process",
  ];

  for (const mode of validModes) {
    const result = validateStartupEnv({
      AA_DB_PATH: "/tmp/test.db",
      AA_PLUGIN_RUNTIME_ISOLATION: mode,
    });
    assert.equal(result.success, true, `Isolation mode ${mode} should be valid`);
  }
});

test("[SYS-SEC-4.1] startup env schema cross-validates AA_PLUGIN_ALLOW_NETWORK_EGRESS with AA_PLUGIN_SANDBOX_ROOT", () => {
  // When network egress is enabled, sandbox root is required
  const resultWithEgressNoSandbox = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "true",
  });

  assert.equal(resultWithEgressNoSandbox.success, false, "Should fail without sandbox root");
  assert.ok(
    resultWithEgressNoSandbox.errors.some((e) => e.key === "AA_PLUGIN_SANDBOX_ROOT"),
    "Error should require AA_PLUGIN_SANDBOX_ROOT when network egress enabled",
  );

  // Should pass when both are provided
  const resultWithBoth = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "true",
    AA_PLUGIN_SANDBOX_ROOT: "/opt/aa/plugins",
  });

  assert.equal(resultWithBoth.success, true, "Should pass when both provided");
});

test("[SYS-SEC-4.1] PluginSandboxRootSchema rejects empty string", () => {
  const result = PluginSandboxRootSchema.safeParse("");

  assert.equal(result.success, false, "Empty string should be rejected by PluginSandboxRootSchema");
});

test("[SYS-SEC-4.1] PluginSandboxRootSchema accepts valid path", () => {
  const result = PluginSandboxRootSchema.safeParse("/opt/aa/plugins");

  assert.equal(result.success, true, "Valid path should be accepted by PluginSandboxRootSchema");
  assert.equal(result.data, "/opt/aa/plugins");
});

test("[SYS-SEC-4.1] PluginSandboxRootSchema allows undefined (optional)", () => {
  const result = PluginSandboxRootSchema.safeParse(undefined);

  assert.equal(result.success, true, "Undefined should be allowed (optional field)");
  assert.equal(result.data, undefined);
});

test("[SYS-SEC-4.1] startup env schema includes security-related AA_ variables", () => {
  const schemaShape = StartupEnvSchema.shape;

  // Verify all security-related AA_ vars are in the schema
  const securityVars = [
    "AA_API_JWT_SECRET",
    "AA_SECURITY_ENFORCE_SANDBOX",
    "AA_SECURITY_ALLOWED_HOSTS",
  ];

  for (const v of securityVars) {
    assert.ok(
      v in schemaShape,
      `${v} must be in startup env schema for security validation`,
    );
  }
});

test("[SYS-SEC-4.1] startup env schema includes storage-related AA_ variables", () => {
  const schemaShape = StartupEnvSchema.shape;

  const storageVars = [
    "AA_STORAGE_DRIVER",
    "AA_STORAGE_POSTGRES_DSN",
  ];

  for (const v of storageVars) {
    assert.ok(
      v in schemaShape,
      `${v} must be in startup env schema for storage validation`,
    );
  }
});

test("[SYS-SEC-4.1] startup env schema validates AA_STORAGE_DRIVER enum", () => {
  // Valid values
  const validResult = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_STORAGE_DRIVER: "sqlite",
  });
  assert.equal(validResult.success, true, "sqlite should be valid");

  const postgresResult = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://localhost:5432/aa",
  });
  assert.equal(postgresResult.success, true, "postgres with DSN should be valid");

  // Invalid value
  const invalidResult = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_STORAGE_DRIVER: "mysql",
  });
  assert.equal(invalidResult.success, false, "mysql should be invalid");
  assert.ok(
    invalidResult.errors.some((e) => e.key === "AA_STORAGE_DRIVER"),
    "Error should mention AA_STORAGE_DRIVER",
  );
});
