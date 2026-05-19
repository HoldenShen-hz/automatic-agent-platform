import assert from "node:assert/strict";
import test from "node:test";
import { CryptoShreddingService, InMemoryShredAuditTrail } from "../../../../../src/platform/compliance/crypto-shredding/crypto-shredding-service.js";
import { DekManager } from "../../../../../src/platform/compliance/crypto-shredding/dek-manager.js";
test("CryptoShreddingService.shred destroys DEK and returns result", async () => {
    // Create a DEK first
    const dekManager = new DekManager();
    await dekManager.createForSubject("user-123");
    // Create service with the dek manager
    const serviceWithDek = new CryptoShreddingService({ dekManager });
    const result = await serviceWithDek.shred("user-123");
    assert.ok(result.shredId.startsWith("shred_"), "Shred ID should start with shred_");
    assert.equal(result.subjectId, "user-123");
    assert.ok(result.destroyedDekId !== null, "Should have destroyed a DEK");
    assert.equal(result.status, "completed");
    assert.ok(result.shreddedAt.length > 0);
});
test("CryptoShreddingService.shred throws for empty subject ID", async () => {
    const service = new CryptoShreddingService({ dekManager: new DekManager() });
    await assert.rejects(async () => service.shred(""), (err) => err.code === "shred.missing_subject");
    await assert.rejects(async () => service.shred("   "), (err) => err.code === "shred.missing_subject");
});
test("CryptoShreddingService.shred returns no_dek_found when no DEK exists", async () => {
    const service = new CryptoShreddingService({ dekManager: new DekManager() });
    const result = await service.shred("unknown-user");
    assert.equal(result.status, "no_dek_found");
    assert.equal(result.destroyedDekId, null);
});
test("CryptoShreddingService.getShredRecord retrieves audit record", async () => {
    const dekManager = new DekManager();
    await dekManager.createForSubject("user-123");
    const service = new CryptoShreddingService({ dekManager });
    const shredResult = await service.shred("user-123");
    const record = await service.getShredRecord(shredResult.shredId);
    assert.ok(record !== null, "Should have audit record");
    assert.equal(record.subjectId, "user-123");
    assert.equal(record.destroyedDekId, shredResult.destroyedDekId);
});
test("CryptoShreddingService.getShredRecord returns null for unknown ID", async () => {
    const service = new CryptoShreddingService({ dekManager: new DekManager() });
    const record = await service.getShredRecord("unknown-shred-id");
    assert.equal(record, null);
});
test("CryptoShreddingService.getSubjectDekInfo returns DEK info", async () => {
    const dekManager = new DekManager();
    await dekManager.createForSubject("user-123");
    const service = new CryptoShreddingService({ dekManager });
    const info = await service.getSubjectDekInfo("user-123");
    assert.ok(info.activeDek !== null, "Should have active DEK");
    assert.equal(info.allDekCount, 1);
});
test("CryptoShreddingService.getSubjectDekInfo returns null for unknown subject", async () => {
    const service = new CryptoShreddingService({ dekManager: new DekManager() });
    const info = await service.getSubjectDekInfo("unknown-user");
    assert.equal(info.activeDek, null);
    assert.equal(info.allDekCount, 0);
});
test("CryptoShreddingService.encryptRecordForSubject encrypts PII fields", async () => {
    const dekManager = new DekManager();
    await dekManager.createForSubject("user-123");
    const service = new CryptoShreddingService({
        dekManager,
        piiFields: [
            { fieldPath: "email", classification: "confidential" },
            { fieldPath: "name", classification: "internal" },
        ],
    });
    const record = { email: "test@example.com", name: "Test User", other: "data" };
    const result = await service.encryptRecordForSubject("user-123", record);
    // Both email and name should be encrypted (they are in piiFields)
    assert.notEqual(result.encryptedRecord.email, "test@example.com", "Email should be encrypted");
    assert.notEqual(result.encryptedRecord.name, "Test User", "Name should be encrypted");
    assert.equal(result.encryptedRecord.other, "data", "Non-PII field should not change");
    assert.equal(result.encryptions.length, 2, "Should have two encryptions");
    assert.ok(result.encryptions.some(e => e.fieldPath === "email"));
    assert.ok(result.encryptions.some(e => e.fieldPath === "name"));
});
test("CryptoShreddingService.decryptField decrypts encrypted value", async () => {
    const dekManager = new DekManager();
    await dekManager.createForSubject("user-123");
    const service = new CryptoShreddingService({
        dekManager,
        piiFields: [{ fieldPath: "email", classification: "confidential" }],
    });
    const record = { email: "test@example.com" };
    const encrypted = await service.encryptRecordForSubject("user-123", record);
    const dekId = encrypted.encryptions[0].dekId;
    const decrypted = await service.decryptField(dekId, "email", encrypted.encryptedRecord);
    assert.equal(decrypted, "test@example.com");
});
test("CryptoShreddingService.rotateSubjectKey rotates DEK", async () => {
    const dekManager = new DekManager();
    await dekManager.createForSubject("user-123");
    const service = new CryptoShreddingService({ dekManager });
    const result = await service.rotateSubjectKey("user-123");
    assert.ok(result.previousDekId !== null, "Should have previous DEK ID");
    assert.ok(result.newDekId.startsWith("dek_"), "Should have new DEK ID");
    assert.notEqual(result.previousDekId, result.newDekId);
});
test("CryptoShreddingService.rotateSubjectKey works for subject with no DEK", async () => {
    const dekManager = new DekManager();
    const service = new CryptoShreddingService({ dekManager });
    const result = await service.rotateSubjectKey("new-user");
    assert.equal(result.previousDekId, null);
    assert.ok(result.newDekId.startsWith("dek_"));
});
test("CryptoShreddingService.registerPiiField adds PII field", async () => {
    const service = new CryptoShreddingService({ dekManager: new DekManager() });
    service.registerPiiField({ fieldPath: "email", classification: "confidential" });
    const fields = service.getPiiFields();
    assert.equal(fields.length, 1);
    assert.equal(fields[0].fieldPath, "email");
});
test("CryptoShreddingService.registerPiiField updates existing field", async () => {
    const service = new CryptoShreddingService({
        piiFields: [{ fieldPath: "email", classification: "internal" }],
    });
    service.registerPiiField({ fieldPath: "email", classification: "confidential" });
    const fields = service.getPiiFields();
    assert.equal(fields.length, 1);
    assert.equal(fields[0].classification, "confidential");
});
test("InMemoryShredAuditTrail records and retrieves audit records", async () => {
    const trail = new InMemoryShredAuditTrail();
    await trail.record({
        shredId: "shred_123",
        subjectId: "user-1",
        destroyedDekId: "dek_1",
        affectedDekCount: 1,
        shreddedAt: "2024-01-01T00:00:00.000Z",
        previousDekIds: ["dek_1"],
        requesterId: "system",
    });
    const record = await trail.getRecord("shred_123");
    assert.ok(record !== null);
    assert.equal(record.shredId, "shred_123");
    assert.equal(record.subjectId, "user-1");
});
test("InMemoryShredAuditTrail.getRecord returns null for unknown ID", async () => {
    const trail = new InMemoryShredAuditTrail();
    const record = await trail.getRecord("unknown");
    assert.equal(record, null);
});
//# sourceMappingURL=crypto-shredding-service.test.js.map