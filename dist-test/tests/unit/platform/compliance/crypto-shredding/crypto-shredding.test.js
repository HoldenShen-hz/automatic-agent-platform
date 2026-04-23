import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { DekStore, DekManager, CryptoShreddingService, InMemoryShredAuditTrail, } from "../../../../../src/platform/compliance/crypto-shredding/index.js";
describe("DekStore", () => {
    let store;
    beforeEach(() => {
        store = new DekStore();
    });
    describe("create", () => {
        it("should create a new DEK for a subject", async () => {
            const result = await store.create({ subjectId: "user-123" });
            assert.ok(result.metadata.dekId);
            assert.strictEqual(result.metadata.subjectId, "user-123");
            assert.strictEqual(result.metadata.status, "active");
            assert.strictEqual(result.metadata.algorithm, "aes-256-gcm");
            assert.strictEqual(result.metadata.version, 1);
            assert.ok(result.key); // 32 bytes
        });
        it("should throw if active DEK already exists", async () => {
            await store.create({ subjectId: "user-123" });
            await assert.rejects(async () => store.create({ subjectId: "user-123" }), (error) => {
                if (error instanceof Error && "code" in error) {
                    return error.code === "dek.active_exists";
                }
                return false;
            });
        });
        it("should increment version when rotating", async () => {
            const first = await store.create({ subjectId: "user-123" });
            await store.markRotated(first.metadata.dekId, "new-dek-id");
            // Simulate new DEK with incremented version
            const newResult = await store.create({
                subjectId: "user-123",
                replacesDekId: first.metadata.dekId,
            });
            assert.strictEqual(newResult.metadata.version, 2);
        });
    });
    describe("getActiveForSubject", () => {
        it("should return the active DEK for a subject", async () => {
            const created = await store.create({ subjectId: "user-123" });
            const active = await store.getActiveForSubject("user-123");
            assert.strictEqual(active?.dekId, created.metadata.dekId);
        });
        it("should return null if no DEK exists", async () => {
            const active = await store.getActiveForSubject("nonexistent");
            assert.strictEqual(active, null);
        });
        it("should return null if DEK is destroyed", async () => {
            const created = await store.create({ subjectId: "user-123" });
            await store.destroy(created.metadata.dekId);
            const active = await store.getActiveForSubject("user-123");
            assert.strictEqual(active, null);
        });
    });
    describe("destroy", () => {
        it("should mark DEK as destroyed", async () => {
            const created = await store.create({ subjectId: "user-123" });
            await store.destroy(created.metadata.dekId);
            const metadata = await store.getMetadata(created.metadata.dekId);
            assert.strictEqual(metadata?.status, "destroyed");
            assert.ok(metadata?.destroyedAt);
        });
        it("should remove key from memory", async () => {
            const created = await store.create({ subjectId: "user-123" });
            await store.destroy(created.metadata.dekId);
            const key = await store.getKey(created.metadata.dekId);
            assert.strictEqual(key, null);
        });
        it("should be idempotent", async () => {
            const created = await store.create({ subjectId: "user-123" });
            await store.destroy(created.metadata.dekId);
            // Should not throw
            await store.destroy(created.metadata.dekId);
        });
    });
    describe("getAllForSubject", () => {
        it("should return all DEKs for a subject", async () => {
            const first = await store.create({ subjectId: "user-123" });
            await store.markRotated(first.metadata.dekId, "new-dek");
            const second = await store.create({
                subjectId: "user-123",
                replacesDekId: first.metadata.dekId,
            });
            const all = await store.getAllForSubject("user-123");
            assert.strictEqual(all.length, 2);
        });
    });
});
describe("DekManager", () => {
    let manager;
    beforeEach(() => {
        manager = new DekManager();
    });
    describe("createForSubject", () => {
        it("should create a new DEK", async () => {
            const result = await manager.createForSubject("user-123");
            assert.ok(result.metadata.dekId);
            assert.strictEqual(result.metadata.subjectId, "user-123");
            assert.ok(result.key);
        });
        it("should throw for empty subject ID", async () => {
            await assert.rejects(async () => manager.createForSubject(""), (error) => {
                if (error instanceof Error && "code" in error) {
                    return error.code === "dek.missing_subject";
                }
                return false;
            });
        });
    });
    describe("rotate", () => {
        it("should rotate an existing DEK", async () => {
            const original = await manager.createForSubject("user-123");
            const rotated = await manager.rotate("user-123");
            assert.notStrictEqual(rotated.metadata.dekId, original.metadata.dekId);
            assert.strictEqual(rotated.metadata.version, 2);
            // Original should still be accessible but marked as rotated
            const originalMeta = await manager.getStore().getMetadata(original.metadata.dekId);
            assert.strictEqual(originalMeta?.status, "rotated");
        });
    });
    describe("destroyForSubject", () => {
        it("should destroy the active DEK", async () => {
            await manager.createForSubject("user-123");
            const result = await manager.destroyForSubject("user-123");
            assert.ok(result.destroyedDekId);
            const active = await manager.getActiveDek("user-123");
            assert.strictEqual(active, null);
        });
        it("should return null if no DEK exists", async () => {
            const result = await manager.destroyForSubject("nonexistent");
            assert.strictEqual(result.destroyedDekId, null);
        });
    });
    describe("encryptForSubject and decrypt", () => {
        it("should encrypt and decrypt data successfully", async () => {
            await manager.createForSubject("user-123");
            const plaintext = "Hello, this is sensitive data!";
            const encrypted = await manager.encryptForSubject("user-123", plaintext);
            assert.ok(encrypted.ciphertext);
            assert.notStrictEqual(encrypted.ciphertext, plaintext);
            const decrypted = await manager.decrypt(encrypted.dekId, encrypted.ciphertext);
            assert.strictEqual(decrypted, plaintext);
        });
        it("should produce different ciphertext for same plaintext (due to random IV)", async () => {
            await manager.createForSubject("user-123");
            const plaintext = "Same text twice";
            const encrypted1 = await manager.encryptForSubject("user-123", plaintext);
            const encrypted2 = await manager.encryptForSubject("user-123", plaintext);
            assert.notStrictEqual(encrypted1.ciphertext, encrypted2.ciphertext);
        });
        it("should throw when DEK is destroyed", async () => {
            const created = await manager.createForSubject("user-123");
            const encrypted = await manager.encryptForSubject("user-123", "test");
            await manager.destroyForSubject("user-123");
            await assert.rejects(async () => manager.decrypt(created.metadata.dekId, encrypted.ciphertext), (error) => {
                if (error instanceof Error && "code" in error) {
                    return error.code === "dek.destroyed";
                }
                return false;
            });
        });
    });
});
describe("CryptoShreddingService", () => {
    let service;
    let auditTrail;
    beforeEach(() => {
        auditTrail = new InMemoryShredAuditTrail();
        service = new CryptoShreddingService({ auditTrail });
    });
    describe("shred", () => {
        it("should perform crypto-shredding and return result", async () => {
            // Create a DEK first
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            const result = await service.shred("user-123", "admin-001");
            assert.ok(result.shredId);
            assert.strictEqual(result.subjectId, "user-123");
            assert.strictEqual(result.status, "completed");
            assert.ok(result.destroyedDekId);
            assert.strictEqual(result.affectedDekCount, 1);
        });
        it("should return no_dek_found status if no DEK exists", async () => {
            const result = await service.shred("nonexistent-user", "admin-001");
            assert.strictEqual(result.status, "no_dek_found");
            assert.strictEqual(result.destroyedDekId, null);
        });
        it("should record audit trail", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            const shredResult = await service.shred("user-123", "admin-001");
            const auditRecord = await service.getShredRecord(shredResult.shredId);
            assert.ok(auditRecord);
            assert.strictEqual(auditRecord.subjectId, "user-123");
            assert.strictEqual(auditRecord.requesterId, "admin-001");
            assert.strictEqual(auditRecord.destroyedDekId, shredResult.destroyedDekId);
        });
        it("should destroy all DEKs for a subject", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            await manager.rotate("user-123");
            const result = await service.shred("user-123", "admin-001");
            assert.strictEqual(result.affectedDekCount, 2);
            assert.strictEqual(result.status, "completed");
        });
        it("should throw for empty subject ID", async () => {
            await assert.rejects(async () => service.shred(""), (error) => {
                if (error instanceof Error && "code" in error) {
                    return error.code === "shred.missing_subject";
                }
                return false;
            });
        });
    });
    describe("rotateSubjectKey", () => {
        it("should rotate the DEK and return both IDs", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            const result = await service.rotateSubjectKey("user-123");
            assert.ok(result.previousDekId);
            assert.ok(result.newDekId);
            assert.notStrictEqual(result.previousDekId, result.newDekId);
        });
    });
    describe("getSubjectDekInfo", () => {
        it("should return DEK information for a subject", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            await manager.rotate("user-123");
            const info = await service.getSubjectDekInfo("user-123");
            assert.ok(info.activeDek);
            assert.strictEqual(info.allDekCount, 2);
        });
        it("should return null active DEK for nonexistent subject", async () => {
            const info = await service.getSubjectDekInfo("nonexistent");
            assert.strictEqual(info.activeDek, null);
            assert.strictEqual(info.allDekCount, 0);
        });
    });
    describe("encryptRecordForSubject", () => {
        beforeEach(() => {
            service.registerPiiField({ fieldPath: "name", classification: "confidential" });
            service.registerPiiField({ fieldPath: "email", classification: "restricted" });
        });
        it("should encrypt specified PII fields", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            const record = {
                name: "John Doe",
                email: "john@example.com",
                age: 30,
            };
            const result = await service.encryptRecordForSubject("user-123", record);
            assert.notStrictEqual(result.encryptedRecord.name, "John Doe");
            assert.notStrictEqual(result.encryptedRecord.email, "john@example.com");
            assert.strictEqual(result.encryptedRecord.age, 30); // Not a PII field
            assert.strictEqual(result.encryptions.length, 2);
        });
        it("should preserve non-string fields", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            const record = {
                name: "John Doe",
                age: 30,
                active: true,
                scores: [100, 95, 88],
            };
            const result = await service.encryptRecordForSubject("user-123", record);
            assert.strictEqual(result.encryptedRecord.age, 30);
            assert.deepStrictEqual(result.encryptedRecord.scores, [100, 95, 88]);
            assert.strictEqual(result.encryptedRecord.active, true);
        });
    });
    describe("decryptField", () => {
        it("should decrypt an encrypted field", async () => {
            const manager = service["dekManager"];
            await manager.createForSubject("user-123");
            const record = {
                name: "John Doe",
            };
            service.registerPiiField({ fieldPath: "name", classification: "confidential" });
            // First encrypt
            const encryptResult = await service.encryptRecordForSubject("user-123", record);
            // Then decrypt
            const dekId = encryptResult.encryptions[0].dekId;
            const decrypted = await service.decryptField(dekId, "name", encryptResult.encryptedRecord);
            assert.strictEqual(decrypted, "John Doe");
        });
    });
});
describe("InMemoryShredAuditTrail", () => {
    let trail;
    beforeEach(() => {
        trail = new InMemoryShredAuditTrail();
    });
    describe("record and getRecord", () => {
        it("should record and retrieve audit records", async () => {
            await trail.record({
                shredId: "shred-001",
                subjectId: "user-123",
                destroyedDekId: "dek-001",
                affectedDekCount: 1,
                shreddedAt: "2024-01-01T00:00:00.000Z",
                previousDekIds: ["dek-001"],
                requesterId: "admin-001",
            });
            const record = await trail.getRecord("shred-001");
            assert.ok(record);
            assert.strictEqual(record.shredId, "shred-001");
            assert.strictEqual(record.subjectId, "user-123");
        });
        it("should return null for nonexistent record", async () => {
            const record = await trail.getRecord("nonexistent");
            assert.strictEqual(record, null);
        });
    });
});
//# sourceMappingURL=crypto-shredding.test.js.map