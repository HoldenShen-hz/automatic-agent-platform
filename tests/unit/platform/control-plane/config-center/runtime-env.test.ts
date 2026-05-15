import assert from "node:assert/strict";
import test from "node:test";

import {
  readTrimmedEnv,
  resolveConfigEnvironment,
  resolveConfigRoot,
} from "../../../../../src/platform/five-plane-control-plane/config-center/runtime-env.js";

test("readTrimmedEnv returns null for missing env var", () => {
  const result = readTrimmedEnv({}, "MISSING_VAR");
  assert.equal(result, null);
});

test("readTrimmedEnv returns null for empty string env var", () => {
  const result = readTrimmedEnv({ MY_VAR: "" }, "MY_VAR");
  assert.equal(result, null);
});

test("readTrimmedEnv returns null for whitespace-only env var", () => {
  const result = readTrimmedEnv({ MY_VAR: "   " }, "MY_VAR");
  assert.equal(result, null);
});

test("readTrimmedEnv returns trimmed value", () => {
  const result = readTrimmedEnv({ MY_VAR: "  value  " }, "MY_VAR");
  assert.equal(result, "value");
});

test("readTrimmedEnv returns value with internal whitespace", () => {
  const result = readTrimmedEnv({ MY_VAR: "my value" }, "MY_VAR");
  assert.equal(result, "my value");
});

test("resolveConfigEnvironment returns explicit environment when provided", () => {
  const result = resolveConfigEnvironment({ environment: "production" });
  assert.equal(result, "production");
});

test("resolveConfigEnvironment trims explicit environment", () => {
  const result = resolveConfigEnvironment({ environment: "  staging  " });
  assert.equal(result, "staging");
});

test("resolveConfigEnvironment returns AA_CONFIG_ENV when no explicit environment", () => {
  const result = resolveConfigEnvironment({
    env: { AA_CONFIG_ENV: "production" },
  });
  assert.equal(result, "production");
});

test("resolveConfigEnvironment returns prod when no env var set (fail-closed)", () => {
  const result = resolveConfigEnvironment({ env: {} });
  assert.equal(result, "prod");
});

test("resolveConfigEnvironment priority: explicit over env var", () => {
  const result = resolveConfigEnvironment({
    environment: "staging",
    env: { AA_CONFIG_ENV: "production" },
  });
  assert.equal(result, "staging");
});

test("resolveConfigRoot returns explicit config root when provided", () => {
  const result = resolveConfigRoot({ configRoot: "/my/config" });
  assert.equal(result, "/my/config");
});

test("resolveConfigRoot trims explicit config root", () => {
  const result = resolveConfigRoot({ configRoot: "  /my/config  " });
  assert.equal(result, "/my/config");
});

test("resolveConfigRoot returns AA_CONFIG_ROOT when no explicit config root", () => {
  const result = resolveConfigRoot({
    env: { AA_CONFIG_ROOT: "/var/config" },
  });
  assert.equal(result, "/var/config");
});
