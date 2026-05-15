import assert from "node:assert/strict";
import test from "node:test";

import {
  maskSecretValue,
  validateSecretRef,
  deriveSecretScope,
  deriveSecretEnvName,
  EnvSecretProvider,
} from "../../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";

test("maskSecretValue masks long values correctly", () => {
  const result = maskSecretValue("my-secret-key-12345");
  // Should show first 8 chars masked, then last 4 visible
  assert.ok(result.includes("****"));
  assert.ok(result.endsWith("2345"));
});

test("maskSecretValue masks short values with asterisks", () => {
  const result = maskSecretValue("ab");
  // Short values get all asterisks (min 4)
  assert.equal(result, "****");
});

test("maskSecretValue handles exactly 4 char values", () => {
  const result = maskSecretValue("abcd");
  assert.equal(result, "****");
});

test("maskSecretValue trims whitespace before processing", () => {
  const result = maskSecretValue("  my-secret  ");
  assert.ok(result.includes("*"));
});

test("validateSecretRef accepts valid secret references", () => {
  const result = validateSecretRef("secret://my-service/api-key");
  assert.equal(result, "secret://my-service/api-key");
});

test("validateSecretRef accepts uppercase refs", () => {
  const result = validateSecretRef("secret://My-Service/API-Key");
  assert.equal(result, "secret://My-Service/API-Key");
});

test("validateSecretRef rejects invalid format", () => {
  assert.throws(
    () => validateSecretRef("invalid"),
    (error: any) => error.code.startsWith("secret.invalid_ref")
  );
});

test("validateSecretRef rejects missing scheme", () => {
  assert.throws(
    () => validateSecretRef("my-service/api-key"),
    (error: any) => error.code.startsWith("secret.invalid_ref")
  );
});

test("validateSecretRef rejects empty string", () => {
  assert.throws(
    () => validateSecretRef(""),
    (error: any) => error.code.startsWith("secret.invalid_ref")
  );
});

test("validateSecretRef trims whitespace", () => {
  const result = validateSecretRef("  secret://test  ");
  assert.equal(result, "secret://test");
});

test("deriveSecretScope extracts scope from ref", () => {
  const result = deriveSecretScope("secret://my-service/api-key");
  assert.equal(result, "my-service/api-key");
});

test("deriveSecretScope extracts nested scope", () => {
  const result = deriveSecretScope("secret://my-service/sub/path/key");
  assert.equal(result, "my-service/sub/path/key");
});

test("deriveSecretEnvName converts ref to env var name", () => {
  const result = deriveSecretEnvName("secret://my-service/api-key");
  assert.equal(result, "AA_SECRET_MY_SERVICE_API_KEY");
});

test("deriveSecretEnvName handles underscores in scope", () => {
  const result = deriveSecretEnvName("secret://my_service/api_key");
  assert.equal(result, "AA_SECRET_MY_SERVICE_API_KEY");
});

test("EnvSecretProvider.describeSecret returns metadata for existing secret", async () => {
  const provider = new EnvSecretProvider({ env: { "AA_SECRET_TEST_KEY": "secret-value" } });
  const result = await provider.describeSecret("secret://test/key");

  assert.equal(result.secretRef, "secret://test/key");
  assert.equal(result.envName, "AA_SECRET_TEST_KEY");
  assert.equal(result.scope, "test/key");
  assert.equal(result.source, "environment");
  assert.equal(result.resolved, true);
  assert.ok(result.maskedValue!.includes("*"));
});

test("EnvSecretProvider.describeSecret returns unresolved for missing secret", async () => {
  const provider = new EnvSecretProvider({ env: {} });
  const result = await provider.describeSecret("secret://test/key");

  assert.equal(result.resolved, false);
  assert.equal(result.maskedValue, null);
});

test("EnvSecretProvider.requireSecret returns value for existing secret", async () => {
  const provider = new EnvSecretProvider({ env: { "AA_SECRET_TEST_KEY": "secret-value" } });
  const result = await provider.requireSecret("secret://test/key");

  assert.equal(result.value, "secret-value");
  assert.equal(result.resolved, true);
});

test("EnvSecretProvider.requireSecret throws for missing secret", async () => {
  const provider = new EnvSecretProvider({ env: {} });

  await assert.rejects(
    async () => provider.requireSecret("secret://test/key"),
    (error: any) => error.code.startsWith("secret.missing_value")
  );
});

test("EnvSecretProvider.requireSecretSync returns value synchronously", () => {
  const provider = new EnvSecretProvider({ env: { "AA_SECRET_TEST_KEY": "sync-secret" } });
  const result = provider.requireSecretSync("secret://test/key");

  assert.equal(result, "sync-secret");
});

test("EnvSecretProvider.requireSecretSync throws for missing secret", () => {
  const provider = new EnvSecretProvider({ env: {} });

  assert.throws(
    () => provider.requireSecretSync("secret://test/key"),
    (error: any) => error.code.startsWith("secret.missing_value")
  );
});

test("EnvSecretProvider.providerKind is environment", () => {
  const provider = new EnvSecretProvider();
  assert.equal(provider.providerKind, "environment");
});
