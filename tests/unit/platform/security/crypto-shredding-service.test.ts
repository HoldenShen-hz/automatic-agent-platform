import assert from "node:assert/strict";
import test from "node:test";

import {
  CryptoShreddingService,
  InMemoryShredAuditTrail,
  type PiiFieldSpec,
  type ShredResult,
  type EncryptRecordResult,
} from "../../../../src/platform/compliance/crypto-shredding/crypto-shredding-service.js";
import { DekManager } from "../../../../src/platform/compliance/crypto-shredding/dek-manager.js";

test("InMemoryShredAuditTrail records and retrieves audit records", async (t) => {
  const trail = new InMemoryShredAuditTrail();
  await trail.record({
    shredId: "shred-1",
    subjectId: "user-1",
    destroyedDekId: "dek-1",
    affectedDekCount: 1,
    shreddedAt: "2025-01-01T00:00:00Z",
    previousDekIds: ["dek-1"],
    requesterId: "admin",
  });

  const record = await trail.getRecord("shred-1");
  assert.ok(record);
  assert.equal(record!.shredId, "shred-1");
  assert.equal(record!.subjectId, "user-1");
  assert.equal(record!.destroyedDekId, "dek-1");
});

test("InMemoryShredAuditTrail.getRecord returns null for unknown shredId", async (t) => {
  const trail = new InMemoryShredAuditTrail();
  const record = await trail.getRecord("unknown");
  assert.equal(record, null);
});

test("CryptoShreddingService.shred destroys subject DEK and returns ShredResult", async (t) => {
  const manager = new DekManager();
  const service = new CryptoShreddingService({ dekManager: manager });
  const result = await service.shred("subject-1", "admin");

  assert.ok(result.shredId.length > 0);
  assert.equal(result.subjectId, "subject-1");
  assert.equal(result.status, "no_dek_found");
  assert.equal(result.destroyedDekId, null);
  assert.equal(result.affectedDekCount, 0);
});

test("CryptoShreddingService.shred creates audit record", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-2");
  const service = new CryptoShreddingService({ dekManager: manager });
  const result = await service.shred("subject-2", "admin");

  assert.equal(result.status, "completed");
  assert.ok(result.destroyedDekId);
  assert.equal(result.affectedDekCount, 1);

  const record = await service.getShredRecord(result.shredId);
  assert.ok(record);
  assert.equal(record!.subjectId, "subject-2");
  assert.equal(record!.requesterId, "admin");
});

test("CryptoShreddingService.shred throws on empty subjectId", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  await assert.rejects(
    async () => service.shred("", "admin"),
    (err: unknown) => (err as { code: string }).code === "shred.missing_subject",
  );
  await assert.rejects(
    async () => service.shred("   ", "admin"),
    (err: unknown) => (err as { code: string }).code === "shred.missing_subject",
  );
});

test("CryptoShreddingService.getShredRecord returns null for unknown shred", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  const record = await service.getShredRecord("unknown");
  assert.equal(record, null);
});

test("CryptoShreddingService.getSubjectDekInfo returns DEK info", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-3");
  const service = new CryptoShreddingService({ dekManager: manager });

  const info = await service.getSubjectDekInfo("subject-3");
  assert.ok(info.activeDek);
  assert.equal(info.allDekCount, 1);
});

test("CryptoShreddingService.getSubjectDekInfo returns null for unknown subject", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  const info = await service.getSubjectDekInfo("unknown");
  assert.equal(info.activeDek, null);
  assert.equal(info.allDekCount, 0);
});

test("CryptoShreddingService.encryptRecordForSubject encrypts configured PII fields", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-4");
  const service = new CryptoShreddingService({ dekManager: manager });
  service.registerPiiField({ fieldPath: "name", classification: "internal" });

  const record = { name: "Alice", email: "alice@example.com" };
  const result = await service.encryptRecordForSubject("subject-4", record);

  assert.notEqual(result.encryptedRecord.name, "Alice");
  assert.equal((result.encryptedRecord as { email: string }).email, "alice@example.com");
  assert.equal(result.encryptions.length, 1);
  assert.equal(result.encryptions[0]!.fieldPath, "name");
});

test("CryptoShreddingService.encryptRecordForSubject throws when no PII fields configured", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  await assert.rejects(
    async () => service.encryptRecordForSubject("subject-5", { name: "Bob" }),
    (err: unknown) => (err as { code: string }).code === "encrypt.no_pii_fields_configured",
  );
});

test("CryptoShreddingService.encryptRecordForSubject skips non-string values", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-6");
  const service = new CryptoShreddingService({ dekManager: manager });
  service.registerPiiField({ fieldPath: "name", classification: "internal" });
  service.registerPiiField({ fieldPath: "age", classification: "internal" });

  const record = { name: "Carol", age: 30 };
  const result = await service.encryptRecordForSubject("subject-6", record);

  assert.equal(result.encryptions.length, 1); // age is number, skipped
  assert.equal((result.encryptedRecord as { age: number }).age, 30);
});

test("CryptoShreddingService.encryptRecordForSubject handles nested fields", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-7");
  const service = new CryptoShreddingService({ dekManager: manager });
  service.registerPiiField({ fieldPath: "user.name", classification: "internal" });

  const record = { user: { name: "Dave", email: "dave@example.com" } };
  const result = await service.encryptRecordForSubject("subject-7", record);

  const rec = result.encryptedRecord as { user: { name: string } };
  assert.notEqual(rec.user.name, "Dave");
  assert.equal((rec.user as unknown as { email: string }).email, "dave@example.com");
});

test("CryptoShreddingService.encryptRecordForSubject handles array fields", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-8");
  const service = new CryptoShreddingService({ dekManager: manager });
  service.registerPiiField({ fieldPath: "items[0]", classification: "internal" });

  const record = { items: ["alpha", "beta"] };
  const result = await service.encryptRecordForSubject("subject-8", record);

  const arr = result.encryptedRecord as { items: string[] };
  assert.notEqual(arr.items[0], "alpha");
  assert.equal(arr.items[1], "beta");
});

test("CryptoShreddingService.decryptField decrypts encrypted field", async (t) => {
  const manager = new DekManager();
  await manager.createForSubject("subject-9");
  const service = new CryptoShreddingService({ dekManager: manager });
  service.registerPiiField({ fieldPath: "name", classification: "internal" });

  const record = { name: "Eve" };
  const encrypted = await service.encryptRecordForSubject("subject-9", record);
  const dekId = encrypted.encryptions[0]!.dekId;

  const decrypted = await service.decryptField(dekId, "name", encrypted.encryptedRecord);
  assert.equal(decrypted, "Eve");
});

test("CryptoShreddingService.decryptField throws on non-string value", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  await assert.rejects(
    async () => service.decryptField("dek-id", "age", { age: 25 }),
    (err: unknown) => (err as { code: string }).code === "decrypt.invalid_value",
  );
});

test("CryptoShreddingService.rotateSubjectKey rotates DEK and returns IDs", async (t) => {
  const manager = new DekManager();
  const first = await manager.createForSubject("subject-10");
  const service = new CryptoShreddingService({ dekManager: manager });

  const result = await service.rotateSubjectKey("subject-10");

  assert.equal(result.previousDekId, first.metadata.dekId);
  assert.ok(result.newDekId.length > 0);
  assert.notEqual(result.newDekId, first.metadata.dekId);
});

test("CryptoShreddingService.rotateSubjectKey handles first-time creation", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  const result = await service.rotateSubjectKey("new-subject");

  assert.equal(result.previousDekId, null);
  assert.ok(result.newDekId.length > 0);
});

test("CryptoShreddingService.registerPiiField registers and updates field specs", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  service.registerPiiField({ fieldPath: "name", classification: "internal" });
  service.registerPiiField({ fieldPath: "name", classification: "confidential" });
  service.registerPiiField({ fieldPath: "email", classification: "restricted" });

  const fields = service.getPiiFields();
  assert.equal(fields.length, 2);
  const nameField = fields.find((f) => f.fieldPath === "name");
  assert.equal(nameField?.classification, "confidential");
});

test("CryptoShreddingService.getPiiFields returns registered fields", async (t) => {
  const service = new CryptoShreddingService({ dekManager: new DekManager() });
  service.registerPiiField({ fieldPath: "name", classification: "internal" });

  const fields = service.getPiiFields();
  assert.equal(fields.length, 1);
  assert.equal(fields[0]!.fieldPath, "name");
});
