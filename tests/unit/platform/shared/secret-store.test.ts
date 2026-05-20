import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvSecretProvider,
  maskSecretValue,
  validateSecretRef,
  deriveSecretScope,
  deriveSecretEnvName,
} from "../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";

test("EnvSecretProvider constructor uses process.env by default", () => {
  const provider = new EnvSecretProvider();
  assert.ok(provider !== null);
});

test("EnvSecretProvider constructor accepts custom env", () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_TEST_KEY: "my-secret-value",
  };
  const provider = new EnvSecretProvider({ env: customEnv });
  assert.ok(provider !== null);
});

test("EnvSecretProvider describeSecret returns metadata for valid secret ref", async () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_TEST_SERVICE_API_KEY: "secret123",
  };
  const provider = new EnvSecretProvider({ env: customEnv });

  const metadata = await provider.describeSecret("secret://test-service/api-key");

  assert.equal(metadata.secretRef, "secret://test-service/api-key");
  assert.equal(metadata.envName, "AA_SECRET_TEST_SERVICE_API_KEY");
  assert.equal(metadata.scope, "test-service/api-key");
  assert.equal(metadata.source, "environment");
  assert.equal(metadata.resolved, true);
  assert.equal(metadata.maskedValue, "*******23");
});

test("EnvSecretProvider describeSecret returns unresolved for missing secret", async () => {
  const customEnv: NodeJS.ProcessEnv = {};
  const provider = new EnvSecretProvider({ env: customEnv });

  const metadata = await provider.describeSecret("secret://missing/service-key");

  assert.equal(metadata.resolved, false);
  assert.equal(metadata.maskedValue, null);
});

test("EnvSecretProvider requireSecret returns value for existing secret", async () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_MY_SERVICE_API_KEY: "my-secret-value",
  };
  const provider = new EnvSecretProvider({ env: customEnv });

  const result = await provider.requireSecret("secret://my-service/api-key");

  assert.equal(result.value, "my-secret-value");
  assert.equal(result.resolved, true);
  assert.ok(result.maskedValue !== null);
});

test("EnvSecretProvider requireSecret throws for missing secret", () => {
  const customEnv: NodeJS.ProcessEnv = {};
  const provider = new EnvSecretProvider({ env: customEnv });

  let caughtError: any = null;
  try {
    // Sync call should throw
    provider.requireSecretSync("secret://missing/secret");
  } catch (e) {
    caughtError = e;
  }

  assert.ok(caughtError !== null);
  assert.ok(caughtError.code.startsWith("secret.missing_value"));
});

test("EnvSecretProvider requireSecretSync returns value synchronously", () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_SYNC_TEST_VALUE: "sync-secret",
  };
  const provider = new EnvSecretProvider({ env: customEnv });

  const value = provider.requireSecretSync("secret://sync-test/value");

  assert.equal(value, "sync-secret");
});

test("EnvSecretProvider requireSecretSync throws for missing secret", () => {
  const customEnv: NodeJS.ProcessEnv = {};
  const provider = new EnvSecretProvider({ env: customEnv });

  let caughtError: any = null;
  try {
    provider.requireSecretSync("secret://missing/sync-secret");
  } catch (e) {
    caughtError = e;
  }

  assert.ok(caughtError !== null);
  assert.ok(caughtError.code.startsWith("secret.missing_value"));
});

test("EnvSecretProvider refreshSecret returns fresh metadata", async () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_REFRESH_TEST_KEY: "initial-value",
  };
  const provider = new EnvSecretProvider({ env: customEnv });

  const metadata1 = await provider.refreshSecret("secret://refresh-test/key");
  assert.equal(metadata1.resolved, true);

  // Update the env value
  customEnv.AA_SECRET_REFRESH_TEST_KEY = "updated-value";

  const metadata2 = await provider.refreshSecret("secret://refresh-test/key");
  assert.equal(metadata2.resolved, true);
});

test("maskSecretValue masks short values completely", () => {
  const result = maskSecretValue("abc");
  assert.equal(result, "****");
});

test("maskSecretValue masks short values at minimum 4 chars", () => {
  const result = maskSecretValue("ab");
  assert.equal(result, "****");
});

test("maskSecretValue shows prefix and suffix for longer values", () => {
  const result = maskSecretValue("my-secret-value-12345");
  assert.ok(result.startsWith("****"));
  assert.ok(result.endsWith("2345"));
  assert.ok(result.includes("****"));
});

test("maskSecretValue handles whitespace in value", () => {
  const result = maskSecretValue("  secret value  ");
  // Should be trimmed and masked
  assert.ok(result.includes("*"));
});

test("validateSecretRef accepts valid secret reference format", () => {
  const validRefs = [
    "secret://my-service/api-key",
    "secret://test/path",
    "secret://a/b/c/d",
  ];

  for (const ref of validRefs) {
    const result = validateSecretRef(ref);
    assert.equal(result, ref);
  }
});

test("validateSecretRef throws for invalid secret reference format", () => {
  const invalidRefs = [
    "invalid",
    "secret://",
    "http://example.com/secret",
    "",
  ];

  for (const ref of invalidRefs) {
    let caughtError: any = null;
    try {
      validateSecretRef(ref);
    } catch (e) {
      caughtError = e;
    }
    assert.ok(caughtError !== null, `Expected error for ref: ${ref}`);
    assert.ok(caughtError.code.startsWith("secret.invalid_ref"));
  }
});

test("validateSecretRef normalizes whitespace", () => {
  const result = validateSecretRef("  secret://test/key  ");
  assert.equal(result, "secret://test/key");
});

test("deriveSecretScope extracts scope from secret reference", () => {
  const testCases = [
    { ref: "secret://my-service/api-key", expected: "my-service/api-key" },
    { ref: "secret://a/b/c/d", expected: "a/b/c/d" },
    { ref: "secret://simple/key", expected: "simple/key" },
  ];

  for (const { ref, expected } of testCases) {
    const scope = deriveSecretScope(ref);
    assert.equal(scope, expected);
  }
});

test("deriveSecretEnvName transforms secret ref to env var name", () => {
  const testCases = [
    { ref: "secret://my-service/api-key", expected: "AA_SECRET_MY_SERVICE_API_KEY" },
    { ref: "secret://test/path", expected: "AA_SECRET_TEST_PATH" },
    { ref: "secret://simple/key", expected: "AA_SECRET_SIMPLE_KEY" },
  ];

  for (const { ref, expected } of testCases) {
    const envName = deriveSecretEnvName(ref);
    assert.equal(envName, expected);
  }
});

test("deriveSecretEnvName handles underscores in scope", () => {
  const envName = deriveSecretEnvName("secret://my_service/api_key");
  assert.equal(envName, "AA_SECRET_MY_SERVICE_API_KEY");
});

test("EnvSecretProvider providerKind is environment", () => {
  const provider = new EnvSecretProvider();
  assert.equal(provider.providerKind, "environment");
});

test("EnvSecretProvider handles empty string env value as unresolved", async () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_EMPTY_VALUE: "   ",
  };
  const provider = new EnvSecretProvider({ env: customEnv });

  const metadata = await provider.describeSecret("secret://empty/value");

  assert.equal(metadata.resolved, false);
  assert.equal(metadata.maskedValue, null);
});

test("EnvSecretProvider handles whitespace-only env value as unresolved", async () => {
  const customEnv: NodeJS.ProcessEnv = {
    AA_SECRET_WHITESPACE_TEST: "  \t\n  ",
  };
  const provider = new EnvSecretProvider({ env: customEnv });

  const metadata = await provider.describeSecret("secret://whitespace/test");

  assert.equal(metadata.resolved, false);
});
