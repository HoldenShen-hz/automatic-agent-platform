import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for FieldEncryptionService covering audit fix:
 * - Issue #2098: Field encryption is base64url encoding, not AES-256-GCM encryption
 *
 * The field encryption service MUST use AES-256-GCM authenticated encryption
 * with proper IV, auth tag, and hex-encoded ciphertext format:
 * Format: enc:fingerprint:iv:authTag:ciphertext (hex encoded, not base64url)
 */

import { FieldEncryptionService, type FieldProtectionRule } from "../../../../../src/platform/compliance/encryption/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

function createRule(overrides: Partial<FieldProtectionRule> = {}): FieldProtectionRule {
  return {
    fieldPath: "secret",
    classification: "confidential",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2098: Field encryption must use AES-256-GCM, not base64url encoding
// ─────────────────────────────────────────────────────────────────────────────

test("Issue #2098: protectRecord must use AES-256-GCM format with auth tag, not base64url encoding", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "my-password", public: "data" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_123",
  });

  const protectedSecret = result.protectedRecord.secret;
  assert.notEqual(protectedSecret, "my-password", "secret must be encrypted");

  if (typeof protectedSecret !== "string") {
    assert.fail("protected secret must be a string");
  }

  // Issue #2098: Must have enc: prefix
  assert.ok(protectedSecret.startsWith("enc:"), "must have encryption prefix");

  // AES-256-GCM format: enc:fingerprint:iv:authTag:ciphertext (5 parts after prefix)
  const parts = protectedSecret.split(":");
  assert.equal(parts.length, 5,
    "Issue #2098: AES-256-GCM format must have 5 parts: enc:fingerprint:iv:authTag:ciphertext");

  // Part 1: fingerprint (12 hex chars = 48 bits)
  assert.equal(parts[1]!.length, 12, "fingerprint should be 12 hex chars");

  // Part 2: IV (24 hex chars = 96 bits for GCM)
  assert.equal(parts[2]!.length, 24, "Issue #2098: IV must be 24 hex chars (96-bit GCM IV)");

  // Part 3: auth tag (32 hex chars = 128 bits)
  assert.equal(parts[3]!.length, 32, "Issue #2098: authTag must be 32 hex chars (128-bit GCM tag)");

  // Part 4: ciphertext (hex encoded)
  assert.ok(parts[4]!.length > 0, "ciphertext must not be empty");

  // All hex parts must be valid hex (not base64url)
  assert.ok(/^[0-9a-f]+$/i.test(parts[2]!), "IV must be hex, not base64url");
  assert.ok(/^[0-9a-f]+$/i.test(parts[3]!), "authTag must be hex, not base64url");
  assert.ok(/^[0-9a-f]+$/i.test(parts[4]!), "ciphertext must be hex, not base64url");
});

test("Issue #2098: revealField must decrypt AES-256-GCM ciphertext, not just base64 decode", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "sensitive-data-123" };
  const rules = [createRule({ fieldPath: "secret" })];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "aes_gcm_key",
  });

  const protectedField = protectedResult.protectedFields.at(0);
  assert.ok(protectedField, "field must be protected");

  // Issue #2098: revealField must perform actual AES-256-GCM decryption with auth verification
  const revealed = service.revealField({
    ciphertext: protectedField.ciphertext,
    keyRef: "aes_gcm_key",
  });

  assert.equal(revealed, "sensitive-data-123", "must decrypt correctly via AES-256-GCM");
});

test("Issue #2098: Different keys must produce different ciphertext (key diversity)", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "same-data" };
  const rules = [createRule()];

  const result1 = service.protectRecord({ record, rules, keyRef: "key_a" });
  const result2 = service.protectRecord({ record, rules, keyRef: "key_b" });

  const ciphertext1 = result1.protectedFields.at(0)?.ciphertext ?? "";
  const ciphertext2 = result2.protectedFields.at(0)?.ciphertext ?? "";

  // Different keys must produce completely different ciphertext
  assert.notEqual(ciphertext1, ciphertext2, "different keys must produce different ciphertext");

  // Each must have different fingerprint (derived from key)
  const parts1 = ciphertext1.split(":");
  const parts2 = ciphertext2.split(":");
  assert.notEqual(parts1[1], parts2[1], "different keys must have different fingerprints");
});

test("Issue #2098: AES-256-GCM must reject tampered ciphertext (authentication)", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "authenticated-data" };
  const rules = [createRule({ fieldPath: "secret" })];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "auth_key",
  });

  const protectedField = protectedResult.protectedFields.at(0);
  assert.ok(protectedField, "field must be protected");

  // Tamper with the ciphertext (flip a hex digit in the ciphertext portion)
  const parts = protectedField.ciphertext.split(":");
  const originalCiphertext = parts[4];
  const tamperedCiphertext = originalCiphertext.replace(/[0-9a-f]$/, (match) => {
    const tampered = parseInt(match, 16) ^ 0xF;
    return tampered.toString(16);
  });
  parts[4] = tamperedCiphertext;
  const tamperedFull = parts.join(":");

  // Issue #2098: AES-256-GCM authentication must reject tampered ciphertext
  assert.throws(
    () => service.revealField({ ciphertext: tamperedFull, keyRef: "auth_key" }),
    ValidationError,
    "AES-256-GCM must reject tampered ciphertext via auth tag verification",
  );
});

test("Issue #2098: revealField must reject ciphertext from different key", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "key-test-data" };
  const rules = [createRule({ fieldPath: "secret" })];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "key_wrong",
  });

  const protectedField = protectedResult.protectedFields.at(0);
  assert.ok(protectedField, "field must be protected");

  // Try to reveal with a different key
  assert.throws(
    () => service.revealField({ ciphertext: protectedField.ciphertext, keyRef: "key_different" }),
    ValidationError,
    "revealField must reject ciphertext protected with different key",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// All classification levels must use AES-256-GCM
// ─────────────────────────────────────────────────────────────────────────────

test("AES-256-GCM encryption works for 'internal' classification", () => {
  const service = new FieldEncryptionService();
  const record = { data: "internal-data" };
  const rules = [createRule({ fieldPath: "data", classification: "internal" })];

  const result = service.protectRecord({ record, rules, keyRef: "internal_key" });

  const protectedField = result.protectedFields.at(0);
  assert.ok(protectedField, "field must be protected");

  // Verify format
  assert.ok(protectedField.ciphertext.startsWith("enc:"));
  const parts = protectedField.ciphertext.split(":");
  assert.equal(parts.length, 5, "must use AES-256-GCM format");

  // Verify roundtrip
  const revealed = service.revealField({
    ciphertext: protectedField.ciphertext,
    keyRef: "internal_key",
  });
  assert.equal(revealed, "internal-data");
});

test("AES-256-GCM encryption works for 'confidential' classification", () => {
  const service = new FieldEncryptionService();
  const record = { data: "confidential-data" };
  const rules = [createRule({ fieldPath: "data", classification: "confidential" })];

  const result = service.protectRecord({ record, rules, keyRef: "confidential_key" });

  const protectedField = result.protectedFields.at(0);
  assert.ok(protectedField, "field must be protected");

  // Verify format
  assert.ok(protectedField.ciphertext.startsWith("enc:"));
  const parts = protectedField.ciphertext.split(":");
  assert.equal(parts.length, 5, "must use AES-256-GCM format");

  // Verify roundtrip
  const revealed = service.revealField({
    ciphertext: protectedField.ciphertext,
    keyRef: "confidential_key",
  });
  assert.equal(revealed, "confidential-data");
});

test("AES-256-GCM encryption works for 'restricted' classification", () => {
  const service = new FieldEncryptionService();
  const record = { data: "restricted-data" };
  const rules = [createRule({ fieldPath: "data", classification: "restricted" })];

  const result = service.protectRecord({ record, rules, keyRef: "restricted_key" });

  const protectedField = result.protectedFields.at(0);
  assert.ok(protectedField, "field must be protected");

  // Verify format
  assert.ok(protectedField.ciphertext.startsWith("enc:"));
  const parts = protectedField.ciphertext.split(":");
  assert.equal(parts.length, 5, "must use AES-256-GCM format");

  // Verify roundtrip
  const revealed = service.revealField({
    ciphertext: protectedField.ciphertext,
    keyRef: "restricted_key",
  });
  assert.equal(revealed, "restricted-data");
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic FieldEncryptionService functionality
// ─────────────────────────────────────────────────────────────────────────────

test("protectRecord encrypts specified fields", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "my-password", public: "data" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_123",
  });

  assert.notEqual(result.protectedRecord.secret, "my-password", "secret must be encrypted");
  assert.equal(result.protectedRecord.public, "data", "unprotected field must remain unchanged");
  assert.equal(result.protectedFields.length, 1);
  assert.equal(result.protectedFields[0]?.fieldPath, "secret");
  assert.equal(result.protectedFields[0]?.keyRef, "key_123");
  assert.equal(result.protectedFields[0]?.classification, "confidential");
});

test("protectRecord handles nested field paths", () => {
  const service = new FieldEncryptionService();
  const record = { user: { password: "secret123" }, public: "info" };
  const rules = [createRule({ fieldPath: "user.password" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_456",
  });

  assert.notEqual((result.protectedRecord.user as Record<string, unknown>).password, "secret123");
  assert.equal(result.protectedRecord.public, "info");
});

test("protectRecord throws for empty keyRef", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "value" };
  const rules = [createRule()];

  assert.throws(
    () =>
      service.protectRecord({
        record,
        rules,
        keyRef: "   ",
      }),
    ValidationError,
  );
});

test("protectRecord skips non-string field values", () => {
  const service = new FieldEncryptionService();
  const record = { secret: 12345, other: "string" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_789",
  });

  assert.equal(result.protectedRecord.secret, 12345, "non-string must not be encrypted");
  assert.equal(result.protectedFields.length, 0);
});

test("protectRecord skips empty string field values", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "", other: "value" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_abc",
  });

  assert.equal(result.protectedRecord.secret, "", "empty string must not be encrypted");
  assert.equal(result.protectedFields.length, 0);
});

test("protectRecord skips missing fields", () => {
  const service = new FieldEncryptionService();
  const record = { public: "data" };
  const rules = [createRule({ fieldPath: "nonexistent" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_xyz",
  });

  assert.equal(result.protectedFields.length, 0);
});

test("protectRecord handles multiple rules", () => {
  const service = new FieldEncryptionService();
  const record = { password: "pass", apiKey: "key", public: "data" };
  const rules = [
    createRule({ fieldPath: "password", classification: "restricted" }),
    createRule({ fieldPath: "apiKey", classification: "confidential" }),
  ];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_multi",
  });

  assert.equal(result.protectedFields.length, 2);
  assert.ok(result.protectedFields.some((f) => f.fieldPath === "password" && f.classification === "restricted"));
  assert.ok(result.protectedFields.some((f) => f.fieldPath === "apiKey" && f.classification === "confidential"));
});

test("protectRecord does not modify original record", () => {
  const service = new FieldEncryptionService();
  const record: Record<string, unknown> = { secret: "original" };
  const rules = [createRule({ fieldPath: "secret" })];

  service.protectRecord({
    record,
    rules,
    keyRef: "key_clone",
  });

  assert.equal(record.secret, "original", "original record must not be modified");
});

test("protectRecord and revealField roundtrip for all classifications", () => {
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

    const revealed = service.revealField({
      ciphertext: protectedResult.protectedFields[0]!.ciphertext,
      keyRef: "roundtrip_key",
    });

    assert.equal(revealed, "sensitive", `roundtrip must work for ${classification}`);
  }
});

test("protectRecord uses correct key fingerprint in ciphertext", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "value" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result1 = service.protectRecord({ record, rules, keyRef: "key_a" });
  const result2 = service.protectRecord({ record, rules, keyRef: "key_b" });

  // Different keys must produce different ciphertexts
  assert.notEqual(result1.protectedFields[0]?.ciphertext, result2.protectedFields[0]?.ciphertext,
    "different keys must produce different ciphertext");
});

test("revealField throws for invalid ciphertext format", () => {
  const service = new FieldEncryptionService();

  assert.throws(
    () => service.revealField({ ciphertext: "invalid_format", keyRef: "key_1" }),
    ValidationError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM specific properties
// ─────────────────────────────────────────────────────────────────────────────

test("Each call produces unique ciphertext (due to random IV)", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "same-data" };
  const rules = [createRule()];

  const result1 = service.protectRecord({ record, rules, keyRef: "unique_key" });
  const result2 = service.protectRecord({ record, rules, keyRef: "unique_key" });

  const ct1 = result1.protectedFields[0]?.ciphertext ?? "";
  const ct2 = result2.protectedFields[0]?.ciphertext ?? "";

  // Same plaintext with same key must produce different ciphertext due to random IV
  assert.notEqual(ct1, ct2, "random IV must produce unique ciphertext each time");

  // But both must decrypt to same plaintext
  assert.equal(service.revealField({ ciphertext: ct1, keyRef: "unique_key" }), "same-data");
  assert.equal(service.revealField({ ciphertext: ct2, keyRef: "unique_key" }), "same-data");
});

test("IV in ciphertext is properly hex encoded (96-bit for GCM)", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "test" };
  const rules = [createRule()];

  const result = service.protectRecord({ record, rules, keyRef: "iv_test" });
  const ciphertext = result.protectedFields[0]?.ciphertext ?? "";

  const parts = ciphertext.split(":");
  const iv = parts[2];

  // IV must be exactly 24 hex chars (96 bits)
  assert.equal(iv.length, 24, "GCM IV must be 96 bits = 24 hex chars");

  // Must be valid hex
  assert.ok(/^[0-9a-f]{24}$/i.test(iv), "IV must be valid 96-bit hex");
});

test("Auth tag is properly hex encoded (128-bit for GCM)", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "test" };
  const rules = [createRule()];

  const result = service.protectRecord({ record, rules, keyRef: "tag_test" });
  const ciphertext = result.protectedFields[0]?.ciphertext ?? "";

  const parts = ciphertext.split(":");
  const authTag = parts[3];

  // Auth tag must be exactly 32 hex chars (128 bits)
  assert.equal(authTag.length, 32, "GCM auth tag must be 128 bits = 32 hex chars");

  // Must be valid hex
  assert.ok(/^[0-9a-f]{32}$/i.test(authTag), "authTag must be valid 128-bit hex");
});

test("FieldEncryptionService protects nested fields with matching key", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      customer: {
        email: "alice@example.com",
        profile: { phone: "+8613800138000" },
      },
    },
    rules: [
      { fieldPath: "customer.email", classification: "confidential" },
      { fieldPath: "customer.profile.phone", classification: "restricted" },
    ],
    keyRef: "kms://tenant-a/key-1",
  });

  const emailCiphertext = result.protectedRecord.customer as Record<string, unknown>;
  assert.equal(result.protectedFields.length, 2);
  assert.equal(typeof emailCiphertext.email, "string");
  assert.equal(service.revealField({ ciphertext: emailCiphertext.email as string, keyRef: "kms://tenant-a/key-1" }), "alice@example.com");
});