import assert from "node:assert/strict";
import test from "node:test";

import { FieldEncryptionService, type FieldProtectionRule } from "../../../../src/platform/compliance/encryption/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// Helper to create a protection rule with defaults
function createRule(overrides: Partial<FieldProtectionRule> = {}): FieldProtectionRule {
  return {
    fieldPath: "secret",
    classification: "confidential",
    ...overrides,
  };
}

test("protectRecord encrypts specified fields", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "my-password", public: "data" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result = service.protectRecord({
    record,
    rules,
    keyRef: "key_123",
  });

  assert.notEqual(result.protectedRecord.secret, "my-password", "secret should be encrypted");
  assert.ok(result.protectedRecord.secret.toString().startsWith("enc:"), "should have encryption prefix");
  assert.equal(result.protectedRecord.public, "data", "unprotected field should remain unchanged");
  assert.equal(result.protectedFields.length, 1);
  assert.equal(result.protectedFields[0].fieldPath, "secret");
  assert.equal(result.protectedFields[0].keyRef, "key_123");
  assert.equal(result.protectedFields[0].classification, "confidential");
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

  assert.equal(result.protectedRecord.secret, 12345, "non-string should not be encrypted");
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

  assert.equal(result.protectedRecord.secret, "", "empty string should not be encrypted");
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

  assert.equal(record.secret, "original", "original record should not be modified");
});

test("revealField decrypts ciphertext encrypted with same key", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "my-password" };
  const rules = [createRule({ fieldPath: "secret" })];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "reveal_key",
  });

  const ciphertext = protectedResult.protectedFields[0].ciphertext;
  const revealed = service.revealField({ ciphertext, keyRef: "reveal_key" });

  assert.equal(revealed, "my-password");
});

test("revealField throws for ciphertext with different key prefix", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "password" };
  const rules = [createRule({ fieldPath: "secret" })];

  const protectedResult = service.protectRecord({
    record,
    rules,
    keyRef: "key_1",
  });

  const ciphertext = protectedResult.protectedFields[0].ciphertext;

  assert.throws(
    () => service.revealField({ ciphertext, keyRef: "key_2" }),
    ValidationError,
  );
});

test("revealField throws for invalid ciphertext format", () => {
  const service = new FieldEncryptionService();

  assert.throws(
    () => service.revealField({ ciphertext: "invalid_format", keyRef: "key_1" }),
    ValidationError,
  );
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
      ciphertext: protectedResult.protectedFields[0].ciphertext,
      keyRef: "roundtrip_key",
    });

    assert.equal(revealed, "sensitive", `roundtrip should work for ${classification}`);
  }
});

test("protectRecord uses correct key fingerprint in ciphertext", () => {
  const service = new FieldEncryptionService();
  const record = { secret: "value" };
  const rules = [createRule({ fieldPath: "secret" })];

  const result1 = service.protectRecord({ record, rules, keyRef: "key_a" });
  const result2 = service.protectRecord({ record, rules, keyRef: "key_b" });

  // Different keys should produce different ciphertext prefixes
  assert.notEqual(
    result1.protectedFields[0].ciphertext,
    result2.protectedFields[0].ciphertext,
    "different keys should produce different ciphertext",
  );
});
