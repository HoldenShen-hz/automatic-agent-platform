import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for compliance field-encryption covering issues:
 * - Issue #2098: Field encryption is base64url not AES-256-GCM
 */

import { FieldEncryptionService, type FieldProtectionRule } from "../../../../src/platform/compliance/encryption/index.js";

function createRule(overrides: Partial<FieldProtectionRule> = {}): FieldProtectionRule {
  return {
    fieldPath: "secret",
    classification: "confidential",
    ...overrides,
  };
}

function parseEnvelope(ciphertext: string): Record<string, string | number> {
  assert.ok(ciphertext.startsWith("encv1."));
  return JSON.parse(Buffer.from(ciphertext.slice("encv1.".length), "base64url").toString("utf8")) as Record<string, string | number>;
}

test("FieldEncryptionService uses a versioned AES-256-GCM envelope", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "my-password", public: "data" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_123",
  });

  const protectedSecret = result.protectedRecord.secret;
  assert.notEqual(protectedSecret, "my-password", "secret should be encrypted");

  if (typeof protectedSecret !== "string") {
    assert.fail("protected secret should be a string");
  }

  const envelope = parseEnvelope(protectedSecret);
  assert.equal(envelope.v, 1);
  assert.equal(typeof envelope.kf, "string");
  assert.equal(typeof envelope.s, "string");
  assert.equal(typeof envelope.i, "string");
  assert.equal(typeof envelope.t, "string");
  assert.equal(typeof envelope.c, "string");
});

test("FieldEncryptionService ciphertext stores base64url-encoded authenticated parts", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "sensitive data" };
  const rules = [createRule()];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "test_key_ref",
  });

  const protectedField = result.protectedFields.at(0);
  assert.ok(protectedField);

  const ciphertext = protectedField.ciphertext;

  const envelope = parseEnvelope(ciphertext);
  assert.match(String(envelope.c), /^[A-Za-z0-9\-_]+$/);
  assert.match(String(envelope.i), /^[A-Za-z0-9\-_]+$/);
  assert.match(String(envelope.t), /^[A-Za-z0-9\-_]+$/);
});

test("FieldEncryptionService revealField decrypts AES-256-GCM ciphertext", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "my-secret-value" };
  const rules = [createRule({ fieldPath: "secret" })];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "reveal_key_123",
  });

  const protectedField = protectedResult.protectedFields.at(0);
  assert.ok(protectedField);

  const revealed = service.revealField({
    ciphertext: protectedField.ciphertext,
    keyRef: "reveal_key_123",
  });

  assert.equal(revealed, "my-secret-value", "AES-256-GCM ciphertext should decrypt correctly");
});

test("FieldEncryptionService different keys produce different ciphertext", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "same-data" };
  const rules = [createRule()];

  const result1 = service.protectRecord({ record, rules, keyRef: "key_a" });
  const result2 = service.protectRecord({ record, rules, keyRef: "key_b" });

  const ciphertext1 = result1.protectedFields.at(0)?.ciphertext ?? "";
  const ciphertext2 = result2.protectedFields.at(0)?.ciphertext ?? "";

  // Different keys should produce completely different ciphertext
  assert.notEqual(ciphertext1, ciphertext2, "different keys should produce different ciphertext");
});

test("FieldEncryptionService AES-256-GCM provides authentication", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "authenticated data" };
  const rules = [createRule()];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "auth_key",
  });

  const protectedField = protectedResult.protectedFields.at(0);
  assert.ok(protectedField);

  // Tamper with the ciphertext
  const tamperedCiphertext = protectedField.ciphertext.replace(/[0-9a-f]$/, (match) => {
    // Flip the last hex digit to tamper
    const tampered = parseInt(match, 16) ^ 0xF;
    return tampered.toString(16);
  });

  // AES-256-GCM with auth tag should reject tampered ciphertext
  assert.throws(
    () => service.revealField({ ciphertext: tamperedCiphertext, keyRef: "auth_key" }),
    Error,
    "AES-256-GCM authentication should reject tampered ciphertext",
  );
});

test("FieldEncryptionService rejects malformed ciphertext envelope", () => {
  const service = new FieldEncryptionService();

  assert.throws(
    () => service.revealField({ ciphertext: "enc:short", keyRef: "auth_key" }),
    /encv1 envelope format/,
  );
});

test("FieldEncryptionService all classification levels use AES-256-GCM", () => {
  const service = new FieldEncryptionService();
  const classifications: Array<FieldProtectionRule["classification"]> = ["internal", "confidential", "restricted"];

  for (const classification of classifications) {
    const record = { data: "sensitive" };
    const rules = [createRule({ fieldPath: "data", classification })];

    const protectedResult = service.protectRecord({
      record,
      rules,
      keyRef: "roundtrip_key",
    });

    const protectedField = protectedResult.protectedFields.at(0);
    assert.ok(protectedField);

    // Verify format for all classification levels
    assert.ok(protectedField.ciphertext.startsWith("encv1."), `AES-256-GCM format for ${classification}`);
    const envelope = parseEnvelope(protectedField.ciphertext);
    assert.equal(envelope.v, 1, `AES-256-GCM format for ${classification}`);

    // Verify roundtrip works
    const revealed = service.revealField({
      ciphertext: protectedField.ciphertext,
      keyRef: "roundtrip_key",
    });
    assert.equal(revealed, "sensitive", `roundtrip should work for ${classification}`);
  }
});
