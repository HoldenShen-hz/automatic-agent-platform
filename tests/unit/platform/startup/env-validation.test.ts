import { z } from "zod";

import test from "node:test";
import assert from "node:assert/strict";

import {
  StartupEnvSchema,
  DbPathSchema,
  ConfigEnvSchema,
  ApiPortSchema,
  validateStartupEnv,
} from "../../../../src/platform/control-plane/config-center/startup-env-schema.js";

test("[SYS-SEC-4.1] startup env schema validates DB path is non-empty", () => {
  const result = DbPathSchema.safeParse("");
  assert.equal(result.success, false, "Empty DB path should be rejected");
});

test("[SYS-SEC-4.1] startup env schema validates DB path is provided", () => {
  const result = DbPathSchema.safeParse(undefined);
  assert.equal(result.success, false, "Missing DB path should be rejected");
});

test("[SYS-SEC-4.1] startup env schema validates config environment", () => {
  const valid = ConfigEnvSchema.safeParse("prod");
  assert.equal(valid.success, true, "Valid env 'prod' should be accepted");

  const invalid = ConfigEnvSchema.safeParse("unknown");
  assert.equal(invalid.success, false, "Invalid env should be rejected");
});

test("[SYS-SEC-4.1] startup env schema validates API port range", () => {
  const validLow = ApiPortSchema.safeParse("8080");
  assert.equal(validLow.success, true, "Valid port should be accepted");

  const validHigh = ApiPortSchema.safeParse("65535");
  assert.equal(validHigh.success, true, "Max port should be accepted");

  const invalidZero = ApiPortSchema.safeParse("0");
  assert.equal(invalidZero.success, false, "Port 0 should be rejected");

  const invalidNegative = ApiPortSchema.safeParse("-1");
  assert.equal(invalidNegative.success, false, "Negative port should be rejected");

  const invalidTooHigh = ApiPortSchema.safeParse("65536");
  assert.equal(invalidTooHigh.success, false, "Port > 65535 should be rejected");
});

test("[SYS-SEC-4.1] startup env schema accepts valid complete config", () => {
  const validConfig = {
    AA_DB_PATH: "/tmp/test.db",
    AA_CONFIG_ENV: "test" as const,
    AA_API_PORT: "3000",
    AA_STORAGE_DRIVER: "sqlite" as const,
  };

  const result = validateStartupEnv(validConfig);
  assert.equal(result.success, true, `Valid config should be accepted: ${JSON.stringify(result.errors)}`);
});

test("[SYS-SEC-4.1] startup env schema requires AA_DB_PATH", () => {
  const invalidConfig = {
    AA_CONFIG_ENV: "prod",
  };

  const result = StartupEnvSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, "Missing AA_DB_PATH should be rejected");
});

test("[SYS-SEC-4.1] AA_PLUGIN_SANDBOX_ROOT should be in startup env schema", () => {
  const schemaShape = StartupEnvSchema.innerType().shape;
  const hasSandboxRoot = "AA_PLUGIN_SANDBOX_ROOT" in schemaShape;
  assert.equal(hasSandboxRoot, true, "AA_PLUGIN_SANDBOX_ROOT should be in schema");
});

test("[SYS-SEC-4.1] startup env schema requires postgres DSN when postgres storage is selected", () => {
  const result = validateStartupEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_STORAGE_DRIVER: "postgres",
  });
  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.key === "AA_STORAGE_POSTGRES_DSN"));
});
