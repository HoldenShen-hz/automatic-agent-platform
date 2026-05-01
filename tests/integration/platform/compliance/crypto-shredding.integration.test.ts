import assert from "node:assert/strict";
import test from "node:test";

/**
 * Integration tests for crypto-shredding covering:
 * - Issue #2085: encryptRecordForSubject plaintext PII leak via originalValue
 * - Issue #2086: markRotated() deletes key making rotation destructive
 * - Issue #2094: encryptForSubject returns stale IV
 *
 * These tests verify the crypto-shredding system works end-to-end
 * and that the audit fixes are properly integrated.
 */

import { CryptoShreddingService, InMemoryShredAuditTrail } from "../../../../src/platform/compliance/crypto-shredding/index.js";
import { DekManager, DekStore } from "../../../../src/platform/compliance/crypto-shredding/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Complete crypto-shredding workflow
// ─────────────────────────────────────────────────────────────────────────────

test("Integration: Complete GDPR crypto-shredding workflow", async () => {
  const dekStore = new DekStore();
  const dekManager = new DekManager(dekStore);
  const auditTrail = new InMemoryShredAuditTrail();

  const service = new CryptoShreddingService({
    dekManager,
    auditTrail,
    piiFields: [
      { fieldPath: "email", classification: "confidential" },
      { fieldPath: "ssn", classification: "restricted" },
    ],
  });

  // Step 1: Create initial DEK for subject
  await dekManager.createForSubject("gdpr-user-123");

  // Step 2: Encrypt PII fields (Issue #2085: must not leak plaintext)
  const record = {
    email: "user@example.com",
    ssn: "123-45-6789",
    name: "Test User",
  };

  const encryptResult = await service.encryptRecordForSubject("gdpr-user-123", record);

  // Verify encryption happened without plaintext leak
  assert.notEqual(encryptResult.encryptedRecord.email, "user@example.com");
  assert.notEqual(encryptResult.encryptedRecord.ssn, "123-45-6789");
  assert.equal(encryptResult.encryptedRecord.name, "Test User");

  // Issue #2085: Verify no originalValue in encryptions
  for (const enc of encryptResult.encryptions) {
    assert.ok(!("originalValue" in enc), "must not leak plaintext via originalValue");
    assert.ok(!JSON.stringify(enc).includes("user@example.com"), "must not leak email");
    assert.ok(!JSON.stringify(enc).includes("123-45-6789"), "must not leak ssn");
  }

  // Step 3: Rotate key (Issue #2086: old data must remain recoverable)
  await service.rotateSubjectKey("gdpr-user-123");

  // Step 4: Verify old encrypted data is still decryptable
  const dekId = encryptResult.encryptions[0]?.dekId;
  assert.ok(dekId, "should have dekId from encryption");

  const decrypted = await service.decryptField(dekId, "email", encryptResult.encryptedRecord);
  assert.equal(decrypted, "user@example.com", "rotated DEK must still decrypt old data");

  // Step 5: Perform crypto-shredding (GDPR right to be forgotten)
  const shredResult = await service.shred("gdpr-user-123", "gdpr-request-456");

  assert.equal(shredResult.status, "completed");
  assert.ok(shredResult.shredId.startsWith("shred_"));
  assert.ok(shredResult.destroyedDekId, "should have destroyed DEK");

  // Step 6: Verify audit trail was created
  const auditRecord = await service.getShredRecord(shredResult.shredId);
  assert.ok(auditRecord, "audit record must exist");
  assert.equal(auditRecord?.subjectId, "gdpr-user-123");
  assert.equal(auditRecord?.requesterId, "gdpr-request-456");
  assert.ok(auditRecord?.previousDekIds.length >= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Key rotation preserves historical data access (Issue #2086)
// ─────────────────────────────────────────────────────────────────────────────

test("Integration: Key rotation preserves access to all historical data - Issue #2086", async () => {
  const manager = new DekManager();
  await manager.createForSubject("rotation-user");

  // Encrypt data with v1 DEK
  const v1Data = "version 1 data";
  const v1 = await manager.encryptForSubject("rotation-user", v1Data);

  // Rotate to v2
  await manager.rotate("rotation-user");

  // Encrypt data with v2 DEK
  const v2Data = "version 2 data";
  const v2 = await manager.encryptForSubject("rotation-user", v2Data);

  // Rotate to v3
  await manager.rotate("rotation-user");

  // Encrypt data with v3 DEK
  const v3Data = "version 3 data";
  const v3 = await manager.encryptForSubject("rotation-user", v3Data);

  // Issue #2086: All historical data must remain accessible
  assert.equal(await manager.decrypt(v1.dekId, v1.ciphertext), v1Data,
    "v1 data must be decryptable after two rotations");
  assert.equal(await manager.decrypt(v2.dekId, v2.ciphertext), v2Data,
    "v2 data must be decryptable after one rotation");
  assert.equal(await manager.decrypt(v3.dekId, v3.ciphertext), v3Data,
    "v3 data must be decryptable immediately");
});

test("Integration: Multiple subjects with independent DEKs", async () => {
  const dekManager = new DekManager();

  // Create independent DEKs for different subjects
  const subject1Result = await dekManager.createForSubject("subject-1");
  const subject2Result = await dekManager.createForSubject("subject-2");

  // Encrypt data for each subject
  const enc1 = await dekManager.encryptForSubject("subject-1", "subject-1 secret");
  const enc2 = await dekManager.encryptForSubject("subject-2", "subject-2 secret");

  // Verify independent encryption
  assert.notEqual(enc1.dekId, enc2.dekId, "different subjects should have different DEKs");
  assert.equal(await dekManager.decrypt(enc1.dekId, enc1.ciphertext), "subject-1 secret");
  assert.equal(await dekManager.decrypt(enc2.dekId, enc2.ciphertext), "subject-2 secret");

  // Shred one subject
  await dekManager.destroyForSubject("subject-1");

  // Subject 1 data should be unrecoverable
  await assert.rejects(
    async () => dekManager.decrypt(enc1.dekId, enc1.ciphertext),
    (err: unknown) => (err as { code?: string }).code === "dek.destroyed",
  );

  // Subject 2 data should still be accessible
  assert.equal(await dekManager.decrypt(enc2.dekId, enc2.ciphertext), "subject-2 secret");
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: IV verification for audit compliance (Issue #2094)
// ─────────────────────────────────────────────────────────────────────────────

test("Integration: encryptForSubject IV matches actual encryption IV - Issue #2094", async () => {
  const manager = new DekManager();
  await manager.createForSubject("iv-test-user");

  // Encrypt multiple times
  const results: Array<{ iv: string; ciphertext: string; dekId: string }> = [];

  for (let i = 0; i < 5; i++) {
    const result = await manager.encryptForSubject("iv-test-user", `data-${i}`);
    results.push(result);

    // Issue #2094: IV in result must match IV embedded in ciphertext
    const [ivFromCiphertext] = result.ciphertext.split(":");
    assert.equal(ivFromCiphertext, result.iv,
      `Issue #2094: encryption ${i} - returned IV must match ciphertext IV`);

    // Verify decrypt works with returned IV
    const decrypted = await manager.decrypt(result.dekId, result.ciphertext);
    assert.equal(decrypted, `data-${i}`, "decryption must work with returned IV");
  }

  // Each encryption should have unique IV (random)
  const uniqueIVs = new Set(results.map((r) => r.iv));
  assert.equal(uniqueIVs.size, 5, "each encryption should use unique random IV");
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Audit trail integrity
// ─────────────────────────────────────────────────────────────────────────────

test("Integration: Shred audit trail records all DEKs before destruction", async () => {
  const dekStore = new DekStore();
  const dekManager = new DekManager(dekStore);
  const auditTrail = new InMemoryShredAuditTrail();

  const service = new CryptoShreddingService({
    dekManager,
    auditTrail,
    piiFields: [],
  });

  // Create multiple DEKs via rotation
  await dekManager.createForSubject("audit-user");
  await service.rotateSubjectKey("audit-user");
  await service.rotateSubjectKey("audit-user");

  // Get all DEK IDs before shred
  const allDekRecords = await dekStore.getAllForSubject("audit-user");
  const dekIdsBeforeShred = allDekRecords.map((d: { dekId: string }) => d.dekId);

  // Perform shred
  const shredResult = await service.shred("audit-user", "auditor");

  // Verify audit record contains all previous DEK IDs
  const auditRecord = await service.getShredRecord(shredResult.shredId);
  assert.ok(auditRecord, "audit record must exist");

  // All DEKs that existed should be tracked
  assert.ok(auditRecord?.previousDekIds.length >= 3, "should track all DEKs before shred");

  for (const dekId of dekIdsBeforeShred) {
    assert.ok(auditRecord?.previousDekIds.includes(dekId), `should track DEK ${dekId}`);
  }
});

test("Integration: Double shred is handled gracefully", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("double-shred-user");

  const service = new CryptoShreddingService({ dekManager });

  // First shred
  const result1 = await service.shred("double-shred-user", "system");
  assert.equal(result1.status, "completed");

  // Second shred should be idempotent
  const result2 = await service.shred("double-shred-user", "system");
  assert.equal(result2.status, "no_dek_found", "second shred should indicate no DEK found");
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Roundtrip encryption with crypto-shredding service
// ─────────────────────────────────────────────────────────────────────────────

test("Integration: encryptRecordForSubject and decryptField roundtrip", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("roundtrip-user");

  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [
      { fieldPath: "email", classification: "confidential" },
      { fieldPath: "phone", classification: "internal" },
    ],
  });

  const originalRecord = {
    email: "roundtrip@test.com",
    phone: "555-9876",
    name: "Test Roundtrip",
  };

  // Encrypt
  const encrypted = await service.encryptRecordForSubject("roundtrip-user", originalRecord);

  // Verify PII is encrypted
  assert.notEqual(encrypted.encryptedRecord.email, originalRecord.email);
  assert.notEqual(encrypted.encryptedRecord.phone, originalRecord.phone);
  assert.equal(encrypted.encryptedRecord.name, originalRecord.name);

  // Decrypt each field
  const enc1 = encrypted.encryptions.find((e: { fieldPath: string }) => e.fieldPath === "email");
  const enc2 = encrypted.encryptions.find((e: { fieldPath: string }) => e.fieldPath === "phone");

  assert.ok(enc1, "should have encryption record for email");
  assert.ok(enc2, "should have encryption record for phone");

  const decryptedEmail = await service.decryptField(enc1.dekId, "email", encrypted.encryptedRecord);
  const decryptedPhone = await service.decryptField(enc2.dekId, "phone", encrypted.encryptedRecord);

  assert.equal(decryptedEmail, originalRecord.email);
  assert.equal(decryptedPhone, originalRecord.phone);
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("Integration: Handle subject with no DEK during encryption gracefully", async () => {
  const dekManager = new DekManager();
  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "email", classification: "confidential" }],
  });

  await assert.rejects(
    async () => service.encryptRecordForSubject("unknown-subject", { email: "test@test.com" }),
    (err: unknown) => (err as { code?: string }).code === "dek.not_found",
  );
});

test("Integration: PII fields with mixed classifications all use same DEK", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("mixed-classification-user");

  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [
      { fieldPath: "internalField", classification: "internal" },
      { fieldPath: "confidentialField", classification: "confidential" },
      { fieldPath: "restrictedField", classification: "restricted" },
    ],
  });

  const record = {
    internalField: "internal data",
    confidentialField: "confidential data",
    restrictedField: "restricted data",
    publicField: "public data",
  };

  const result = await service.encryptRecordForSubject("mixed-classification-user", record);

  // All encryptions should use the same DEK (subject's active DEK)
  const dekIds = new Set(result.encryptions.map((e: { dekId: string }) => e.dekId));
  assert.equal(dekIds.size, 1, "all classifications should use same DEK");

  // Non-PII field should not be encrypted
  assert.equal(result.encryptedRecord.publicField, "public data");
});

test("Integration: Empty record with PII fields", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("empty-record-user");

  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "email", classification: "confidential" }],
  });

  const result = await service.encryptRecordForSubject("empty-record-user", {});

  // No encryptions should happen for missing fields
  assert.equal(result.encryptions.length, 0);
});

test("Integration: Record with only non-PII fields", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("non-pii-user");

  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "email", classification: "confidential" }],
  });

  const record = { name: "Test", age: 30 };
  const result = await service.encryptRecordForSubject("non-pii-user", record);

  // No encryptions since no PII fields present in record
  assert.equal(result.encryptions.length, 0);
  // Original record should be unchanged
  assert.equal(result.encryptedRecord.name, "Test");
  assert.equal(result.encryptedRecord.age, 30);
});