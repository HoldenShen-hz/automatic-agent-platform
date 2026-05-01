import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for providers module
import type {
  ProviderCredentialStatus,
  ProviderCredentialRecordInput,
  ProviderCredentialManagedSecretContext,
  ProviderCredentialManagedSecretLease,
  ProviderCredentialManagedSecretAccess,
  ChatProviderType,
  ChatMessage,
  ChatTool,
  ChatCompletionResult,
  UnifiedChatProvider,
  UnifiedProviderConfig,
  ChatCompletionRequest,
} from "../../../../../src/platform/model-gateway/provider-registry/index.js";
import {
  deriveProviderApiKeyEnvName,
  deriveProviderApiKeysJsonEnvName,
  deriveProviderApiKeySecretRefEnvName,
  deriveProviderApiKeySecretRefsJsonEnvName,
  normalizeCredentialRecord,
  addMilliseconds,
  computeEffectiveStatus,
  isRetryableCredentialFailure,
  loadProviderCredentialRecordsFromEnv,
} from "../../../../../src/platform/model-gateway/provider-registry/index.js";

test("ProviderCredentialStatus type accepts valid values", () => {
  const statuses: ProviderCredentialStatus[] = ["active", "cooling_down", "disabled"];
  assert.equal(statuses.length, 3);
});

test("ProviderCredentialRecordInput structure is correct", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred_123",
    apiKey: "sk-xxx",
    secretRef: null,
    label: "production",
    status: "active",
    cooldownUntil: null,
    resetAt: null,
    lastFailureCode: null,
    retryAfterMs: null,
  };
  assert.equal(input.credentialId, "cred_123");
  assert.equal(input.status, "active");
  assert.equal(input.label, "production");
});

test("ProviderCredentialRecordInput with minimal fields", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred_minimal",
  };
  assert.equal(input.credentialId, "cred_minimal");
  assert.equal(input.status, undefined);
});

test("ProviderCredentialManagedSecretContext structure is correct", () => {
  const ctx: ProviderCredentialManagedSecretContext = {
    provider: "openai",
    credentialId: "cred_456",
    label: "prod-key",
  };
  assert.equal(ctx.provider, "openai");
  assert.equal(ctx.credentialId, "cred_456");
  assert.equal(ctx.label, "prod-key");
});

test("ProviderCredentialManagedSecretContext with null label", () => {
  const ctx: ProviderCredentialManagedSecretContext = {
    provider: "anthropic",
    credentialId: "cred_789",
    label: null,
  };
  assert.equal(ctx.label, null);
});

test("ProviderCredentialManagedSecretLease structure is correct", () => {
  const lease: ProviderCredentialManagedSecretLease = {
    apiKey: "sk-expired-xxx",
    leaseId: "lease_123",
    expiresAt: "2026-04-15T00:00:00.000Z",
    leaseSource: "provider_issued",
  };
  assert.equal(lease.apiKey, "sk-expired-xxx");
  assert.equal(lease.leaseId, "lease_123");
  assert.equal(lease.leaseSource, "provider_issued");
});

test("ProviderCredentialManagedSecretLease with wrapped_secret source", () => {
  const lease: ProviderCredentialManagedSecretLease = {
    apiKey: "sk-wrapped-xxx",
    leaseId: "lease_456",
    expiresAt: "2026-04-14T12:00:00.000Z",
    leaseSource: "wrapped_secret",
  };
  assert.equal(lease.leaseSource, "wrapped_secret");
});

test("ProviderCredentialManagedSecretAccess structure is correct", () => {
  const access: ProviderCredentialManagedSecretAccess = {
    secretResolver: (ref) => `resolved:${ref}`,
    secretLeaseIssuer: null,
  };
  assert.equal(typeof access.secretResolver, "function");
  assert.equal(access.secretLeaseIssuer, null);
});

test("ProviderCredentialManagedSecretAccess with lease issuer", async () => {
  const leaseIssuer = async (ref: string, ctx: ProviderCredentialManagedSecretContext) => {
    return {
      apiKey: `leased:${ref}`,
      leaseId: `lease_${ctx.credentialId}`,
      expiresAt: "2026-04-15T00:00:00.000Z",
      leaseSource: "provider_issued" as const,
    };
  };
  const access: ProviderCredentialManagedSecretAccess = {
    secretResolver: null,
    secretLeaseIssuer: leaseIssuer,
  };
  assert.equal(typeof access.secretLeaseIssuer, "function");
  const result = await leaseIssuer("secret_ref", { provider: "test", credentialId: "c1", label: null });
  assert.equal(result.leaseSource, "provider_issued");
});

test("deriveProviderApiKeyEnvName handles standard provider names", () => {
  assert.equal(deriveProviderApiKeyEnvName("openai"), "OPENAI_API_KEY");
  assert.equal(deriveProviderApiKeyEnvName("anthropic"), "ANTHROPIC_API_KEY");
  assert.equal(deriveProviderApiKeyEnvName("minimax"), "MINIMAX_API_KEY");
});

test("deriveProviderApiKeyEnvName handles provider with numbers", () => {
  assert.equal(deriveProviderApiKeyEnvName("provider123"), "PROVIDER123_API_KEY");
});

test("deriveProviderApiKeysJsonEnvName handles standard provider names", () => {
  assert.equal(deriveProviderApiKeysJsonEnvName("openai"), "OPENAI_API_KEYS_JSON");
  assert.equal(deriveProviderApiKeysJsonEnvName("anthropic"), "ANTHROPIC_API_KEYS_JSON");
  assert.equal(deriveProviderApiKeysJsonEnvName("minimax"), "MINIMAX_API_KEYS_JSON");
});

test("deriveProviderApiKeysJsonEnvName handles provider with numbers", () => {
  assert.equal(deriveProviderApiKeysJsonEnvName("test123"), "TEST123_API_KEYS_JSON");
});

test("deriveProviderApiKeySecretRefEnvName handles standard provider names", () => {
  assert.equal(deriveProviderApiKeySecretRefEnvName("openai"), "OPENAI_API_KEY_SECRET_REF");
  assert.equal(deriveProviderApiKeySecretRefEnvName("anthropic"), "ANTHROPIC_API_KEY_SECRET_REF");
  assert.equal(deriveProviderApiKeySecretRefEnvName("minimax"), "MINIMAX_API_KEY_SECRET_REF");
});

test("deriveProviderApiKeySecretRefEnvName handles provider with numbers", () => {
  assert.equal(deriveProviderApiKeySecretRefEnvName("test123"), "TEST123_API_KEY_SECRET_REF");
});

test("deriveProviderApiKeySecretRefsJsonEnvName handles standard provider names", () => {
  assert.equal(deriveProviderApiKeySecretRefsJsonEnvName("openai"), "OPENAI_API_KEY_SECRET_REFS_JSON");
  assert.equal(deriveProviderApiKeySecretRefsJsonEnvName("anthropic"), "ANTHROPIC_API_KEY_SECRET_REFS_JSON");
  assert.equal(deriveProviderApiKeySecretRefsJsonEnvName("minimax"), "MINIMAX_API_KEY_SECRET_REFS_JSON");
});

test("deriveProviderApiKeySecretRefsJsonEnvName handles provider with numbers", () => {
  assert.equal(deriveProviderApiKeySecretRefsJsonEnvName("test123"), "TEST123_API_KEY_SECRET_REFS_JSON");
});

test("normalizeCredentialRecord with minimal input", () => {
  const record = normalizeCredentialRecord({
    credentialId: "cred-1",
  });

  assert.equal(record.credentialId, "cred-1");
  assert.equal(record.apiKey, null);
  assert.equal(record.secretRef, null);
  assert.equal(record.label, null);
  assert.equal(record.status, "active");
  assert.equal(record.cooldownUntil, null);
  assert.equal(record.resetAt, null);
  assert.equal(record.lastFailureCode, null);
  assert.equal(record.retryAfterMs, null);
  assert.equal(record.activeLeaseId, null);
  assert.equal(record.activeLeaseExpiresAt, null);
});

test("normalizeCredentialRecord with all optional fields", () => {
  const record = normalizeCredentialRecord({
    credentialId: "cred-1",
    apiKey: "key-123",
    secretRef: "secret-ref-1",
    label: "test-label",
    status: "cooling_down",
    cooldownUntil: "2026-04-23T12:00:00.000Z",
    resetAt: "2026-04-23T12:00:00.000Z",
    lastFailureCode: "error_123",
    retryAfterMs: 5000,
  });

  assert.equal(record.credentialId, "cred-1");
  assert.equal(record.apiKey, "key-123");
  assert.equal(record.secretRef, "secret-ref-1");
  assert.equal(record.label, "test-label");
  assert.equal(record.status, "cooling_down");
  assert.equal(record.cooldownUntil, "2026-04-23T12:00:00.000Z");
  assert.equal(record.resetAt, "2026-04-23T12:00:00.000Z");
  assert.equal(record.lastFailureCode, "error_123");
  assert.equal(record.retryAfterMs, 5000);
});

test("addMilliseconds to valid ISO timestamp", () => {
  const result = addMilliseconds("2026-04-23T12:00:00.000Z", 1000);
  assert.ok(result.includes("2026-04-23T12:00:01"));
});

test("addMilliseconds with large millisecond value", () => {
  const result = addMilliseconds("2026-04-23T12:00:00.000Z", 3600000); // 1 hour
  assert.ok(result.includes("2026-04-23T13:00:00"));
});

test("addMilliseconds with zero", () => {
  const result = addMilliseconds("2026-04-23T12:00:00.000Z", 0);
  assert.ok(result.includes("2026-04-23T12:00:00"));
});

test("computeEffectiveStatus for active credential", () => {
  const record = normalizeCredentialRecord({
    credentialId: "cred-1",
    status: "active",
  });

  const effective = computeEffectiveStatus(record, "2026-04-23T12:00:00.000Z");
  assert.equal(effective, "active");
});

test("computeEffectiveStatus for cooling_down credential still in cooldown", () => {
  const record = normalizeCredentialRecord({
    credentialId: "cred-1",
    status: "cooling_down",
    cooldownUntil: "2026-04-23T14:00:00.000Z",
  });

  // If cooldownUntil is in the future, should return cooling_down
  const effective = computeEffectiveStatus(record, "2026-04-23T12:00:00.000Z");
  assert.equal(effective, "cooling_down");
});

test("computeEffectiveStatus for disabled credential", () => {
  const record = normalizeCredentialRecord({
    credentialId: "cred-1",
    status: "disabled",
  });

  const effective = computeEffectiveStatus(record, "2026-04-23T12:00:00.000Z");
  assert.equal(effective, "disabled");
});

test("isRetryableCredentialFailure returns false for 400 Bad Request", () => {
  assert.equal(isRetryableCredentialFailure(400, null, null), false);
});

test("isRetryableCredentialFailure returns false for 401 Unauthorized", () => {
  assert.equal(isRetryableCredentialFailure(401, null, null), false);
});

test("isRetryableCredentialFailure returns false for 403 Forbidden", () => {
  assert.equal(isRetryableCredentialFailure(403, null, null), false);
});

test("isRetryableCredentialFailure returns false for 404 Not Found", () => {
  assert.equal(isRetryableCredentialFailure(404, null, null), false);
});

test("isRetryableCredentialFailure returns true for 429 Rate Limit", () => {
  assert.equal(isRetryableCredentialFailure(429, null, null), true);
});

test("isRetryableCredentialFailure returns true for 500 Server Error", () => {
  assert.equal(isRetryableCredentialFailure(500, null, null), true);
});

test("isRetryableCredentialFailure returns true for 502 Bad Gateway", () => {
  assert.equal(isRetryableCredentialFailure(502, null, null), true);
});

test("isRetryableCredentialFailure returns true for 503 Service Unavailable", () => {
  assert.equal(isRetryableCredentialFailure(503, null, null), true);
});

test("loadProviderCredentialRecordsFromEnv with empty env returns empty array", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {});
  assert.equal(records.length, 0);
});

test("loadProviderCredentialRecordsFromEnv with single API key", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY: "key-123",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.credentialId, "test-1");
  assert.equal(records[0]!.apiKey, "key-123");
});

test("loadProviderCredentialRecordsFromEnv with whitespace-only API key returns empty", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY: "   ",
  });

  assert.equal(records.length, 0);
});

test("loadProviderCredentialRecordsFromEnv JSON with valid entries", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEYS_JSON: JSON.stringify([
      { credentialId: "cred-1", apiKey: "key-1" },
      { credentialId: "cred-2", apiKey: "key-2" },
    ]),
  });

  assert.equal(records.length, 2);
  assert.equal(records[0]!.credentialId, "cred-1");
  assert.equal(records[0]!.apiKey, "key-1");
});

test("loadProviderCredentialRecordsFromEnv JSON with array of strings", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEYS_JSON: JSON.stringify(["key-1", "key-2", "key-3"]),
  });

  assert.equal(records.length, 3);
  assert.equal(records[0]!.credentialId, "test-1");
  assert.equal(records[0]!.apiKey, "key-1");
});

test("loadProviderCredentialRecordsFromEnv JSON with id field maps to credentialId", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEYS_JSON: JSON.stringify([
      { id: "my-cred-1", apiKey: "key-1" },
    ]),
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.credentialId, "my-cred-1");
  assert.equal(records[0]!.apiKey, "key-1");
});

test("loadProviderCredentialRecordsFromEnv JSON with null apiKey throws", () => {
  assert.throws(
    () =>
      loadProviderCredentialRecordsFromEnv("test", {
        TEST_API_KEYS_JSON: JSON.stringify([{ credentialId: "cred-1", apiKey: null }]),
      }),
    /provider.credentials_invalid/,
  );
});

test("loadProviderCredentialRecordsFromEnv secret refs with secretResolver", () => {
  const records = loadProviderCredentialRecordsFromEnv(
    "test",
    {
      TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify([
        { credentialId: "secret-cred-1", secretRef: "ref-1" },
      ]),
    },
    {
      secretResolver: (ref: string) => `resolved-${ref}`,
    },
  );

  assert.equal(records.length, 1);
  assert.equal(records[0]!.secretRef, "ref-1");
  assert.equal(records[0]!.credentialId, "secret-cred-1");
});

test("ChatTool minimal definition", () => {
  const tool: ChatTool = {
    type: "function",
    name: "test_tool",
    parameters: {},
  };
  assert.equal(tool.type, "function");
  assert.equal(tool.name, "test_tool");
});

test("ChatTool with description and schema", () => {
  const tool: ChatTool = {
    type: "function",
    name: "get_weather",
    description: "Get the weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" },
      },
      required: ["location"],
    },
  };
  assert.equal(tool.name, "get_weather");
  assert.equal(tool.description, "Get the weather for a location");
});

test("ChatMessage with user role", () => {
  const message: ChatMessage = {
    role: "user",
    content: "Hello, how are you?",
  };
  assert.equal(message.role, "user");
  assert.equal(message.content, "Hello, how are you?");
});

test("ChatMessage with system role", () => {
  const message: ChatMessage = {
    role: "system",
    content: "You are a helpful assistant.",
  };
  assert.equal(message.role, "system");
});

test("ChatCompletionResult minimal structure", () => {
  const result: ChatCompletionResult = {
    id: "chatcmpl-123",
    content: "Hello!",
    finishReason: "stop",
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
    model: "gpt-4",
    provider: "openai",
  };
  assert.equal(result.id, "chatcmpl-123");
  assert.equal(result.content, "Hello!");
});

test("ChatProviderType accepts all valid provider names", () => {
  const types: ChatProviderType[] = ["anthropic", "openai", "minimax"];
  assert.equal(types.length, 3);
  assert.ok(types.includes("anthropic"));
  assert.ok(types.includes("openai"));
  assert.ok(types.includes("minimax"));
});
