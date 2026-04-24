import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvSecretProvider,
  maskSecretValue,
  validateSecretRef,
  deriveSecretScope,
  deriveSecretEnvName,
} from "../../../../../src/platform/control-plane/iam/env-secret-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    AA_SECRET_MY_SERVICE_API_KEY: undefined,
    AA_SECRET_MY_APP_DATABASE_PASSWORD: undefined,
    AA_SECRET_SIMPLE: undefined,
    ...overrides,
  };
}

function createProvider(mockEnv: NodeJS.ProcessEnv = createMockEnv()): EnvSecretProvider {
  return new EnvSecretProvider({ env: mockEnv });
}

// ---------------------------------------------------------------------------
// maskSecretValue utility
// ---------------------------------------------------------------------------

test("maskSecretValue masks short values with asterisks", () => {
  const result = maskSecretValue("abc");
  assert.equal(result, "****");
});

test("maskSecretValue shows first few and last 4 chars of longer values", () => {
  const result = maskSecretValue("my-secret-value-1234");
  assert.ok(result.endsWith("1234"));
  assert.ok(result.startsWith("*"));
});

test("maskSecretValue handles exact 4-character values", () => {
  const result = maskSecretValue("test");
  assert.equal(result, "****");
});

test("maskSecretValue trims whitespace before masking", () => {
  const result = maskSecretValue("  secret  ");
  assert.equal(result, "******");
});

test("maskSecretValue masks empty string as 4 asterisks", () => {
  const result = maskSecretValue("");
  assert.equal(result, "****");
});

test("maskSecretValue handles single character", () => {
  const result = maskSecretValue("a");
  assert.equal(result, "****");
});

test("maskSecretValue shows partial for long values", () => {
  const result = maskSecretValue("very-long-secret-value-here");
  assert.ok(result.includes("****"));
  assert.ok(result.endsWith("here"));
});

// ---------------------------------------------------------------------------
// validateSecretRef
// ---------------------------------------------------------------------------

test("validateSecretRef accepts valid simple secret ref", () => {
  const result = validateSecretRef("secret://mykey");
  assert.equal(result, "secret://mykey");
});

test("validateSecretRef accepts valid nested secret ref", () => {
  const result = validateSecretRef("secret://myapp/production/api-key");
  assert.equal(result, "secret://myapp/production/api-key");
});

test("validateSecretRef accepts secret ref with dots and underscores", () => {
  const result = validateSecretRef("secret://my_service.v2/api_key");
  assert.equal(result, "secret://my_service.v2/api_key");
});

test("validateSecretRef trims whitespace", () => {
  const result = validateSecretRef("  secret://mykey  ");
  assert.equal(result, "secret://mykey");
});

test("validateSecretRef throws for invalid format without secret://", () => {
  assert.throws(
    () => validateSecretRef("mykey"),
    (e: any) => e.message.includes("secret.invalid_ref"),
  );
});

test("validateSecretRef throws for empty string", () => {
  assert.throws(
    () => validateSecretRef(""),
    (e: any) => e.message.includes("secret.invalid_ref"),
  );
});

test("validateSecretRef throws for whitespace-only string", () => {
  assert.throws(
    () => validateSecretRef("   "),
    (e: any) => e.message.includes("secret.invalid_ref"),
  );
});

test("validateSecretRef throws for ref with invalid characters", () => {
  assert.throws(
    () => validateSecretRef("secret://my key"),
    (e: any) => e.message.includes("secret.invalid_ref"),
  );
});

// ---------------------------------------------------------------------------
// deriveSecretScope
// ---------------------------------------------------------------------------

test("deriveSecretScope extracts scope from simple secret ref", () => {
  const result = deriveSecretScope("secret://mykey");
  assert.equal(result, "mykey");
});

test("deriveSecretScope extracts first path segment as scope", () => {
  const result = deriveSecretScope("secret://myapp/api-key");
  assert.equal(result, "myapp");
});

test("deriveSecretScope extracts first path segment from nested ref", () => {
  const result = deriveSecretScope("secret://myapp/production/database");
  assert.equal(result, "myapp");
});

test("deriveSecretScope handles refs with dots and underscores", () => {
  const result = deriveSecretScope("secret://my_service.v2/api_key");
  assert.equal(result, "my_service.v2");
});

// ---------------------------------------------------------------------------
// deriveSecretEnvName
// ---------------------------------------------------------------------------

test("deriveSecretEnvName converts simple secret ref to env var name", () => {
  const result = deriveSecretEnvName("secret://mykey");
  assert.equal(result, "AA_SECRET_MYKEY");
});

test("deriveSecretEnvName converts nested secret ref to env var name", () => {
  const result = deriveSecretEnvName("secret://my-service/api-key");
  assert.equal(result, "AA_SECRET_MY_SERVICE_API_KEY");
});

test("deriveSecretEnvName handles refs with multiple path segments", () => {
  const result = deriveSecretEnvName("secret://myapp/production/database/password");
  assert.equal(result, "AA_SECRET_MYAPP_PRODUCTION_DATABASE_PASSWORD");
});

test("deriveSecretEnvName removes leading/trailing underscores", () => {
  const result = deriveSecretEnvName("secret://_test_");
  assert.equal(result, "AA_SECRET_TEST");
});

test("deriveSecretEnvName uppercases the scope", () => {
  const result = deriveSecretEnvName("secret://MyService/API_Key");
  assert.equal(result, "AA_SECRET_MYSERVICE_API_KEY");
});

// ---------------------------------------------------------------------------
// EnvSecretProvider construction
// ---------------------------------------------------------------------------

test("EnvSecretProvider has providerKind of environment", () => {
  const provider = createProvider();
  assert.equal(provider.providerKind, "environment");
});

// ---------------------------------------------------------------------------
// EnvSecretProvider.describeSecret
// ---------------------------------------------------------------------------

test("describeSecret returns resolved false when secret not in env", async () => {
  const provider = createProvider(createMockEnv({}));
  const result = await provider.describeSecret("secret://mykey");
  assert.equal(result.resolved, false);
  assert.equal(result.secretRef, "secret://mykey");
  assert.equal(result.scope, "mykey");
  assert.equal(result.envName, "AA_SECRET_MYKEY");
  assert.equal(result.source, "environment");
  assert.equal(result.maskedValue, null);
});

test("describeSecret returns resolved true when secret exists in env", async () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_MY_SERVICE_API_KEY: "secret-value-123" }));
  const result = await provider.describeSecret("secret://my-service/api-key");
  assert.equal(result.resolved, true);
  assert.equal(result.secretRef, "secret://my-service/api-key");
  assert.equal(result.scope, "my-service");
  assert.equal(result.envName, "AA_SECRET_MY_SERVICE_API_KEY");
  assert.equal(result.source, "environment");
  assert.notEqual(result.maskedValue, null);
  assert.ok(result.maskedValue!.endsWith("3123"));
});

test("describeSecret trims whitespace from env value", async () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_SIMPLE: "  trimmed value  " }));
  const result = await provider.describeSecret("secret://simple");
  assert.equal(result.resolved, true);
});

test("describeSecret treats empty string as unresolved", async () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_SIMPLE: "" }));
  const result = await provider.describeSecret("secret://simple");
  assert.equal(result.resolved, false);
});

// ---------------------------------------------------------------------------
// EnvSecretProvider.requireSecret
// ---------------------------------------------------------------------------

test("requireSecret returns value when secret exists", async () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_MY_SERVICE_API_KEY: "my-secret-value" }));
  const result = await provider.requireSecret("secret://my-service/api-key");
  assert.equal(result.resolved, true);
  assert.equal(result.value, "my-secret-value");
  assert.equal(result.source, "environment");
});

test("requireSecret throws ValidationError when secret not found", async () => {
  const provider = createProvider(createMockEnv({}));
  await assert.rejects(
    async () => provider.requireSecret("secret://mykey"),
    (e: any) => e.message.includes("secret.missing_value"),
  );
});

test("requireSecret throws for empty env value", async () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_SIMPLE: "" }));
  await assert.rejects(
    async () => provider.requireSecret("secret://simple"),
    (e: any) => e.message.includes("secret.missing_value"),
  );
});

// ---------------------------------------------------------------------------
// EnvSecretProvider.requireSecretSync
// ---------------------------------------------------------------------------

test("requireSecretSync returns value synchronously", () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_MY_SERVICE_API_KEY: "sync-secret" }));
  const result = provider.requireSecretSync("secret://my-service/api-key");
  assert.equal(result, "sync-secret");
});

test("requireSecretSync throws for missing secret", () => {
  const provider = createProvider(createMockEnv({}));
  assert.throws(
    () => provider.requireSecretSync("secret://mykey"),
    (e: any) => e.message.includes("secret.missing_value"),
  );
});

test("requireSecretSync throws for empty env value", () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_SIMPLE: "" }));
  assert.throws(
    () => provider.requireSecretSync("secret://simple"),
    (e: any) => e.message.includes("secret.missing_value"),
  );
});

// ---------------------------------------------------------------------------
// EnvSecretProvider.refreshSecret
// ---------------------------------------------------------------------------

test("refreshSecret returns same result as describeSecret", async () => {
  const provider = createProvider(createMockEnv({ AA_SECRET_MY_APP_DATABASE_PASSWORD: "db-password" }));
  const refreshResult = await provider.refreshSecret("secret://my-app/database-password");
  const describeResult = await provider.describeSecret("secret://my-app/database-password");
  assert.deepEqual(refreshResult, describeResult);
});
