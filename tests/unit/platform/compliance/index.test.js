import assert from "node:assert/strict";
import test from "node:test";
import { 
// Orchestration services
ComplianceCaseOrchestrationService, 
// Domain services
DataLineageService, DataResidencyPolicyService, ErasurePlanningService, FieldEncryptionService, 
// Crypto-shredding classes
CryptoShreddingService, DekManager, DekStore, InMemoryShredAuditTrail, } from "../../../../src/platform/compliance/index.js";
test("platform compliance barrel exposes orchestration and support services", () => {
    assert.equal(typeof ComplianceCaseOrchestrationService, "function");
    assert.equal(typeof DataResidencyPolicyService, "function");
    assert.equal(typeof FieldEncryptionService, "function");
    assert.equal(typeof ErasurePlanningService, "function");
    assert.equal(typeof DataLineageService, "function");
});
test("platform compliance barrel exposes crypto-shredding classes", () => {
    assert.equal(typeof CryptoShreddingService, "function");
    assert.equal(typeof DekManager, "function");
    assert.equal(typeof DekStore, "function");
    assert.equal(typeof InMemoryShredAuditTrail, "function");
});
test("platform compliance barrel exports crypto-shredding types", () => {
    // DekStatus type values
    const dekStatusActive = "active";
    const dekStatusRotated = "rotated";
    const dekStatusDestroyed = "destroyed";
    assert.ok(["active", "rotated", "destroyed"].includes(dekStatusActive));
    assert.ok(["active", "rotated", "destroyed"].includes(dekStatusRotated));
    assert.ok(["active", "rotated", "destroyed"].includes(dekStatusDestroyed));
    // Type structures exist (compile-time check via typeof)
    const mockDekMetadata = {
        dekId: "dek-1",
        subjectId: "subject-1",
        algorithm: "aes-256-gcm",
        version: 1,
        iv: "abc123",
        tagLength: 16,
        createdAt: "2024-01-01T00:00:00.000Z",
        rotatedAt: null,
        destroyedAt: null,
        status: "active",
        replacedByDekId: null,
        replacesDekId: null,
    };
    assert.ok(mockDekMetadata);
    const mockShredResult = {
        shredId: "shred-1",
        subjectId: "subject-1",
        destroyedDekId: "dek-1",
        shreddedAt: "2024-01-01T00:00:00.000Z",
        status: "completed",
        affectedDekCount: 1,
    };
    assert.ok(mockShredResult);
    const mockPiiFieldSpec = {
        fieldPath: "user.email",
        classification: "confidential",
    };
    assert.ok(mockPiiFieldSpec);
    const mockEncryptResult = {
        ciphertext: "encrypted-data",
        dekId: "dek-1",
        iv: "abc123",
    };
    assert.ok(mockEncryptResult);
    const mockShredAuditRecord = {
        shredId: "shred-1",
        subjectId: "subject-1",
        destroyedDekId: "dek-1",
        affectedDekCount: 1,
        shreddedAt: "2024-01-01T00:00:00.000Z",
        previousDekIds: ["dek-1"],
        requesterId: "admin-1",
    };
    assert.ok(mockShredAuditRecord);
});
test("platform compliance barrel exports instance types", () => {
    // Verify type exports are usable
    const auditTrail = new InMemoryShredAuditTrail();
    assert.ok(auditTrail);
    const store = new DekStore();
    assert.ok(store);
    const manager = new DekManager();
    assert.ok(manager);
    const service = new CryptoShreddingService({
        dekManager: manager,
        auditTrail,
        piiFields: [],
    });
    assert.ok(service);
});
//# sourceMappingURL=index.test.js.map