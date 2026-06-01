import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  assertValidStartupEnv,
  validateStartupEnv,
  requireValidStartupEnv,
  StartupEnvSchema,
  DbPathSchema,
  ConfigEnvSchema,
  ApiPortSchema,
  LogStdoutSchema,
  MaxAgentToolCallsSchema,
  OtelEnabledSchema,
  ExpectedGovernanceVersionSchema,
  type StartupEnvValidationResult,
} from "../../../../../src/platform/five-plane-control-plane/config-center/startup-env-schema.js";

test("validateStartupEnv returns success for valid minimal config", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
  });
  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
});

test("validateStartupEnv returns success for full valid config", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_CONFIG_ENV: "prod",
    AA_CONFIG_ROOT: "/config",
    AA_API_PORT: "3000",
    AA_API_HOST: "0.0.0.0",
    AA_LOG_STDOUT: "true",
    AA_LOG_FILE_PATH: "logs/app.log",
    AA_LOG_FILE_MAX_BYTES: "10485760",
    AA_LOG_FILE_MAX_FILES: "5",
    AA_MAX_AGENT_TOOL_CALLS: "1000",
    AA_MAX_AGENT_MEMORY_MB: "512",
    AA_MAX_AGENT_ELAPSED_MS: "300000",
    AA_OTEL_ENABLED: "true",
    AA_OTEL_ENDPOINT: "https://otel.example.com",
    AA_OTEL_SERVICE_NAME: "my-service",
    AA_OTEL_SERVICE_VERSION: "1.0.0",
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: "1.0",
    AA_SANDBOX_MAX_MEMORY_MB: "1024",
    AA_SANDBOX_TIMEOUT_MS: "60000",
    AA_API_JWT_SECRET: "test-secret",
  });
  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
});

test("validateStartupEnv fails when AA_DB_PATH is missing", () => {
  const result = validateStartupEnv({});
  assert.equal(result.success, false);
  assert.ok(result.errors.some(e => e.key === "AA_DB_PATH"));
});

test("validateStartupEnv fails for invalid AA_CONFIG_ENV", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_CONFIG_ENV: "invalid_env",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some(e => e.key === "AA_CONFIG_ENV"));
});

test("validateStartupEnv accepts all valid environment names", () => {
  for (const env of ["dev", "test", "staging", "pre-prod", "prod"]) {
    const result = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_CONFIG_ENV: env });
    assert.equal(result.success, true, `Environment ${env} should be valid`);
  }
});

test("validateStartupEnv fails for invalid AA_API_PORT", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_API_PORT: "not_a_number",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some(e => e.key === "AA_API_PORT"));
});

test("validateStartupEnv fails for AA_API_PORT out of range", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_API_PORT: "70000",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some(e => e.key === "AA_API_PORT"));
});

test("validateStartupEnv accepts port 1 and 65535", () => {
  for (const port of ["1", "65535"]) {
    const result = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_API_PORT: port });
    assert.equal(result.success, true, `Port ${port} should be valid`);
  }
});

test("validateStartupEnv accepts boolean-like strings for AA_LOG_STDOUT", () => {
  for (const val of ["1", "true", "yes", "on", "0", "false", "no", "off"]) {
    const result = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_LOG_STDOUT: val });
    assert.equal(result.success, true, `LOG_STDOUT=${val} should be valid`);
  }
});

test("validateStartupEnv trims whitespace-only strings and rejects empty effective values", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "   ",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_DB_PATH"));
});

test("validateStartupEnv does not require plugin sandbox root when egress is explicitly false", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: "false",
  });
  assert.equal(result.success, true);
});

test("validateStartupEnv rejects conflicting postgres DSN aliases", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://db-a",
    AA_PG_DSN: "postgresql://db-b",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_STORAGE_POSTGRES_DSN"));
});

test("validateStartupEnv requires AA_API_JWT_SECRET when AA_API_KEYS_JSON is configured", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_API_KEYS_JSON: JSON.stringify([{ apiKey: "key", actorId: "actor", roles: ["viewer"] }]),
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_API_JWT_SECRET"));
});

test("validateStartupEnv requires AA_API_JWT_SECRET when legacy AA_API_KEYS is configured", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_API_KEYS: "key-a,key-b",
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((e) => e.key === "AA_API_JWT_SECRET"));
});

test("validateStartupEnv fails for invalid AA_LOG_STDOUT", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/db",
    AA_LOG_STDOUT: "maybe",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some(e => e.key === "AA_LOG_STDOUT"));
});

test("validateStartupEnv validates AA_MAX_AGENT_TOOL_CALLS as positive integer", () => {
  const valid = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_MAX_AGENT_TOOL_CALLS: "100" });
  assert.equal(valid.success, true);

  const invalid = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_MAX_AGENT_TOOL_CALLS: "0" });
  assert.equal(invalid.success, false);
});

test("validateStartupEnv allows AA_MAX_AGENT_TOOL_CALLS to be null (optional)", () => {
  const result = validateStartupEnv({ AA_DB_PATH: "/tmp/db" });
  assert.equal(result.success, true);
  assert.equal(result.parsed?.AA_MAX_AGENT_TOOL_CALLS, null);
});

test("validateStartupEnv validates AA_OTEL_ENDPOINT as URL", () => {
  const valid = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_OTEL_ENDPOINT: "https://otel.example.com/v1/traces" });
  assert.equal(valid.success, true);

  const invalid = validateStartupEnv({ AA_DB_PATH: "/tmp/db", AA_OTEL_ENDPOINT: "not_a_url" });
  assert.equal(invalid.success, false);
});

test("validateStartupEnv returns structured errors with key and message", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "",
    AA_CONFIG_ENV: "invalid",
    AA_API_PORT: "abc",
  });
  assert.equal(result.success, false);
  assert.equal(result.errors.length >= 3, true);

  const keys = result.errors.map(e => e.key);
  assert.ok(keys.includes("AA_DB_PATH"));
  assert.ok(keys.includes("AA_CONFIG_ENV"));
  assert.ok(keys.includes("AA_API_PORT"));

  for (const err of result.errors) {
    assert.ok(err.message.length > 0, "Each error should have a message");
  }
});

test("requireValidStartupEnv throws validation error on invalid env instead of exiting inline", () => {
  assert.throws(
    () => requireValidStartupEnv({ AA_DB_PATH: "" }),
    (error: unknown) => error instanceof ValidationError && error.code === "startup_env.validation_failed",
  );
});

test("requireValidStartupEnv returns for valid env without forcing process exit", () => {
  assert.doesNotThrow(() => {
    requireValidStartupEnv({ AA_DB_PATH: "/tmp/db" });
  });
});

test("assertValidStartupEnv throws typed validation error instead of exiting", () => {
  assert.throws(
    () => assertValidStartupEnv({ AA_DB_PATH: "" }),
    /FATAL: Startup environment validation failed/,
  );
});

test("StartupEnvSchema.parse returns inferred types", () => {
  // Provide all required fields for successful parse
  const parsed = StartupEnvSchema.parse({
    AA_DB_PATH: "/tmp/test.db",
    AA_CONFIG_ENV: "staging",
    AA_CONFIG_ROOT: "/config",
    AA_API_PORT: "8080",
    AA_API_HOST: "0.0.0.0",
    AA_LOG_STDOUT: "true",
    AA_LOG_FILE_PATH: "logs/app.log",
    AA_LOG_FILE_MAX_BYTES: "10485760",
    AA_LOG_FILE_MAX_FILES: "5",
    AA_MAX_AGENT_TOOL_CALLS: "1000",
    AA_MAX_AGENT_MEMORY_MB: "512",
    AA_MAX_AGENT_ELAPSED_MS: "300000",
    AA_OTEL_ENABLED: "true",
    AA_OTEL_ENDPOINT: "https://otel.example.com",
    AA_OTEL_SERVICE_NAME: "my-service",
    AA_OTEL_SERVICE_VERSION: "1.0.0",
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: "1.0",
    AA_SANDBOX_MAX_MEMORY_MB: null,
    AA_SANDBOX_TIMEOUT_MS: null,
    AA_API_JWT_SECRET: null,
  });
  assert.equal(parsed.AA_DB_PATH, "/tmp/test.db");
  assert.equal(parsed.AA_CONFIG_ENV, "staging");
  assert.equal(parsed.AA_API_PORT, "8080");
});
