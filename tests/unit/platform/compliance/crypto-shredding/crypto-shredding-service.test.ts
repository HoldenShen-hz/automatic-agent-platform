import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for crypto-shredding-service covering audit fixes:
 * - Issue #2085: encryptRecordForSubject returns plaintext PII in encryptions array (originalValue)
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

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2085: encryptRecordForSubject must NOT leak plaintext PII
// ─────────────────────────────────────────────────────────────────────────────

test("Issue #2085: encryptRecordForSubject encryptions array must NOT contain originalValue (plaintext PII)", async () => {
  const { service } = await createServiceWithDek("user-2085");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });
  service.registerPiiField({ fieldPath: "ssn", classification: "restricted" });
  service.registerPiiField({ fieldPath: "phone", classification: "internal" });

  const record = {
    email: "john.doe@confidential.com",
    ssn: "999-88-7777",
    phone: "555-1234",
    name: "John Doe", // non-PII
  };

  const result = await service.encryptRecordForSubject("user-2085", record);

  // Verify PII fields ARE encrypted (ciphertext, not plaintext)
  assert.notEqual(result.encryptedRecord.email, "john.doe@confidential.com", "email must be encrypted");
  assert.notEqual(result.encryptedRecord.ssn, "999-88-7777", "ssn must be encrypted");
  assert.notEqual(result.encryptedRecord.phone, "555-1234", "phone must be encrypted");
  assert.equal(result.encryptedRecord.name, "John Doe", "non-PII field must remain unchanged");

  // CRITICAL: The encryptions array must NOT leak plaintext PII
  // Issue #2085: originalValue would expose plaintext via logs, audit trails, etc.
  for (const encryption of result.encryptions) {
    assert.ok("fieldPath" in encryption, "encryptions must have fieldPath");
    assert.ok("dekId" in encryption, "encryptions must have dekId for audit trail");

    // originalValue must NOT be present - this is the PII leak
    assert.ok(!("originalValue" in encryption),
      "Issue #2085: encryptions must NOT have originalValue - exposes plaintext PII via logs/storage");

    // Double-check: plaintext PII must not appear anywhere in encryption records
    const encStr = JSON.stringify(encryption);
    assert.ok(!encStr.includes("john.doe@confidential.com"), "email PII must not leak into encryption record");
    assert.ok(!encStr.includes("999-88-7777"), "ssn PII must not leak into encryption record");
    assert.ok(!encStr.includes("555-1234"), "phone PII must not leak into encryption record");
  }
});

test("Issue #2085: Verify no plaintext PII in encryptions even with high-entropy data", async () => {
  const { service } = await createServiceWithDek("user-entropy");

  service.registerPiiField({ fieldPath: "creditCard", classification: "restricted" });
  service.registerPiiField({ fieldPath: "password", classification: "restricted" });

  const record = {
    creditCard: "4532-1234-5678-9012",
    password: "super_secret_password_123!",
  };

  const result = await service.encryptRecordForSubject("user-entropy", record);

  for (const encryption of result.encryptions) {
    assert.ok(!("originalValue" in encryption), "Issue #2085: must not leak credit card or password");
    const encStr = JSON.stringify(encryption);
    assert.ok(!encStr.includes("4532-1234-5678-9012"), "credit card must not appear in encryption record");
    assert.ok(!encStr.includes("super_secret_password"), "password must not appear in encryption record");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic functionality tests
// ─────────────────────────────────────────────────────────────────────────────

test("CryptoShreddingService.encryptRecordForSubject encrypts PII fields", async () => {
  const { service } = await createServiceWithDek("user-basic");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { email: "test@example.com", name: "Test" };
  const result = await service.encryptRecordForSubject("user-basic", record);

  assert.notEqual(result.encryptedRecord.email, "test@example.com");
  assert.equal(result.encryptedRecord.name, "Test");
  assert.equal(result.encryptions.length, 1);
  assert.equal(result.encryptions[0]?.fieldPath, "email");
});

test("CryptoShreddingService.encryptRecordForSubject skips missing fields", async () => {
  const { service } = await createServiceWithDek("user-missing");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });
  service.registerPiiField({ fieldPath: "nonexistent", classification: "internal" });

  const record = { name: "Test" }; // email is missing
  const result = await service.encryptRecordForSubject("user-missing", record);

  assert.equal(result.encryptions.length, 0);
});

test("CryptoShreddingService.encryptRecordForSubject skips empty string values", async () => {
  const { service } = await createServiceWithDek("user-empty");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { email: "", name: "Test" };
  const result = await service.encryptRecordForSubject("user-empty", record);

  assert.equal(result.encryptions.length, 0);
  assert.equal(result.encryptedRecord.email, "");
});

test("CryptoShreddingService.encryptRecordForSubject handles nested field paths", async () => {
  const { service } = await createServiceWithDek("user-nested");

  service.registerPiiField({ fieldPath: "user.email", classification: "confidential" });

  const record = { user: { email: "nested@test.com", name: "Test" } };
  const result = await service.encryptRecordForSubject("user-nested", record);

  const user = result.encryptedRecord.user as Record<string, unknown>;
  assert.notEqual(user.email, "nested@test.com");
  assert.equal(result.encryptions.length, 1);
});

test("CryptoShreddingService.encryptRecordForSubject handles array field paths", async () => {
  const { service } = await createServiceWithDek("user-array");

  service.registerPiiField({ fieldPath: "contacts[0].email", classification: "confidential" });

  const record = { contacts: [{ email: "array@test.com", name: "Test" }] };
  const result = await service.encryptRecordForSubject("user-array", record);

  const contacts = result.encryptedRecord.contacts as Array<Record<string, unknown>>;
  assert.notEqual(contacts[0]?.email, "array@test.com");
  assert.equal(result.encryptions.length, 1);
});

test("CryptoShreddingService.decryptField roundtrips what encryptRecordForSubject encrypts", async () => {
  const { service, dekManager } = await createServiceWithDek("user-roundtrip");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { email: "roundtrip@test.com" };
  const encrypted = await service.encryptRecordForSubject("user-roundtrip", record);

  const dekId = encrypted.encryptions[0]?.dekId;
  assert.ok(dekId, "should have dekId from encryption");

  const decrypted = await service.decryptField(dekId, "email", encrypted.encryptedRecord);
  assert.equal(decrypted, "roundtrip@test.com");
});

test("CryptoShreddingService.encryptRecordForSubject throws when subject has no DEK", async () => {
  const dekManager = new DekManager();
  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "email", classification: "confidential" }],
  });

  await assert.rejects(
    async () => service.encryptRecordForSubject("unknown-user", { email: "test@test.com" }),
    (err: unknown) => (err as { code?: string }).code === "dek.not_found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Shred operation tests
// ─────────────────────────────────────────────────────────────────────────────

test("CryptoShreddingService.shred destroys all DEKs for subject", async () => {
  const { service, dekManager } = await createServiceWithDek("user-shred");

  // Create multiple DEKs via rotation
  await service.rotateSubjectKey("user-shred");
  await service.rotateSubjectKey("user-shred");

  const infoBefore = await service.getSubjectDekInfo("user-shred");
  assert.ok(infoBefore.allDekCount >= 2, "should have multiple DEKs before shred");

  const result = await service.shred("user-shred", "admin");

  assert.ok(result.shredId.startsWith("shred_"));
  assert.equal(result.subjectId, "user-shred");
  assert.ok(result.destroyedDekId, "should have destroyed a DEK");
  assert.equal(result.status, "completed");
  assert.ok(result.affectedDekCount >= 1);

  // Audit trail should be recorded
  const auditRecord = await service.getShredRecord(result.shredId);
  assert.ok(auditRecord, "shred operation should be recorded");
  assert.equal(auditRecord?.subjectId, "user-shred");
  assert.deepEqual(auditRecord?.previousDekIds, result.previousDekIds ?? []);
});

test("CryptoShreddingService.shred handles subject with no DEK", async () => {
  const dekManager = new DekManager();
  const service = new CryptoShreddingService({ dekManager });

  const result = await service.shred("user-no-dek", "admin");

  assert.equal(result.status, "no_dek_found");
  assert.equal(result.destroyedDekId, null);
});

test("CryptoShreddingService.shred rejects empty subjectId", async () => {
  const { service } = await createServiceWithDek("user-valid");

  await assert.rejects(
    async () => service.shred("", "admin"),
    (err: unknown) => (err as { code?: string }).code === "shred.missing_subject",
  );

  await assert.rejects(
    async () => service.shred("   ", "admin"),
    (err: unknown) => (err as { code?: string }).code === "shred.missing_subject",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Key rotation tests
// ─────────────────────────────────────────────────────────────────────────────

test("CryptoShreddingService.rotateSubjectKey creates new DEK and marks old as rotated", async () => {
  const { service, dekManager } = await createServiceWithDek("user-rotate");

  const infoBefore = await service.getSubjectDekInfo("user-rotate");
  const firstDekId = infoBefore.activeDek?.dekId;

  const rotateResult = await service.rotateSubjectKey("user-rotate");

  assert.ok(rotateResult.newDekId, "should have new DEK ID");
  assert.notEqual(rotateResult.newDekId, firstDekId ?? null, "new DEK should be different");

  const infoAfter = await service.getSubjectDekInfo("user-rotate");
  assert.equal(infoAfter.activeDek?.dekId, rotateResult.newDekId);
  assert.ok(infoAfter.allDekCount >= 2, "should have multiple DEKs after rotation");
});

test("CryptoShreddingService.rotateSubjectKey allows decrypting data with rotated DEK", async () => {
  const { service } = await createServiceWithDek("user-decrypt-rotated");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const record = { email: "before-rotation@test.com" };
  const encrypted = await service.encryptRecordForSubject("user-decrypt-rotated", record);

  // Rotate key
  await service.rotateSubjectKey("user-decrypt-rotated");

  // Should still be able to decrypt data encrypted before rotation
  const dekId = encrypted.encryptions[0]?.dekId;
  const decrypted = await service.decryptField(dekId, "email", encrypted.encryptedRecord);
  assert.equal(decrypted, "before-rotation@test.com");
});

// ─────────────────────────────────────────────────────────────────────────────
// PII field registration tests
// ─────────────────────────────────────────────────────────────────────────────

test("CryptoShreddingService.registerPiiField adds new field", async () => {
  const { service } = await createServiceWithDek("user-register");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });
  service.registerPiiField({ fieldPath: "phone", classification: "internal" });

  const fields = service.getPiiFields();
  assert.equal(fields.length, 2);
  assert.ok(fields.some((f) => f.fieldPath === "email"));
  assert.ok(fields.some((f) => f.fieldPath === "phone"));
});

test("CryptoShreddingService.registerPiiField updates existing field", async () => {
  const { service } = await createServiceWithDek("user-update");

  service.registerPiiField({ fieldPath: "email", classification: "confidential" });
  service.registerPiiField({ fieldPath: "email", classification: "restricted" });

  const fields = service.getPiiFields();
  assert.equal(fields.length, 1);
  assert.equal(fields[0]?.classification, "restricted");
});

test("CryptoShreddingService.getSubjectDekInfo returns DEK information", async () => {
  const { service, dekManager } = await createServiceWithDek("user-info");

  const info = await service.getSubjectDekInfo("user-info");

  assert.ok(info.activeDek, "should have active DEK");
  assert.ok(info.activeDek?.dekId.startsWith("dek_"));
  assert.equal(info.activeDek?.subjectId, "user-info");
  assert.equal(info.activeDek?.status, "active");
  assert.ok(info.allDekCount >= 1);
});