import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for crypto-shredding-service covering:
 * - Issue #2085: encryptRecordForSubject returns originalValue (plaintext PII) in encryptions array
 */

import { CryptoShreddingService, InMemoryShredAuditTrail, type PiiFieldSpec } from "../../../../../src/platform/compliance/crypto-shredding/crypto-shredding-service.js";
import { DekManager } from "../../../../../src/platform/compliance/crypto-shredding/dek-manager.js";

async function createServiceWithDek(subjectId: string): Promise<{
  service: CryptoShreddingService;
  dekManager: DekManager;
}> {
  const dekManager = new DekManager();
  await dekManager.createForSubject(subjectId);
  const service = new CryptoShreddingService({ dekManager });
  return { service, dekManager };
}

test("CryptoShreddingService.encryptRecordForSubject does NOT leak plaintext PII in encryptions array - Issue #2085", async () => {
  const { service } = await createServiceWithDek("user-123");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });
  service.registerPiiField({ fieldPath: "ssn", classification: "restricted" });

  const record = {
    email: "john.doe@example.com",
    ssn: "123-45-6789",
    name: "John Doe",
  };

  const result = await service.encryptRecordForSubject("user-123", record);

  // Verify the record's PII fields are encrypted (not plaintext)
  assert.notEqual(result.encryptedRecord.email, "john.doe@example.com", "email should be encrypted");
  assert.notEqual(result.encryptedRecord.ssn, "123-45-6789", "ssn should be encrypted");
  assert.equal(result.encryptedRecord.name, "John Doe", "non-PII field should not change");

  // Issue #2085: The encryptions array should NOT contain originalValue (plaintext PII)
  // Only fieldPath and dekId should be present for audit purposes
  for (const encryption of result.encryptions) {
    // These properties should exist for audit
    assert.ok("fieldPath" in encryption, "encryptions should have fieldPath for audit");
    assert.ok("dekId" in encryption, "encryptions should have dekId for audit");

    // Issue #2085: originalValue should NOT be present - that would leak plaintext PII via logs/storage
    assert.ok(!("originalValue" in encryption), "encryptions must NOT contain originalValue (plaintext PII) - would leak via logs");

    // Verify the original PII is not in any encryption property
    const encryptionStr = JSON.stringify(encryption);
    assert.ok(!encryptionStr.includes("john.doe@example.com"), "email should not appear in encryptions array");
    assert.ok(!encryptionStr.includes("123-45-6789"), "ssn should not appear in encryptions array");
  }
});

test("CryptoShreddingService.encryptRecordForSubject encrypts multiple PII fields", async () => {
  const { service } = await createServiceWithDek("user-multi");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });
  service.registerPiiField({ fieldPath: "phone", classification: "internal" });

  const record = { email: "test@test.com", phone: "555-1234", name: "Test" };
  const result = await service.encryptRecordForSubject("user-multi", record);

  assert.equal(result.encryptions.length, 2, "should have two encryptions");
  assert.notEqual(result.encryptedRecord.email, "test@test.com");
  assert.notEqual(result.encryptedRecord.phone, "555-1234");
  assert.equal(result.encryptedRecord.name, "Test");
});

test("CryptoShreddingService.encryptRecordForSubject skips missing fields", async () => {
  const { service } = await createServiceWithDek("user-skip");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { name: "Test" }; // email field missing
  const result = await service.encryptRecordForSubject("user-skip", record);

  assert.equal(result.encryptions.length, 0, "should skip missing fields");
});

test("CryptoShreddingService.encryptRecordForSubject skips empty string values", async () => {
  const { service } = await createServiceWithDek("user-empty");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { email: "", name: "Test" }; // empty email
  const result = await service.encryptRecordForSubject("user-empty", record);

  assert.equal(result.encryptions.length, 0, "should skip empty string values");
});

test("CryptoShreddingService.encryptRecordForSubject works with nested field paths", async () => {
  const { service } = await createServiceWithDek("user-nested");

  service.registerPiiField({ fieldPath: "user.email", classification: "confidential" });

  const record = { user: { email: "nested@test.com", name: "Test" } };
  const result = await service.encryptRecordForSubject("user-nested", record);

  assert.notEqual((result.encryptedRecord.user as Record<string, unknown>).email, "nested@test.com");
  assert.equal(result.encryptions.length, 1);
});

test("CryptoShreddingService.encryptRecordForSubject works with array field paths", async () => {
  const { service } = await createServiceWithDek("user-array");

  service.registerPiiField({ fieldPath: "contacts[0].email", classification: "confidential" });

  const record = { contacts: [{ email: "arr@test.com", name: "Test" }] };
  const result = await service.encryptRecordForSubject("user-array", record);

  const contacts = result.encryptedRecord.contacts as Array<Record<string, unknown>>;
  assert.notEqual(contacts[0]?.email, "arr@test.com");
  assert.equal(result.encryptions.length, 1);
});

test("CryptoShreddingService.decryptField decrypts what encryptRecordForSubject encrypted", async () => {
  const { service, dekManager } = await createServiceWithDek("user-roundtrip");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { email: "roundtrip@test.com", name: "Test" };
  const encrypted = await service.encryptRecordForSubject("user-roundtrip", record);

  const dekId = encrypted.encryptions[0]?.dekId;
  assert.ok(dekId, "should have dekId from encryption");

  const decrypted = await service.decryptField(dekId, "email", encrypted.encryptedRecord);
  assert.equal(decrypted, "roundtrip@test.com");
});

test("CryptoShreddingService.encryptRecordForSubject throws when subject has no DEK", async () => {
  const dekManager = new DekManager();
  // No DEK created for this subject
  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "email", classification: "confidential" }],
  });

  await assert.rejects(
    async () => service.encryptRecordForSubject("unknown-user", { email: "test@test.com" }),
    (err: unknown) => (err as { code?: string }).code === "dek.not_found",
  );
});