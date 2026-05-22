import test from "node:test";
import assert from "node:assert/strict";

import {
  readTrimmedEnv,
  resolveConfigEnvironment,
  resolveConfigRoot,
  resolveConfigWorkspaceRoot,
  resolveExpectedProtectedGovernanceVersion,
  loadExecutionResourceCeilingEnv,
  type RuntimeConfigEnvOptions,
  type ExecutionResourceCeilingEnvConfig,
} from "../../../../src/platform/shared/runtime-env.js";

test("readTrimmedEnv returns null for missing env var", () => {
  const result = readTrimmedEnv({}, "MISSING_VAR");
  assert.strictEqual(result, null);
});

test("readTrimmedEnv returns null for empty string env var", () => {
  const result = readTrimmedEnv({ MY_VAR: "" }, "MY_VAR");
  assert.strictEqual(result, null);
});

test("readTrimmedEnv returns null for whitespace-only env var", () => {
  const result = readTrimmedEnv({ MY_VAR: "   " }, "MY_VAR");
  assert.strictEqual(result, null);
});

test("readTrimmedEnv returns trimmed value for valid env var", () => {
  const result = readTrimmedEnv({ MY_VAR: "  value  " }, "MY_VAR");
  assert.strictEqual(result, "value");
});

test("readTrimmedEnv returns trimmed value without extra spaces", () => {
  const result = readTrimmedEnv({ MY_VAR: "production" }, "MY_VAR");
  assert.strictEqual(result, "production");
});

test("resolveConfigEnvironment returns explicit environment when provided", () => {
  const options: RuntimeConfigEnvOptions = {
    environment: "staging",
  };
  const result = resolveConfigEnvironment(options);
  assert.strictEqual(result, "staging");
});

test("resolveConfigEnvironment trims whitespace from explicit environment", () => {
  const options: RuntimeConfigEnvOptions = {
    environment: "  staging  ",
  };
  const result = resolveConfigEnvironment(options);
  assert.strictEqual(result, "staging");
});

test("resolveConfigEnvironment falls back when explicit environment is empty", () => {
  const options: RuntimeConfigEnvOptions = {
    environment: "",
    env: { AA_CONFIG_ENV: "staging" },
  };
  const result = resolveConfigEnvironment(options);
  assert.strictEqual(result, "staging");
});

test("resolveConfigEnvironment falls back to AA_CONFIG_ENV", () => {
  const env = { AA_CONFIG_ENV: "production" };
  const result = resolveConfigEnvironment({ env });
  assert.strictEqual(result, "production");
});

test("resolveConfigEnvironment falls back to prod when no env vars", () => {
  const result = resolveConfigEnvironment({ env: {} });
  assert.strictEqual(result, "prod");
});

test("resolveConfigRoot returns explicit configRoot when provided", () => {
  const options: RuntimeConfigEnvOptions = {
    configRoot: "/custom/config",
  };
  const result = resolveConfigRoot(options);
  assert.strictEqual(result, "/custom/config");
});

test("resolveConfigRoot trims whitespace from explicit configRoot", () => {
  const options: RuntimeConfigEnvOptions = {
    configRoot: "  /custom/config  ",
  };
  const result = resolveConfigRoot(options);
  assert.strictEqual(result, "/custom/config");
});

test("resolveConfigRoot falls back to AA_CONFIG_ROOT", () => {
  const env = { AA_CONFIG_ROOT: "/var/config" };
  const result = resolveConfigRoot({ env });
  assert.strictEqual(result, "/var/config");
});

test("resolveConfigRoot falls back to process.cwd/config when no env vars", () => {
  const result = resolveConfigRoot({});
  assert.ok(result.endsWith("/config"));
});

test("resolveConfigWorkspaceRoot returns parent of config root", () => {
  const result = resolveConfigWorkspaceRoot({ configRoot: "/workspace/config" });
  assert.strictEqual(result, "/workspace");
});

test("resolveExpectedProtectedGovernanceVersion returns null when not set", () => {
  const result = resolveExpectedProtectedGovernanceVersion({});
  assert.strictEqual(result, null);
});

test("resolveExpectedProtectedGovernanceVersion reads AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION", () => {
  const env = { AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: "v2.0" };
  const result = resolveExpectedProtectedGovernanceVersion(env);
  assert.strictEqual(result, "v2.0");
});

test("loadExecutionResourceCeilingEnv returns null values by default", () => {
  const result = loadExecutionResourceCeilingEnv({});
  assert.strictEqual(result.maxToolCalls, null);
  assert.strictEqual(result.maxMemoryMb, null);
  assert.strictEqual(result.maxElapsedMs, null);
});

test("loadExecutionResourceCeilingEnv parses AA_MAX_AGENT_TOOL_CALLS", () => {
  const env = { AA_MAX_AGENT_TOOL_CALLS: "100" };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.strictEqual(result.maxToolCalls, 100);
});

test("loadExecutionResourceCeilingEnv parses AA_MAX_AGENT_MEMORY_MB", () => {
  const env = { AA_MAX_AGENT_MEMORY_MB: "512" };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.strictEqual(result.maxMemoryMb, 512);
});

test("loadExecutionResourceCeilingEnv parses AA_MAX_AGENT_ELAPSED_MS", () => {
  const env = { AA_MAX_AGENT_ELAPSED_MS: "60000" };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.strictEqual(result.maxElapsedMs, 60000);
});

test("loadExecutionResourceCeilingEnv returns null for non-positive integers", () => {
  const env = { AA_MAX_AGENT_TOOL_CALLS: "-1" };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.strictEqual(result.maxToolCalls, null);
});

test("loadExecutionResourceCeilingEnv returns null for non-numeric values", () => {
  const env = { AA_MAX_AGENT_TOOL_CALLS: "invalid" };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.strictEqual(result.maxToolCalls, null);
});

test("loadExecutionResourceCeilingEnv handles zero correctly", () => {
  const env = { AA_MAX_AGENT_TOOL_CALLS: "0" };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.strictEqual(result.maxToolCalls, null);
});

test("loadExecutionResourceCeilingEnv parses all resource ceiling values", () => {
  const env = {
    AA_MAX_AGENT_TOOL_CALLS: "50",
    AA_MAX_AGENT_MEMORY_MB: "256",
    AA_MAX_AGENT_ELAPSED_MS: "30000",
  };
  const result = loadExecutionResourceCeilingEnv(env);
  assert.deepStrictEqual(result, {
    maxToolCalls: 50,
    maxMemoryMb: 256,
    maxElapsedMs: 30000,
  });
});

test("RuntimeConfigEnvOptions interface structure", () => {
  const options: RuntimeConfigEnvOptions = {
    env: { MY_VAR: "value" },
    environment: "test",
    configRoot: "/config",
    cwd: "/workspace",
  };
  assert.strictEqual(options.environment, "test");
  assert.strictEqual(options.configRoot, "/config");
  assert.strictEqual(options.cwd, "/workspace");
});

test("ExecutionResourceCeilingEnvConfig interface structure", () => {
  const config: ExecutionResourceCeilingEnvConfig = {
    maxToolCalls: 100,
    maxMemoryMb: 512,
    maxElapsedMs: 60000,
  };
  assert.strictEqual(config.maxToolCalls, 100);
  assert.strictEqual(config.maxMemoryMb, 512);
  assert.strictEqual(config.maxElapsedMs, 60000);
});

test("readTrimmedEnv handles whitespace at boundaries", () => {
  const result = readTrimmedEnv({ MY_VAR: "  value  " }, "MY_VAR");
  assert.strictEqual(result, "value");
  assert.notStrictEqual(result, "  value  ");
});
