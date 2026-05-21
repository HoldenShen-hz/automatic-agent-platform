import assert from "node:assert/strict";
import test from "node:test";

import { CryptoShreddingService } from "../../../../../src/platform/compliance/crypto-shredding/crypto-shredding-service.js";
import { DekManager } from "../../../../../src/platform/compliance/crypto-shredding/dek-manager.js";
import { InMemoryShredAuditTrail } from "../../../../../src/platform/compliance/crypto-shredding/crypto-shredding-service.js";

test("CryptoShreddingService shred records audit trail for destroyed DEK", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user_audit_test");
  const auditTrail = new InMemoryShredAuditTrail();

  const service = new CryptoShreddingService({ dekManager, auditTrail });
  const result = await service.shred("user_audit_test", "admin_123");

  assert.ok(result.shredId.startsWith("shred_"));
  assert.equal(result.subjectId, "user_audit_test");
  assert.equal(result.status, "completed");

  const record = await auditTrail.getRecord(result.shredId);
  assert.ok(record !== null);
  assert.equal(record!.subjectId, "user_audit_test");
  assert.equal(record!.requesterId, "admin_123");
});

test("CryptoShreddingService shred affects all DEKs for subject", async () => {
  const dekManager = new DekManager();
  // Create initial DEK
  await dekManager.createForSubject("user_multi_dek");
  // Rotate to create second DEK
  await dekManager.rotate("user_multi_dek");
  // Rotate again to create third DEK
  await dekManager.rotate("user_multi_dek");

  const service = new CryptoShreddingService({ dekManager });
  const result = await service.shred("user_multi_dek");

  assert.equal(result.affectedDekCount, 3);
  assert.equal(result.status, "completed");
});

test("CryptoShreddingService encryptRecordForSubject with multiple fields", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user_multi_field");

  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [
      { fieldPath: "name", classification: "internal" },
      { fieldPath: "email", classification: "confidential" },
      { fieldPath: "ssn", classification: "restricted" },
      { fieldPath: "address.street", classification: "confidential" },
    ],
  });

  const record = {
    name: "Alice Smith",
    email: "alice@example.com",
    ssn: "123-45-6789",
    address: { street: "123 Main St", city: "Boston" },
    age: 30,
  };

  const result = await service.encryptRecordForSubject("user_multi_field", record);

  assert.equal(result.encryptions.length, 4);
  const enc = result.encryptedRecord as Record<string, unknown>;
  assert.notEqual(enc.name, "Alice Smith");
  assert.notEqual(enc.email, "alice@example.com");
  assert.notEqual(enc.ssn, "123-45-6789");
  assert.notEqual((enc.address as Record<string, unknown>).street, "123 Main St");
  assert.equal(enc.age, 30);
});

test("CryptoShreddingService encryptRecordForSubject with no PII fields configured throws", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user_no_pii");

  const service = new CryptoShreddingService({ dekManager });

  await assert.rejects(
    async () => service.encryptRecordForSubject("user_no_pii", { name: "test" }),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "encrypt.no_pii_fields_configured";
      }
      return false;
    },
  );
});

test("DekManager encryptForSubject and decrypt roundtrip", async () => {
  const manager = new DekManager();
  await manager.createForSubject("user_roundtrip");

  const original = "sensitive data with special chars: !@#$%^&*()";
  const encrypted = await manager.encryptForSubject("user_roundtrip", original);
  const decrypted = await manager.decrypt(encrypted.dekId, encrypted.ciphertext);

  assert.equal(decrypted, original);
});

test("CryptoShreddingService rotateSubjectKey preserves old DEK for decryption", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user_rotate");

  const service = new CryptoShreddingService({ dekManager });
  const originalDek = (await dekManager.getActiveDek("user_rotate"))!;

  // Encrypt something with original DEK
  service.registerPiiField({ fieldPath: "data", classification: "confidential" });
  const record = { data: "original data" };
  const encrypted = await service.encryptRecordForSubject("user_rotate", record);

  // Rotate the key
  const rotation = await service.rotateSubjectKey("user_rotate");
  assert.notEqual(rotation.previousDekId, rotation.newDekId);

  // Old DEK should still be able to decrypt data encrypted before rotation
  const newDek = await dekManager.getActiveDek("user_rotate");
  assert.notEqual(newDek!.dekId, originalDek.dekId);
});

test("CryptoShreddingService encryptRecordForSubject with array fields", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user_array");

  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "items[0].content", classification: "confidential" }],
  });

  const record = {
    items: [
      { content: "first item secret" },
      { content: "second item secret" },
    ],
  };

  const result = await service.encryptRecordForSubject("user_array", record);

  assert.equal(result.encryptions.length, 1);
  const arr = result.encryptedRecord.items as Array<{ content: string }>;
  assert.notEqual(arr[0]!.content, "first item secret");
  assert.equal(arr[1]!.content, "second item secret");
});

test("CryptoShreddingService getSubjectDekInfo returns all DEK metadata", async () => {
  const dekManager = new DekManager();
  await dekManager.createForSubject("user_info");

  const service = new CryptoShreddingService({ dekManager });

  const info1 = await service.getSubjectDekInfo("user_info");
  assert.ok(info1.activeDek !== null);
  assert.equal(info1.allDekCount, 1);

  await dekManager.rotate("user_info");
  await dekManager.rotate("user_info");

  const info2 = await service.getSubjectDekInfo("user_info");
  assert.ok(info2.activeDek !== null);
  assert.equal(info2.allDekCount, 3);
});

test("CryptoShreddingService getShredRecord returns null for unknown ID", async () => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });

  const record = await service.getShredRecord("nonexistent_shred_id");
  assert.equal(record, null);
});

test("InMemoryShredAuditTrail handles concurrent writes", async () => {
  const trail = new InMemoryShredAuditTrail();

  const records = Array.from({ length: 100 }, (_, i) => ({
    shredId: `shred_${i}`,
    subjectId: `subject_${i}`,
    destroyedDekId: `dek_${i}`,
    affectedDekCount: 1,
    shreddedAt: new Date().toISOString(),
    previousDekIds: [`dek_${i}`],
    requesterId: "admin",
  }));

  await Promise.all(records.map((r) => trail.record(r)));

  for (let i = 0; i < 100; i++) {
    const record = await trail.getRecord(`shred_${i}`);
    assert.ok(record !== null);
    assert.equal(record!.subjectId, `subject_${i}`);
  }
});

test("CryptoShreddingService registerPiiField handles updates", async () => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });

  service.registerPiiField({ fieldPath: "email", classification: "internal" });
  service.registerPiiField({ fieldPath: "phone", classification: "internal" });
  service.registerPiiField({ fieldPath: "email", classification: "confidential" });

  const fields = service.getPiiFields();
  assert.equal(fields.length, 2);
  const emailField = fields.find((f) => f.fieldPath === "email");
  assert.ok(emailField);
  assert.equal(emailField!.classification, "confidential");
});

test("CryptoShreddingService throws for missing subject on encryptRecordForSubject", async () => {
  const dekManager = new DekManager();
  const service = new CryptoShreddingService({
    dekManager,
    piiFields: [{ fieldPath: "name", classification: "internal" }],
  });

  // No DEK created for this subject
  await assert.rejects(
    async () => service.encryptRecordForSubject("unknown_subject", { name: "test" }),
    (err: unknown) => err instanceof Error && err.message.includes("No active DEK"),
  );
});