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

test("FieldEncryptionService uses AES-256-GCM encryption format", () => {
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

  // Issue #2098: Verify encryption uses AES-256-GCM format with auth tag
  // The format is: enc:fingerprint:iv:authTag:ciphertext (hex encoded)
  // This is NOT base64url encoding
  if (typeof protectedSecret !== "string") {
    assert.fail("protected secret should be a string");
  }

  // Should have enc: prefix
  assert.ok(protectedSecret.startsWith("enc:"), "should have encryption prefix");

  // Should have 5 parts after "enc:" prefix
  const parts = protectedSecret.split(":");
  assert.equal(parts.length, 5, "AES-256-GCM format should have 5 parts: fingerprint:iv:authTag:ciphertext");

  // Fingerprint defaults to a 32-hex-character prefix of the keyRef digest.
  assert.equal(parts[1]?.length, 32, "fingerprint should be 32 hex chars");

  // IV should be 24 hex chars (96 bits / 4 = 24)
  assert.equal(parts[2]?.length, 24, "IV should be 24 hex chars for 96-bit GCM IV");

  // Auth tag should be 32 hex chars (128 bits / 4 = 32)
  assert.equal(parts[3]?.length, 32, "authTag should be 32 hex chars for 128-bit GCM tag");

  // Ciphertext should not be empty
  assert.ok((parts[4]?.length ?? 0) > 0, "ciphertext should not be empty");
});

test("FieldEncryptionService ciphertext is hex-encoded, not base64url", () => {
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

  // Extract the ciphertext part (last segment after 4th colon)
  const parts = ciphertext.split(":");
  const encryptedHex = parts[4];

  // Verify it's valid hex (only contains 0-9, a-f)
  assert.ok(/^[0-9a-f]+$/i.test(encryptedHex ?? ""), "ciphertext should be hex encoded, not base64url");

  // base64url would contain A-Z, a-z, 0-9, -, _  characters
  // hex only contains 0-9, a-f
  const hasBase64Chars = /[A-Z+\/=]/.test(encryptedHex ?? "");
  assert.ok(!hasBase64Chars, "ciphertext should NOT contain base64url characters like +, /, =");
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
    /enc:fingerprint:iv:authTag:ciphertext format/,
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
    assert.ok(protectedField.ciphertext.startsWith("enc:"), `AES-256-GCM format for ${classification}`);
    const parts = protectedField.ciphertext.split(":");
    assert.equal(parts.length, 5, `AES-256-GCM format for ${classification}`);

    // Verify roundtrip works
    const revealed = service.revealField({
      ciphertext: protectedField.ciphertext,
      keyRef: "roundtrip_key",
    });
    assert.equal(revealed, "sensitive", `roundtrip should work for ${classification}`);
  }
});
