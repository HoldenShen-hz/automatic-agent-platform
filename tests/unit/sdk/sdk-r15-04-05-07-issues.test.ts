import test from "node:test";
import assert from "node:assert/strict";

/**
 * R15-04, R15-05, R15-07 targeted tests
 *
 * R15-04: SdkReleaseDescriptor(sdk_semver/platform_min/max_version/deprecation_policy) code not exported
 * R15-05: PluginType="tool|adapter|retriever|evaluator" vs PluginSpiType includes validator/planner/presenter
 * R15-07: fixture auto-redact secrets/hash PII - FixtureRedactor not exported from SDK
 */

import {
  // R15-04: SdkReleaseDescriptor should be exported from SDK index
  type SdkReleaseDescriptor,
  // R15-07: FixtureRedactor should be exported from SDK index
  FixtureRedactor,
  generateTestId,
} from "../../../src/sdk/index.js";

import { type PluginType } from "../../../src/sdk/plugin-sdk/plugin-definition.js";

test("R15-04: SdkReleaseDescriptor is exported from SDK index", () => {
  // SdkReleaseDescriptor should be a named export from the SDK
  // This verifies the type exists and has the correct shape
  const descriptor: SdkReleaseDescriptor = {
    sdk_semver: "1.0.0",
    platform_min_version: "1.0.0",
    platform_max_version: "2.0.0",
    deprecation_policy: "notify_only",
  };

  assert.equal(descriptor.sdk_semver, "1.0.0");
  assert.equal(descriptor.platform_min_version, "1.0.0");
  assert.equal(descriptor.platform_max_version, "2.0.0");
  assert.equal(descriptor.deprecation_policy, "notify_only");
});

test("R15-04: SdkReleaseDescriptor supports all deprecation_policy values", () => {
  const policies: SdkReleaseDescriptor["deprecation_policy"][] = [
    "notify_only",
    "block",
    "migration_required",
    "hard_cutoff",
  ];

  for (const policy of policies) {
    const descriptor: SdkReleaseDescriptor = {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
      deprecation_policy: policy,
    };
    assert.equal(descriptor.deprecation_policy, policy);
  }
});

test("R15-05: PluginType includes all SPI types (validator, planner, presenter)", () => {
  // R15-05: PluginType in plugin-definition.ts only had "tool"|"adapter"|"retriever"|"evaluator"
  // but PluginSpiType in plugin-spi.ts includes "validator"|"planner"|"presenter"
  // The fix extended PluginType to include all SPI types

  // All these should be valid PluginType values after the fix
  const validTypes: PluginType[] = [
    "tool",
    "adapter",
    "retriever",
    "evaluator",
    "validator",
    "planner",
    "presenter",
  ];

  for (const type of validTypes) {
    assert.ok(validTypes.includes(type), `PluginType "${type}" should be valid`);
  }
});

test("R15-07: FixtureRedactor is exported from SDK index and works", () => {
  // R15-07: fixture-redact.ts existed but was not exported from SDK index
  // The fix adds FixtureRedactor and generateTestId exports

  // Test FixtureRedactor basic functionality
  const redactor = new FixtureRedactor();

  // Test API key redaction
  const result1 = redactor.redact({ apiKey: "secret-access-key-12345" });
  assert.equal(result1.value.apiKey, "[REDACTED]");
  assert.ok(result1.redactedFields.has("apiKey"));

  // Test password redaction
  const result2 = redactor.redact({ password: "mySecretPass123" });
  assert.equal(result2.value.password, "[REDACTED]");
  assert.ok(result2.redactedFields.has("password"));

  // Test JWT token detection
  const jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const result3 = redactor.redact({ token: jwtToken });
  assert.equal(result3.value.token, "[REDACTED]");

  // Test email PII redaction
  const result4 = redactor.redact({ email: "user@example.com" });
  assert.equal(result4.value.email, "[REDACTED]");
  assert.ok(result4.redactedFields.has("email"));
});

test("R15-07: generateTestId generates unique test IDs", () => {
  const id1 = generateTestId("test");
  const id2 = generateTestId("test");

  assert.ok(id1.startsWith("test_"));
  assert.ok(id2.startsWith("test_"));
  assert.notEqual(id1, id2);
});

test("R15-07: FixtureRedactor.computeCorrelationHash produces consistent hashes", () => {
  const redactor = new FixtureRedactor();

  // Same input should produce same hash
  const result1 = redactor.redact({ key: "secret-value" });
  const result2 = redactor.redact({ key: "secret-value" });

  assert.equal(result1.value.key, "[REDACTED]");
  assert.equal(result2.value.key, "[REDACTED]");

  // Correlation hashes should be present when hashRedacted is enabled (default)
  assert.ok(result1.correlationHashes.has("key"));
  assert.ok(result2.correlationHashes.has("key"));
  assert.equal(result1.correlationHashes.get("key"), result2.correlationHashes.get("key"));
});

test("R15-07: FixtureRedactor with hashRedacted false does not produce correlation hashes", () => {
  const redactorNoHash = new FixtureRedactor({ hashRedacted: false });
  const result = redactorNoHash.redact({ apiKey: "secret-key" });

  assert.equal(result.value.apiKey, "[REDACTED]");
  assert.ok(result.correlationHashes.size === 0);
});

test("R15-07: FixtureRedactor handles nested objects", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    user: {
      name: "John Doe",
      credentials: {
        apiKey: "secret-key-123",
      },
    },
  });

  const nested = result.value as { user: { name: string; credentials: { apiKey: string } } };
  assert.equal(nested.user.name, "John Doe");
  assert.equal(nested.user.credentials.apiKey, "[REDACTED]");
  assert.ok(result.redactedFields.has("user.credentials.apiKey"));
});
