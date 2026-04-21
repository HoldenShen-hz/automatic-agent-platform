import assert from "node:assert/strict";
import test from "node:test";
import {
  StartupEnvSchema,
  validateStartupEnv,
  type StartupEnvValidationError,
} from "../../../../../src/platform/control-plane/config-center/startup-env-schema.js";

/**
 * SYS-SEC-4.1: Startup Environment Validation Tests
 *
 * Verifies that critical AA_* environment variables are validated at startup.
 * §9 配置与部署架构要求 8 层配置校验，此文件提供第 1 层：
 * 启动时入口点校验（P0 级字段）。
 */

test("[SYS-SEC-4.1] startup env schema validates required AA_DB_PATH rejects empty string", () => {
  // Save original env
  const previousDbPath = process.env.AA_DB_PATH;
  const savedVars: Record<string, string | undefined> = {};
  const aaVars = [
    "AA_CONFIG_ENV",
    "AA_CONFIG_ROOT",
    "AA_API_PORT",
    "AA_API_HOST",
    "AA_LOG_STDOUT",
    "AA_LOG_FILE_MAX_BYTES",
    "AA_LOG_FILE_MAX_FILES",
    "AA_MAX_AGENT_TOOL_CALLS",
    "AA_MAX_AGENT_MEMORY_MB",
    "AA_MAX_AGENT_ELAPSED_MS",
    "AA_OTEL_ENABLED",
    "AA_OTEL_ENDPOINT",
    "AA_OTEL_SERVICE_NAME",
    "AA_OTEL_SERVICE_VERSION",
    "AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION",
    "AA_PLUGIN_REGISTRY_URL",
    "AA_PLUGIN_ALLOW_UNVERIFIED",
    "AA_SANDBOX_MAX_MEMORY_MB",
    "AA_SANDBOX_TIMEOUT_MS",
    "AA_API_JWT_SECRET",
    "AA_SECURITY_ENFORCE_SANDBOX",
    "AA_SECURITY_ALLOWED_HOSTS",
    "AA_REDIS_HOST",
    "AA_REDIS_PORT",
  ];

  try {
    for (const key of aaVars) {
      savedVars[key] = process.env[key];
      delete process.env[key];
    }

    // Set empty string for required AA_DB_PATH
    process.env.AA_DB_PATH = "";

    const result = validateStartupEnv();
    assert.ok(!result.success, "Empty AA_DB_PATH must fail validation");
    const hasDbPathError = result.errors.some(
      (e: StartupEnvValidationError) => e.key === "AA_DB_PATH" && e.message.includes("non-empty"),
    );
    assert.ok(hasDbPathError, `Expected non-empty error for AA_DB_PATH, got: ${JSON.stringify(result.errors)}`);
  } finally {
    // Restore all saved env vars
    if (previousDbPath == null) {
      delete process.env.AA_DB_PATH;
    } else {
      process.env.AA_DB_PATH = previousDbPath;
    }
    for (const [key, val] of Object.entries(savedVars)) {
      if (val == null) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }
});

test("[SYS-SEC-4.1] startup env schema validates all critical AA_ vars are present", () => {
  const schemaKeys = Object.keys(StartupEnvSchema.shape);
  const criticalVars = [
    "AA_STORAGE_DRIVER",
    "AA_API_HOST",
    "AA_API_PORT",
    "AA_PLUGIN_SANDBOX_ROOT",
    "AA_LOG_LEVEL",
  ];

  const missing: string[] = [];
  for (const v of criticalVars) {
    if (!schemaKeys.includes(v)) {
      missing.push(v);
    }
  }
  assert.deepStrictEqual(
    missing,
    [],
    `Critical AA_* vars must be in startup env schema. Missing: ${missing.join(", ")}`,
  );
});

test("[SYS-SEC-4.1] validateStartupEnv returns structured result with errors array", () => {
  // Set an invalid port to trigger validation error
  const previousPort = process.env.AA_API_PORT;
  const previousDbPath = process.env.AA_DB_PATH;

  try {
    process.env.AA_DB_PATH = "/tmp/test.db";
    process.env.AA_API_PORT = "not-a-port";

    const result = validateStartupEnv();
    assert.ok(!result.success, "Invalid port should cause validation failure");
    assert.ok(Array.isArray(result.errors), "errors must be an array");
    assert.ok(result.errors.length > 0, "errors array must not be empty");
    const portError = result.errors.find((e: StartupEnvValidationError) => e.key === "AA_API_PORT");
    assert.ok(portError, `Expected AA_API_PORT error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    if (previousDbPath == null) {
      delete process.env.AA_DB_PATH;
    } else {
      process.env.AA_DB_PATH = previousDbPath;
    }
    if (previousPort == null) {
      delete process.env.AA_API_PORT;
    } else {
      process.env.AA_API_PORT = previousPort;
    }
  }
});

test("[SYS-SEC-4.1] validateStartupEnv succeeds with valid env", () => {
  const previousVars: Record<string, string | undefined> = {};
  const aaVars = Object.keys(StartupEnvSchema.shape);

  try {
    for (const key of aaVars) {
      previousVars[key] = process.env[key];
    }

    // Set minimal valid env
    process.env.AA_DB_PATH = "/tmp/valid.db";
    process.env.AA_CONFIG_ENV = "dev";

    const result = validateStartupEnv();
    assert.ok(result.success, `Validation should succeed with valid env: ${JSON.stringify(result.errors)}`);
    assert.ok(result.parsed != null, "parsed result must be present on success");
  } finally {
    for (const [key, val] of Object.entries(previousVars)) {
      if (val == null) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }
});
