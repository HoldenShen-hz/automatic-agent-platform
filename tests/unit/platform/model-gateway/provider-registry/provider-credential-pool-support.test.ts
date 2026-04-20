import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveProviderApiKeyEnvName,
  deriveProviderApiKeysJsonEnvName,
  deriveProviderApiKeySecretRefEnvName,
  deriveProviderApiKeySecretRefsJsonEnvName,
  normalizeCredentialRecord,
  addMilliseconds,
  computeEffectiveStatus,
  isRetryableCredentialFailure,
  throwProviderCredentialValidation,
  throwProviderCredentialRuntimeError,
  requireResolvedSecretValue,
  loadProviderCredentialRecordsFromEnv,
  type ProviderCredentialRecordInput,
} from "../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool-support.js";

test("deriveProviderApiKeyEnvName converts simple provider", () => {
  assert.equal(deriveProviderApiKeyEnvName("anthropic"), "ANTHROPIC_API_KEY");
});

test("deriveProviderApiKeyEnvName handles camelCase", () => {
  assert.equal(deriveProviderApiKeyEnvName("openAI"), "OPEN_AI_API_KEY");
});

test("deriveProviderApiKeyEnvName handles mixed case", () => {
  assert.equal(deriveProviderApiKeyEnvName("ClaudeProvider"), "CLAUDE_PROVIDER_API_KEY");
});

test("deriveProviderApiKeyEnvName handles lowercase", () => {
  assert.equal(deriveProviderApiKeyEnvName("claude"), "CLAUDE_API_KEY");
});

test("deriveProviderApiKeysJsonEnvName adds JSON suffix", () => {
  assert.equal(deriveProviderApiKeysJsonEnvName("anthropic"), "ANTHROPIC_API_KEYS_JSON");
});

test("deriveProviderApiKeySecretRefEnvName adds secret ref suffix", () => {
  assert.equal(deriveProviderApiKeySecretRefEnvName("anthropic"), "ANTHROPIC_API_KEY_SECRET_REF");
});

test("deriveProviderApiKeySecretRefsJsonEnvName adds full suffix", () => {
  assert.equal(deriveProviderApiKeySecretRefsJsonEnvName("anthropic"), "ANTHROPIC_API_KEY_SECRET_REFS_JSON");
});

test("normalizeCredentialRecord normalizes valid input", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    apiKey: "  sk-key  ",
    label: "test",
    status: "active",
  };
  const result = normalizeCredentialRecord(input);
  assert.equal(result.credentialId, "cred-1");
  assert.equal(result.apiKey, "sk-key");
  assert.equal(result.label, "test");
  assert.equal(result.status, "active");
});

test("normalizeCredentialRecord handles null apiKey", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    apiKey: null,
  };
  const result = normalizeCredentialRecord(input);
  assert.equal(result.apiKey, null);
});

test("normalizeCredentialRecord handles whitespace-only apiKey", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    apiKey: "   ",
  };
  const result = normalizeCredentialRecord(input);
  assert.equal(result.apiKey, null);
});

test("normalizeCredentialRecord handles undefined apiKey", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
  };
  const result = normalizeCredentialRecord(input);
  assert.equal(result.apiKey, null);
});

test("normalizeCredentialRecord defaults status to active", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
  };
  const result = normalizeCredentialRecord(input);
  assert.equal(result.status, "active");
});

test("normalizeCredentialRecord sets all nullable fields", () => {
  const input: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
  };
  const result = normalizeCredentialRecord(input);
  assert.equal(result.cooldownUntil, null);
  assert.equal(result.resetAt, null);
  assert.equal(result.lastFailureCode, null);
  assert.equal(result.retryAfterMs, null);
  assert.equal(result.activeLeaseId, null);
  assert.equal(result.activeLeaseExpiresAt, null);
  assert.equal(result.activeLeaseSource, null);
});

test("addMilliseconds adds positive milliseconds", () => {
  const result = addMilliseconds("2024-01-01T00:00:00.000Z", 1000);
  assert.ok(result.includes("2024-01-01T00:00:01"));
});

test("addMilliseconds adds large milliseconds", () => {
  const result = addMilliseconds("2024-01-01T00:00:00.000Z", 86400000);
  assert.ok(result.includes("2024-01-02"));
});

test("addMilliseconds handles negative delta", () => {
  const result = addMilliseconds("2024-01-02T00:00:00.000Z", -86400000);
  assert.ok(result.includes("2024-01-01"));
});

test("computeEffectiveStatus returns disabled when status is disabled", () => {
  const record: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    status: "disabled",
  };
  const result = computeEffectiveStatus(normalizeCredentialRecord(record), "2024-01-01T00:00:00.000Z");
  assert.equal(result, "disabled");
});

test("computeEffectiveStatus returns cooling_down when cooldownUntil is in future", () => {
  const record: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    status: "cooling_down",
    cooldownUntil: "2024-01-01T01:00:00.000Z",
  };
  const result = computeEffectiveStatus(normalizeCredentialRecord(record), "2024-01-01T00:00:00.000Z");
  assert.equal(result, "cooling_down");
});

test("computeEffectiveStatus returns active when cooldown has expired", () => {
  const record: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    status: "cooling_down",
    cooldownUntil: "2024-01-01T00:00:00.000Z",
  };
  const result = computeEffectiveStatus(normalizeCredentialRecord(record), "2024-01-01T00:00:01.000Z");
  assert.equal(result, "active");
});

test("computeEffectiveStatus returns active for active status", () => {
  const record: ProviderCredentialRecordInput = {
    credentialId: "cred-1",
    status: "active",
  };
  const result = computeEffectiveStatus(normalizeCredentialRecord(record), "2024-01-01T00:00:00.000Z");
  assert.equal(result, "active");
});

test("isRetryableCredentialFailure returns true for 402", () => {
  assert.equal(isRetryableCredentialFailure(402, null, null), true);
});

test("isRetryableCredentialFailure returns true for 429", () => {
  assert.equal(isRetryableCredentialFailure(429, null, null), true);
});

test("isRetryableCredentialFailure returns true for 500", () => {
  assert.equal(isRetryableCredentialFailure(500, null, null), true);
});

test("isRetryableCredentialFailure returns true for 502", () => {
  assert.equal(isRetryableCredentialFailure(502, null, null), true);
});

test("isRetryableCredentialFailure returns true for 503", () => {
  assert.equal(isRetryableCredentialFailure(503, null, null), true);
});

test("isRetryableCredentialFailure returns true for 504", () => {
  assert.equal(isRetryableCredentialFailure(504, null, null), true);
});

test("isRetryableCredentialFailure returns false for 400", () => {
  assert.equal(isRetryableCredentialFailure(400, null, null), false);
});

test("isRetryableCredentialFailure returns false for 401", () => {
  assert.equal(isRetryableCredentialFailure(401, null, null), false);
});

test("isRetryableCredentialFailure returns true when retryAfterMs is set", () => {
  assert.equal(isRetryableCredentialFailure(400, 5000, null), true);
});

test("isRetryableCredentialFailure returns true when resetAt is set", () => {
  assert.equal(isRetryableCredentialFailure(400, null, "2024-01-01T00:00:00.000Z"), true);
});

test("isRetryableCredentialFailure returns false for 200", () => {
  assert.equal(isRetryableCredentialFailure(200, null, null), false);
});

test("throwProviderCredentialValidation throws ValidationError with correct code", () => {
  assert.throws(
    () => throwProviderCredentialValidation("test-provider", "expected_array"),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test-provider:expected_array"
        && error.source === "provider"
        && error.retryable === false;
    },
  );
});

test("throwProviderCredentialRuntimeError throws ProviderError with correct code", () => {
  assert.throws(
    () => throwProviderCredentialRuntimeError("test-provider", "resolve_failed"),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test-provider:resolve_failed"
        && error.retryable === false;
    },
  );
});

test("requireResolvedSecretValue throws when resolver is null", () => {
  assert.throws(
    () => requireResolvedSecretValue("test-provider", "secret_ref", null),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test-provider:secret_resolver_missing";
    },
  );
});

test("requireResolvedSecretValue throws when resolved value is empty", () => {
  const resolver = () => "   ";

  assert.throws(
    () => requireResolvedSecretValue("test-provider", "secret_ref", resolver),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test-provider:secret_value_missing:secret_ref";
    },
  );
});

test("requireResolvedSecretValue returns trimmed resolved value", () => {
  const resolver = () => "  resolved-key  ";

  const result = requireResolvedSecretValue("test-provider", "secret_ref", resolver);
  assert.equal(result, "resolved-key");
});

test("loadProviderCredentialRecordsFromEnv loads single API key", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY: "my-key",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.credentialId, "test-default");
  assert.equal(records[0]!.apiKey, "my-key");
  assert.equal(records[0]!.label, "default");
});

test("loadProviderCredentialRecordsFromEnv loads JSON array of API keys", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEYS_JSON: JSON.stringify([
      { credentialId: "cred_1", apiKey: "key-1", label: "first" },
      { credentialId: "cred_2", apiKey: "key-2" },
    ]),
  });

  assert.equal(records.length, 2);
  assert.equal(records[0]!.credentialId, "cred_1");
  assert.equal(records[0]!.apiKey, "key-1");
  assert.equal(records[1]!.credentialId, "cred_2");
  assert.equal(records[1]!.apiKey, "key-2");
});

test("loadProviderCredentialRecordsFromEnv throws for invalid JSON", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEYS_JSON: "not valid json",
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:json_parse";
    },
  );
});

test("loadProviderCredentialRecordsFromEnv throws when JSON is not array", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEYS_JSON: JSON.stringify({ not: "an array" }),
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:expected_array";
    },
  );
});

test("loadProviderCredentialRecordsFromEnv loads single secret reference with resolver", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY_SECRET_REF: "my-secret-ref",
  }, {
    secretResolver: (ref) => `resolved-${ref}`,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.credentialId, "test-managed-default");
  assert.equal(records[0]!.apiKey, "resolved-my-secret-ref");
  assert.equal(records[0]!.label, "managed-default");
});

test("loadProviderCredentialRecordsFromEnv preserves secret ref when preserveManagedSecretRefs is true", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY_SECRET_REF: "my-secret-ref",
  }, {
    preserveManagedSecretRefs: true,
    secretResolver: (ref) => `resolved-${ref}`,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.credentialId, "test-managed-default");
  assert.equal(records[0]!.secretRef, "my-secret-ref");
  assert.equal(records[0]!.apiKey, undefined);
});

test("loadProviderCredentialRecordsFromEnv throws when preserveManagedSecretRefs but no resolver", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEY_SECRET_REF: "my-secret-ref",
    }, {
      preserveManagedSecretRefs: true,
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:secret_resolver_missing";
    },
  );
});

test("loadProviderCredentialRecordsFromEnv loads JSON array of secret references", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify([
      { credentialId: "cred_1", secretRef: "ref-1" },
      { credentialId: "cred_2", secretRef: "ref-2" },
    ]),
  }, {
    secretResolver: (ref) => `resolved-${ref}`,
  });

  assert.equal(records.length, 2);
  assert.equal(records[0]!.credentialId, "cred_1");
  assert.equal(records[0]!.apiKey, "resolved-ref-1");
  assert.equal(records[1]!.credentialId, "cred_2");
  assert.equal(records[1]!.apiKey, "resolved-ref-2");
});

test("loadProviderCredentialRecordsFromEnv throws for invalid secret refs JSON", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEY_SECRET_REFS_JSON: "not valid json",
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:secret_refs_json_parse";
    },
  );
});

test("loadProviderCredentialRecordsFromEnv throws when secret refs JSON is not array", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify({ not: "an array" }),
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:secret_refs_expected_array";
    },
  );
});

test("loadProviderCredentialRecordsFromEnv JSON secret refs with preserveManagedSecretRefs uses secretRef not resolved", () => {
  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify([
      { credentialId: "cred_1", secretRef: "ref-1" },
    ]),
  }, {
    preserveManagedSecretRefs: true,
    secretResolver: (ref) => `resolved-${ref}`,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.credentialId, "cred_1");
  assert.equal(records[0]!.secretRef, "ref-1");
  assert.equal(records[0]!.apiKey, undefined);
});

test("loadProviderCredentialRecordsFromEnv JSON secret refs throws without resolver when preserveManagedSecretRefs", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify([
        { credentialId: "cred_1", secretRef: "ref-1" },
      ]),
    }, {
      preserveManagedSecretRefs: true,
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:secret_resolver_missing";
    },
  );
});

test("loadProviderCredentialRecordsFromEnv JSON secret refs with secretLeaseIssuer works", () => {
  const leaseIssuer = () => ({ apiKey: "leased-key", leaseId: "lease_1", expiresAt: "2024-01-01T00:00:00.000Z", leaseSource: "provider_issued" as const });

  const records = loadProviderCredentialRecordsFromEnv("test", {
    TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify([
      { credentialId: "cred_1", secretRef: "ref-1" },
    ]),
  }, {
    preserveManagedSecretRefs: true,
    secretLeaseIssuer: leaseIssuer,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]!.secretRef, "ref-1");
});

test("loadProviderCredentialRecordsFromEnv JSON secret refs with empty secret ref throws", () => {
  assert.throws(
    () => loadProviderCredentialRecordsFromEnv("test", {
      TEST_API_KEY_SECRET_REFS_JSON: JSON.stringify([
        { credentialId: "cred_1", secretRef: "   " },
      ]),
    }, {
      secretResolver: (ref) => `resolved-${ref}`,
    }),
    (error: any) => {
      return error.code === "provider.credentials_invalid:test:missing_secret_ref:0";
    },
  );
});
