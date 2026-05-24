import assert from "node:assert/strict";
import test from "node:test";

import { FieldEncryptionService, type FieldProtectionRule } from "../../../../src/platform/compliance/encryption/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

const KEY_REF = "test-key-ref-12345";

function expectValidationErrorCode(error: unknown, code: string): boolean {
  assert.ok(error instanceof ValidationError);
  assert.equal(error.code, code);
  return true;
}

test("FieldEncryptionService protectRecord encrypts specified fields", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "Alice", email: "alice@example.com", age: 30 };
  const rules: FieldProtectionRule[] = [
    { fieldPath: "name", classification: "internal" },
    { fieldPath: "email", classification: "confidential" },
  ];

  const result = service.protectRecord({ record, rules, keyRef: KEY_REF });

  assert.notEqual(result.protectedRecord.name, "Alice");
  assert.notEqual(result.protectedRecord.email, "alice@example.com");
  assert.equal(result.protectedRecord.age, 30);
  assert.equal(result.protectedFields.length, 2);
  assert.equal(result.protectedFields[0]!.fieldPath, "name");
  assert.equal(result.protectedFields[1]!.fieldPath, "email");
});

test("FieldEncryptionService protectRecord preserves non-matching fields", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "Bob", department: "Engineering" };
  const rules: FieldProtectionRule[] = [{ fieldPath: "name", classification: "internal" }];

  const result = service.protectRecord({ record, rules, keyRef: KEY_REF });

  assert.equal(result.protectedRecord.department, "Engineering");
});

test("FieldEncryptionService protectRecord skips non-string fields", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "Carol", score: 100, active: true };
  const rules: FieldProtectionRule[] = [
    { fieldPath: "name", classification: "internal" },
    { fieldPath: "score", classification: "confidential" },
    { fieldPath: "active", classification: "restricted" },
  ];

  const result = service.protectRecord({ record, rules, keyRef: KEY_REF });

  // Only string fields should be encrypted
  assert.ok(result.protectedFields.every((f) => f.fieldPath === "name"));
});

test("FieldEncryptionService protectRecord skips empty string values", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "", email: "bob@example.com" };
  const rules: FieldProtectionRule[] = [
    { fieldPath: "name", classification: "internal" },
    { fieldPath: "email", classification: "confidential" },
  ];

  const result = service.protectRecord({ record, rules, keyRef: KEY_REF });

  assert.equal(result.protectedFields.length, 1);
  assert.equal(result.protectedFields[0]!.fieldPath, "email");
});

test("FieldEncryptionService protectRecord throws on empty keyRef", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "Dave" };
  const rules: FieldProtectionRule[] = [{ fieldPath: "name", classification: "internal" }];

  assert.throws(
    () => service.protectRecord({ record, rules, keyRef: "" }),
    (error) => expectValidationErrorCode(error, "field_encryption.missing_key_ref"),
  );
  assert.throws(
    () => service.protectRecord({ record, rules, keyRef: "   " }),
    (error) => expectValidationErrorCode(error, "field_encryption.missing_key_ref"),
  );
});

test("FieldEncryptionService revealField decrypts protected ciphertext", (t) => {
  const service = new FieldEncryptionService();
  const original = "secret message";
  const record = { name: original };
  const rules: FieldProtectionRule[] = [{ fieldPath: "name", classification: "internal" }];

  const { protectedRecord, protectedFields } = service.protectRecord({
    record,
    rules,
    keyRef: KEY_REF,
  });

  const revealed = service.revealField({
    ciphertext: protectedFields[0]!.ciphertext,
    keyRef: KEY_REF,
  });

  assert.equal(revealed, original);
});

test("FieldEncryptionService revealField throws on wrong keyRef", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "secret" };
  const rules: FieldProtectionRule[] = [{ fieldPath: "name", classification: "internal" }];

  const { protectedFields } = service.protectRecord({ record, rules, keyRef: KEY_REF });

  assert.throws(
    () => service.revealField({ ciphertext: protectedFields[0]!.ciphertext, keyRef: "wrong-key" }),
    (error) => expectValidationErrorCode(error, "field_encryption.key_mismatch"),
  );
});

test("FieldEncryptionService revealField throws on malformed ciphertext", (t) => {
  const service = new FieldEncryptionService();

  assert.throws(
    () => service.revealField({ ciphertext: "not-formatted", keyRef: KEY_REF }),
    (error) => expectValidationErrorCode(error, "field_encryption.invalid_ciphertext"),
  );
  assert.throws(
    () => service.revealField({ ciphertext: "no-colons-here", keyRef: KEY_REF }),
    (error) => expectValidationErrorCode(error, "field_encryption.invalid_ciphertext"),
  );
  assert.throws(
    () => service.revealField({ ciphertext: "enc:bad", keyRef: KEY_REF }),
    (error) => expectValidationErrorCode(error, "field_encryption.invalid_ciphertext"),
  );
  assert.throws(
    () => service.revealField({ ciphertext: "enc:abcd:iv:tag:data", keyRef: KEY_REF }),
    (error) => expectValidationErrorCode(error, "field_encryption.key_mismatch"),
  );
});

test("FieldEncryptionService protects and reveals nested fields", (t) => {
  const service = new FieldEncryptionService();
  const record = { user: { name: "Eve", email: "eve@example.com" } };
  const rules: FieldProtectionRule[] = [{ fieldPath: "user.name", classification: "internal" }];

  const { protectedRecord, protectedFields } = service.protectRecord({
    record,
    rules,
    keyRef: KEY_REF,
  });

  const nestedRecord = protectedRecord as { user: { name: string } };
  assert.notEqual(nestedRecord.user.name, "Eve");
  assert.equal(protectedFields[0]!.fieldPath, "user.name");

  const revealed = service.revealField({
    ciphertext: protectedFields[0]!.ciphertext,
    keyRef: KEY_REF,
  });
  assert.equal(revealed, "Eve");
});

test("FieldEncryptionService protects and reveals array fields", (t) => {
  const service = new FieldEncryptionService();
  const record = { items: ["alpha", "beta"] };
  const rules: FieldProtectionRule[] = [{ fieldPath: "items[0]", classification: "internal" }];

  const { protectedRecord, protectedFields } = service.protectRecord({
    record,
    rules,
    keyRef: KEY_REF,
  });

  const arrRecord = protectedRecord as { items: string[] };
  assert.notEqual(arrRecord.items[0], "alpha");
  assert.equal(arrRecord.items[1], "beta");
  assert.equal(protectedFields[0]!.fieldPath, "items[0]");

  const revealed = service.revealField({
    ciphertext: protectedFields[0]!.ciphertext,
    keyRef: KEY_REF,
  });
  assert.equal(revealed, "alpha");
});

test("FieldEncryptionService ciphertext format is enc:fingerprint:iv:authTag:ciphertext", (t) => {
  const service = new FieldEncryptionService();
  const record = { name: "Frank" };
  const rules: FieldProtectionRule[] = [{ fieldPath: "name", classification: "internal" }];

  const { protectedFields } = service.protectRecord({ record, rules, keyRef: KEY_REF });
  const parts = protectedFields[0]!.ciphertext.split(":");
  assert.equal(parts.length, 5);
  assert.equal(parts[0]!, "enc");
  assert.ok(parts[1]!.length > 0); // fingerprint
  assert.ok(parts[2]!.length > 0); // iv hex
  assert.ok(parts[3]!.length > 0); // authTag hex
  assert.ok(parts[4]!.length > 0); // ciphertext hex
});
