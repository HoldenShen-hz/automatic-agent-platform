import assert from "node:assert/strict";
import test from "node:test";

import {
  FixtureRedactor,
  generateTestId,
  type RedactionOptions,
  type RedactionResult,
} from "../../../src/sdk/fixture-redact.js";

function redact<T>(fixture: T, options?: RedactionOptions): RedactionResult & { value: T } {
  return new FixtureRedactor(options).redact(fixture) as RedactionResult & { value: T };
}

test("FixtureRedactor redacts secret-looking fields and records correlation hashes by default", () => {
  const result = redact({
    apiKey: "secret-access-key-12345",
    password: "mySecretPass123",
    nested: {
      privateKey: "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0",
    },
  });

  assert.equal(result.value.apiKey, "[REDACTED]");
  assert.equal(result.value.password, "[REDACTED]");
  assert.equal(result.value.nested.privateKey, "[REDACTED]");
  assert.equal(result.redactedFields.has("apiKey"), true);
  assert.equal(result.redactedFields.has("password"), true);
  assert.equal(result.redactedFields.has("nested.privateKey"), true);
  assert.equal(result.correlationHashes.get("password")?.startsWith("corr_"), true);
});

test("FixtureRedactor detects JWT, email, phone, and credit-card patterns even without secret field names", () => {
  const result = redact({
    tokenValue:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signatureValue1234567890",
    profileEmail: "user@example.com",
    supportPhone: "555-123-4567",
    paymentCard: "4111-1111-1111-1111",
  });

  assert.equal(result.value.tokenValue, "[REDACTED]");
  assert.equal(result.value.profileEmail, "[REDACTED]");
  assert.equal(result.value.supportPhone, "[REDACTED]");
  assert.equal(result.value.paymentCard, "[REDACTED]");
});

test("FixtureRedactor recurses through arrays and nested object paths", () => {
  const result = redact({
    users: [
      { name: "Alice", apiKey: "alice-key" },
      { name: "Bob", contact: { email: "bob@example.com" } },
    ],
  });

  assert.equal(result.value.users[0]?.name, "Alice");
  assert.equal(result.value.users[0]?.apiKey, "[REDACTED]");
  assert.equal(result.value.users[1]?.contact.email, "[REDACTED]");
  assert.equal(result.redactedFields.has("users[0].apiKey"), true);
  assert.equal(result.redactedFields.has("users[1].contact.email"), true);
});

test("FixtureRedactor supports replaceWith, no-hash mode, and always-redact fields", () => {
  const result = redact(
    {
      customSecret: "value1",
      internalToken: "value2",
      regularField: "value3",
    },
    {
      replaceWith: "[HIDDEN]",
      hashRedacted: false,
      alwaysRedactFields: new Set(["customSecret", "internalToken"]),
    },
  );

  assert.equal(result.value.customSecret, "[HIDDEN]");
  assert.equal(result.value.internalToken, "[HIDDEN]");
  assert.equal(result.value.regularField, "value3");
  assert.equal(result.correlationHashes.size, 0);
});

test("FixtureRedactor supports custom secret and pii patterns", () => {
  const result = redact(
    {
      pluginToken: "myapp_token_abc123",
      partnerId: "123456",
    },
    {
      customSecretPatterns: [{ pattern: /myapp[_-]?token/i, name: "myapp_token" }],
      customPiiPatterns: [{ pattern: /\b\d{6}\b/, name: "partner_id" }],
    },
  );

  assert.equal(result.value.pluginToken, "[REDACTED]");
  assert.equal(result.value.partnerId, "[REDACTED]");
  assert.equal(result.redactedFields.get("pluginToken"), "myapp_token:[REDACTED]");
  assert.equal(result.redactedFields.get("partnerId"), "partner_id:[REDACTED]");
});

test("FixtureRedactor preserves null, undefined, booleans, numbers, and empty containers", () => {
  const result = redact({
    nullField: null,
    undefinedField: undefined,
    count: 42,
    active: true,
    emptyObj: {},
    emptyArr: [],
  });

  assert.equal(result.value.nullField, null);
  assert.equal(result.value.undefinedField, undefined);
  assert.equal(result.value.count, 42);
  assert.equal(result.value.active, true);
  assert.deepEqual(result.value.emptyObj, {});
  assert.deepEqual(result.value.emptyArr, []);
});

test("FixtureRedactor factory helpers and generateTestId expose the supported API surface", () => {
  const standard = FixtureRedactor.createStandard().redact({ apiKey: "secret-key" }) as {
    value: { apiKey: string };
    correlationHashes: Map<string, string>;
  };
  const noHash = FixtureRedactor.createNoHash().redact({ password: "secret" }) as {
    value: { password: string };
    correlationHashes: Map<string, string>;
  };
  const id1 = generateTestId();
  const id2 = generateTestId("custom");

  assert.equal(standard.value.apiKey, "[REDACTED]");
  assert.equal(standard.correlationHashes.has("apiKey"), true);
  assert.equal(noHash.value.password, "[REDACTED]");
  assert.equal(noHash.correlationHashes.has("password"), false);
  assert.equal(id1.startsWith("test_"), true);
  assert.equal(id2.startsWith("custom_"), true);
  assert.notEqual(id1, id2);
});
