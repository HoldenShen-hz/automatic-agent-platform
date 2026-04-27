import assert from "node:assert/strict";
import test from "node:test";

import { FieldEncryptionService } from "../../../../../src/platform/compliance/encryption/index.js";

test("FieldEncryptionService protectRecord handles empty rules array", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { name: "Alice", email: "alice@example.com" },
    rules: [],
    keyRef: "kms://tenant-a/key-1",
  });

  assert.deepEqual(result.protectedRecord, { name: "Alice", email: "alice@example.com" });
  assert.equal(result.protectedFields.length, 0);
});

test("FieldEncryptionService protectRecord skips non-string field values", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      name: "Alice",
      age: 30,
      active: true,
      scores: [100, 95],
    },
    rules: [
      { fieldPath: "name", classification: "confidential" },
      { fieldPath: "age", classification: "confidential" },
    ],
    keyRef: "kms://tenant-a/key-1",
  });

  // name is a string and will be encrypted, age is a number and will be skipped
  assert.equal(result.protectedFields.length, 1);
  assert.equal(result.protectedFields[0]?.fieldPath, "name");
  // The name field is encrypted (not equal to original plaintext)
  const protectedRec = result.protectedRecord as Record<string, unknown>;
  assert.notStrictEqual(protectedRec.name, "Alice");
  // age remains unchanged since it's a number
  assert.strictEqual(protectedRec.age, 30);
});

test("FieldEncryptionService protectRecord skips empty string values", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { name: "" },
    rules: [{ fieldPath: "name", classification: "confidential" }],
    keyRef: "kms://tenant-a/key-1",
  });

  assert.equal(result.protectedFields.length, 0);
});

test("FieldEncryptionService protectRecord throws for empty keyRef", () => {
  const service = new FieldEncryptionService();
  assert.throws(
    () =>
      service.protectRecord({
        record: { name: "Alice" },
        rules: [{ fieldPath: "name", classification: "confidential" }],
        keyRef: "",
      }),
    (error: unknown) => {
      if (error instanceof Error && "code" in error) {
        return (error as { code: string }).code === "field_encryption.missing_key_ref";
      }
      return false;
    },
  );
});

test("FieldEncryptionService protectRecord throws for whitespace-only keyRef", () => {
  const service = new FieldEncryptionService();
  assert.throws(
    () =>
      service.protectRecord({
        record: { name: "Alice" },
        rules: [{ fieldPath: "name", classification: "confidential" }],
        keyRef: "   ",
      }),
    (error: unknown) => {
      if (error instanceof Error && "code" in error) {
        return (error as { code: string }).code === "field_encryption.missing_key_ref";
      }
      return false;
    },
  );
});

test("FieldEncryptionService revealField throws for key mismatch", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { name: "Alice" },
    rules: [{ fieldPath: "name", classification: "confidential" }],
    keyRef: "kms://tenant-a/key-1",
  });

  assert.throws(
    () =>
      service.revealField({
        ciphertext: (result.protectedRecord as Record<string, unknown>).name as string,
        keyRef: "kms://tenant-a/wrong-key",
      }),
    (error: unknown) => {
      if (error instanceof Error && "code" in error) {
        return (error as { code: string }).code === "field_encryption.key_mismatch";
      }
      return false;
    },
  );
});

test("FieldEncryptionService revealField roundtrip works correctly", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { email: "alice@example.com", phone: "+1234567890" },
    rules: [
      { fieldPath: "email", classification: "confidential" },
      { fieldPath: "phone", classification: "restricted" },
    ],
    keyRef: "kms://tenant-a/key-1",
  });

  const protectedRecord1 = result.protectedRecord as Record<string, unknown>;

  const revealedEmail = service.revealField({
    ciphertext: protectedRecord1.email as string,
    keyRef: "kms://tenant-a/key-1",
  });
  assert.equal(revealedEmail, "alice@example.com");

  const revealedPhone = service.revealField({
    ciphertext: protectedRecord1.phone as string,
    keyRef: "kms://tenant-a/key-1",
  });
  assert.equal(revealedPhone, "+1234567890");
});

test("FieldEncryptionService protectRecord handles nested object creation", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { user: { profile: { name: "Alice" } } },
    rules: [{ fieldPath: "user.profile.name", classification: "confidential" }],
    keyRef: "kms://tenant-a/key-1",
  });

  // Service should encrypt the nested field
  assert.equal(result.protectedFields.length, 1);
  assert.equal(result.protectedFields[0]?.fieldPath, "user.profile.name");
  // Verify the value was encrypted (not equal to original)
  const nested = result.protectedRecord as Record<string, unknown>;
  const user = nested.user as Record<string, unknown>;
  const profile = user.profile as Record<string, unknown>;
  assert.notStrictEqual(profile.name, "Alice");
});

test("FieldEncryptionService protectRecord handles multiple levels of nesting", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      level1: {
        level2: {
          level3: {
            data: "secret value",
          },
        },
      },
    },
    rules: [{ fieldPath: "level1.level2.level3.data", classification: "confidential" }],
    keyRef: "kms://tenant-a/key-1",
  });

  const protectedRecord2 = result.protectedRecord as Record<string, unknown>;
  const l1 = protectedRecord2.level1 as Record<string, unknown>;
  const l2 = l1.level2 as Record<string, unknown>;
  const l3 = l2.level3 as Record<string, unknown>;
  assert.notEqual(l3.data, "secret value");
  assert.equal(result.protectedFields.length, 1);
});

test("FieldEncryptionService protectRecord applies all classification types", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      field1: "internal data",
      field2: "confidential data",
      field3: "restricted data",
    },
    rules: [
      { fieldPath: "field1", classification: "internal" },
      { fieldPath: "field2", classification: "confidential" },
      { fieldPath: "field3", classification: "restricted" },
    ],
    keyRef: "kms://tenant-a/key-1",
  });

  assert.equal(result.protectedFields.length, 3);
  assert.ok(result.protectedFields.some((f) => f.classification === "internal"));
  assert.ok(result.protectedFields.some((f) => f.classification === "confidential"));
  assert.ok(result.protectedFields.some((f) => f.classification === "restricted"));
});

test("FieldEncryptionService protectRecord preserves non-protected fields", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      id: 123,
      name: "Alice",
      description: "A regular field",
      timestamp: 1704067200000,
    },
    rules: [{ fieldPath: "name", classification: "confidential" }],
    keyRef: "kms://tenant-a/key-1",
  });

  const protectedRecord = result.protectedRecord as Record<string, unknown>;
  assert.equal(protectedRecord.id, 123);
  assert.equal(protectedRecord.description, "A regular field");
  assert.equal(protectedRecord.timestamp, 1704067200000);
});

test("FieldEncryptionService protectRecord handles field path that does not exist", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { existing: "value" },
    rules: [{ fieldPath: "nonexistent.path", classification: "confidential" }],
    keyRef: "kms://tenant-a/key-1",
  });

  // Should not throw, just skip
  assert.equal(result.protectedFields.length, 0);
});