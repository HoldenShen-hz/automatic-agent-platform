/**
 * @fileoverview Unit tests for Fixture Redactor
 *
 * Tests the FixtureRedactor class for redacting secrets and PII from test fixtures.
 * Implements §22.3 requirement: fixture auto-redact secrets/hash PII
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  FixtureRedactor,
  generateTestId,
  type RedactionOptions,
  type RedactionResult,
} from "../../../src/sdk/fixture-redact.js";

test("FixtureRedactor redact detects API key pattern", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ apiKey: "secret-access-key-12345" });

  assert.equal(result.value.apiKey, "[REDACTED]");
  assert.ok(result.redactedFields.has("apiKey"));
});

test("FixtureRedactor redact detects password field", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ password: "mySecretPass123" });

  assert.equal(result.value.password, "[REDACTED]");
  assert.ok(result.redactedFields.has("password"));
});

test("FixtureRedactor redact detects JWT token", () => {
  const redactor = new FixtureRedactor();
  const jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const result = redactor.redact({ token: jwtToken });

  assert.equal(result.value.token, "[REDACTED]");
  assert.ok(result.redactedFields.has("token"));
});

test("FixtureRedactor redact detects AWS access key", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ awsKey: "AKIAIOSFODNN7EXAMPLE" });

  assert.equal(result.value.awsKey, "[REDACTED]");
  assert.ok(result.redactedFields.has("awsKey"));
});

test("FixtureRedactor redact detects email PII", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ email: "user@example.com" });

  assert.equal(result.value.email, "[REDACTED]");
  assert.ok(result.redactedFields.has("email"));
});

test("FixtureRedactor redact detects phone number PII", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ phone: "555-123-4567" });

  assert.equal(result.value.phone, "[REDACTED]");
  assert.ok(result.redactedFields.has("phone"));
});

test("FixtureRedactor redact detects SSN PII", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ ssn: "123-45-6789" });

  assert.equal(result.value.ssn, "[REDACTED]");
  assert.ok(result.redactedFields.has("ssn"));
});

test("FixtureRedactor redact detects credit card PII", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ card: "4111-1111-1111-1111" });

  assert.equal(result.value.card, "[REDACTED]");
  assert.ok(result.redactedFields.has("card"));
});

test("FixtureRedactor redact detects IP address PII", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({ ip: "192.168.1.1" });

  assert.equal(result.value.ip, "[REDACTED]");
  assert.ok(result.redactedFields.has("ip"));
});

test("FixtureRedactor redact handles nested objects", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    user: {
      name: "John Doe",
      credentials: {
        apiKey: "secret-key-123",
      },
    },
  });

  assert.equal(result.value.user.name, "John Doe");
  assert.equal(result.value.user.credentials.apiKey, "[REDACTED]");
  assert.ok(result.redactedFields.has("user.credentials.apiKey"));
});

test("FixtureRedactor redact handles arrays", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    users: [
      { name: "Alice", apiKey: "key-alice" },
      { name: "Bob", apiKey: "key-bob" },
    ],
  });

  assert.equal(result.value.users[0].name, "Alice");
  assert.equal(result.value.users[0].apiKey, "[REDACTED]");
  assert.equal(result.value.users[1].apiKey, "[REDACTED]");
});

test("FixtureRedactor redact computes correlation hashes", () => {
  const redactor = new FixtureRedactor({ hashRedacted: true });
  const result = redactor.redact({ password: "secret123" });

  assert.ok(result.correlationHashes.has("password"));
  assert.ok(result.correlationHashes.get("password")?.startsWith("corr_"));
});

test("FixtureRedactor redact does not hash when hashRedacted is false", () => {
  const redactor = new FixtureRedactor({ hashRedacted: false });
  const result = redactor.redact({ apiKey: "secret-key" });

  assert.equal(result.value.apiKey, "[REDACTED]");
  assert.equal(result.correlationHashes.has("apiKey"), false);
});

test("FixtureRedactor redact uses custom replaceWith", () => {
  const redactor = new FixtureRedactor({ replaceWith: "[HIDDEN]" });
  const result = redactor.redact({ password: "secret" });

  assert.equal(result.value.password, "[HIDDEN]");
});

test("FixtureRedactor redact always redacts fields from alwaysRedactFields set", () => {
  const redactor = new FixtureRedactor({
    alwaysRedactFields: new Set(["customSecret", "internalToken"]),
  });
  const result = redactor.redact({
    customSecret: "value1",
    internalToken: "value2",
    regularField: "value3",
  });

  assert.equal(result.value.customSecret, "[REDACTED]");
  assert.equal(result.value.internalToken, "[REDACTED]");
  assert.equal(result.value.regularField, "value3");
});

test("FixtureRedactor redact handles null and undefined", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    nullField: null,
    undefinedField: undefined,
    normalField: "test",
  });

  assert.equal(result.value.nullField, null);
  assert.equal(result.value.undefinedField, undefined);
  assert.equal(result.value.normalField, "test");
});

test("FixtureRedactor redact handles numbers and booleans", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    count: 42,
    active: true,
    password: "secret123",
  });

  assert.equal(result.value.count, 42);
  assert.equal(result.value.active, true);
  assert.equal(result.value.password, "[REDACTED]");
});

test("FixtureRedactor redact handles custom secret patterns", () => {
  const redactor = new FixtureRedactor({
    customSecretPatterns: [
      { pattern: /myapp[_-]?token/i, name: "myapp_token" },
    ],
  });
  const result = redactor.redact({ token: "myapp_token_abc123" });

  assert.equal(result.value.token, "[REDACTED]");
  assert.ok(result.redactedFields.has("token"));
});

test("FixtureRedactor redact handles custom PII patterns", () => {
  const redactor = new FixtureRedactor({
    customPiiPatterns: [
      { pattern: /\b\d{6}\b/, name: "custom_id" },
    ],
  });
  const result = redactor.redact({ idNumber: "123456" });

  assert.equal(result.value.idNumber, "[REDACTED]");
  assert.ok(result.redactedFields.has("idNumber"));
});

test("FixtureRedactor redact handles empty objects and arrays", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    emptyObj: {},
    emptyArr: [],
    normal: "value",
  });

  assert.deepEqual(result.value.emptyObj, {});
  assert.deepEqual(result.value.emptyArr, []);
  assert.equal(result.value.normal, "value");
});

test("FixtureRedactor createStandard creates instance with standard options", () => {
  const redactor = FixtureRedactor.createStandard();
  const result = redactor.redact({ apiKey: "secret-key" });

  assert.equal(result.value.apiKey, "[REDACTED]");
  assert.ok(result.correlationHashes.has("apiKey"));
});

test("FixtureRedactor createNoHash creates instance without hashing", () => {
  const redactor = FixtureRedactor.createNoHash();
  const result = redactor.redact({ password: "secret" });

  assert.equal(result.value.password, "[REDACTED]");
  assert.equal(result.correlationHashes.has("password"), false);
});

test("generateTestId generates unique IDs", () => {
  const id1 = generateTestId();
  const id2 = generateTestId();

  assert.ok(id1.startsWith("test_"));
  assert.ok(id2.startsWith("test_"));
  assert.notEqual(id1, id2);
});

test("generateTestId uses custom prefix", () => {
  const id = generateTestId("custom");
  assert.ok(id.startsWith("custom_"));
});

test("FixtureRedactor redact handles high entropy secrets", () => {
  const redactor = new FixtureRedactor();
  // 40+ character string with high entropy
  const result = redactor.redact({
    largeSecret: "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0",
  });

  assert.equal(result.value.largeSecret, "[REDACTED]");
  assert.ok(result.redactedFields.has("largeSecret"));
});

test("FixtureRedactor redact handles field prefix for nested paths", () => {
  const redactor = new FixtureRedactor();
  const result = redactor.redact({
    level1: {
      level2: {
        apiKey: "secret",
      },
    },
  });

  assert.equal(result.value.level1.level2.apiKey, "[REDACTED]");
  assert.ok(result.redactedFields.has("level1.level2.apiKey"));
});
