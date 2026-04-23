import assert from "node:assert/strict";
import test from "node:test";
import { DataEncryptionKeyService } from "../../../../../src/platform/control-plane/compliance/data-encryption-key-service.js";
// Mock data
const dataEncryptionKeys = new Map();
const events = [];
function createMockStore() {
    return {
        compliance: {
            insertErasureRequest: () => { throw new Error("not implemented"); },
            getErasureRequest: () => null,
            updateErasureRequest: () => { throw new Error("not implemented"); },
            listErasureRequestsByTenant: () => [],
            listErasureRequestsByTraceId: () => [],
            insertErasureReport: () => { throw new Error("not implemented"); },
            getErasureReport: () => null,
            updateErasureReport: () => { throw new Error("not implemented"); },
            listErasureReportsByTenant: () => [],
            listErasureReportsByErasureId: () => [],
            insertDataEncryptionKey: (dek) => { dataEncryptionKeys.set(dek.keyId, dek); },
            getDataEncryptionKey: (keyId) => dataEncryptionKeys.get(keyId) ?? null,
            updateDataEncryptionKey: (dek) => { dataEncryptionKeys.set(dek.keyId, dek); },
            getActiveDataEncryptionKey: (tenantId) => {
                return Array.from(dataEncryptionKeys.values()).find(k => k.tenantId === tenantId && k.status === "active") ?? null;
            },
            listDataEncryptionKeysByTenant: (tenantId) => Array.from(dataEncryptionKeys.values()).filter(k => k.tenantId === tenantId),
            insertDataPlacement: () => { throw new Error("not implemented"); },
            listDataPlacementsByTenant: () => [],
            insertResidencyViolation: () => { throw new Error("not implemented"); },
            updateResidencyViolation: () => { throw new Error("not implemented"); },
            listResidencyViolationsByTenant: () => [],
            listAllResidencyViolations: () => [],
        },
        event: {
            insertEvent: (event) => {
                events.push(event);
            },
        },
    };
}
function createMockDb() {
    return { transaction: (fn) => fn() };
}
function resetMocks() {
    dataEncryptionKeys.clear();
    events.length = 0;
}
test("DataEncryptionKeyService.createDek creates first DEK for tenant", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "encrypted_key_data_here",
        algorithm: "AES-256-GCM",
        createdBy: "system",
    });
    assert.ok(dek.keyId.startsWith("dek_"), "Should have dek_ prefix");
    assert.equal(dek.tenantId, "tenant-123");
    assert.equal(dek.version, 1);
    assert.equal(dek.status, "active");
    assert.equal(dek.encryptedKeyMaterial, "encrypted_key_data_here");
    assert.equal(dek.algorithm, "AES-256-GCM");
    assert.ok(dek.createdAt);
    assert.equal(dek.destroyedAt, null);
});
test("DataEncryptionKeyService.createDek throws on invalid tenantId", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.createDek({
        tenantId: "",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
    }), (err) => err.code === "dek.invalid_tenant_id");
});
test("DataEncryptionKeyService.createDek throws on invalid key material", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "",
        createdBy: "system",
    }), (err) => err.code === "dek.invalid_key_material");
});
test("DataEncryptionKeyService.createDek throws on invalid createdBy", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "",
    }), (err) => err.code === "dek.invalid_created_by");
});
test("DataEncryptionKeyService.createDek rotates existing active DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    // Create first DEK
    const firstDek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "first_key_data",
        createdBy: "system",
    });
    // Create second DEK - should rotate first
    const secondDek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "second_key_data",
        createdBy: "system",
    });
    assert.equal(secondDek.version, 2);
    assert.equal(secondDek.status, "active");
    // First DEK should now be rotating
    const firstDekUpdated = service.getDek(firstDek.keyId);
    assert.equal(firstDekUpdated.status, "rotating");
});
test("DataEncryptionKeyService.rotateDek creates new version", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    // Create initial DEK
    const initialDek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "initial_key_data",
        createdBy: "system",
    });
    // Rotate DEK
    const rotatedDek = service.rotateDek({
        tenantId: "tenant-123",
        newEncryptedKeyMaterial: "new_rotated_key_data",
        rotatedBy: "rotation-service",
    });
    assert.equal(rotatedDek.version, 2);
    assert.equal(rotatedDek.status, "active");
    assert.equal(rotatedDek.encryptedKeyMaterial, "new_rotated_key_data");
    assert.equal(rotatedDek.createdBy, "rotation-service");
});
test("DataEncryptionKeyService.rotateDek throws on invalid tenantId", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.rotateDek({
        tenantId: "",
        newEncryptedKeyMaterial: "key_data",
        rotatedBy: "system",
    }), (err) => err.code === "dek.invalid_tenant_id");
});
test("DataEncryptionKeyService.rotateDek throws on invalid key material", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.rotateDek({
        tenantId: "tenant-123",
        newEncryptedKeyMaterial: "",
        rotatedBy: "system",
    }), (err) => err.code === "dek.invalid_key_material");
});
test("DataEncryptionKeyService.rotateDek throws on invalid rotatedBy", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.rotateDek({
        tenantId: "tenant-123",
        newEncryptedKeyMaterial: "key_data",
        rotatedBy: "",
    }), (err) => err.code === "dek.invalid_rotated_by");
});
test("DataEncryptionKeyService.rotateDek works with no existing active DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    // Rotate without existing DEK - should still create
    const dek = service.rotateDek({
        tenantId: "tenant-new",
        newEncryptedKeyMaterial: "new_key_for_new_tenant",
        rotatedBy: "system",
    });
    assert.equal(dek.version, 1);
    assert.equal(dek.status, "active");
});
test("DataEncryptionKeyService.destroyDek marks DEK as destroyed", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
    });
    const destroyed = service.destroyDek({
        keyId: dek.keyId,
        destroyedBy: "erasure-service",
        reason: "erasure_request",
    });
    assert.equal(destroyed.status, "destroyed");
    assert.equal(destroyed.encryptedKeyMaterial, null); // Key material cleared
    assert.ok(destroyed.destroyedAt);
    assert.equal(destroyed.destroyedBy, "erasure-service");
    assert.equal(destroyed.destructionReason, "erasure_request");
});
test("DataEncryptionKeyService.destroyDek throws on non-existent DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.destroyDek({
        keyId: "nonexistent_dek",
        destroyedBy: "system",
        reason: "test",
    }), (err) => err.code.startsWith("dek.not_found"));
});
test("DataEncryptionKeyService.destroyDek is idempotent on already destroyed", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
    });
    // First destroy
    const firstDestroy = service.destroyDek({
        keyId: dek.keyId,
        destroyedBy: "erasure-service",
        reason: "erasure_request",
    });
    // Second destroy - should return existing without error
    const secondDestroy = service.destroyDek({
        keyId: dek.keyId,
        destroyedBy: "erasure-service",
        reason: "erasure_request",
    });
    assert.equal(firstDestroy.keyId, secondDestroy.keyId);
    assert.equal(secondDestroy.status, "destroyed");
});
test("DataEncryptionKeyService.destroyAllTenantDeks destroys all DEKs", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    // Create multiple DEK versions
    const dek1 = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key1",
        createdBy: "system",
    });
    const dek2 = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key2",
        createdBy: "system",
    });
    // Destroy all
    const destroyed = service.destroyAllTenantDeks("tenant-123", "erasure-service", "tenant_erasure");
    assert.equal(destroyed.length, 2);
    assert.ok(destroyed.every(d => d.status === "destroyed"));
});
test("DataEncryptionKeyService.destroyAllTenantDeks skips already destroyed", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek1 = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key1",
        createdBy: "system",
    });
    const dek2 = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key2",
        createdBy: "system",
    });
    // Destroy first
    service.destroyDek({
        keyId: dek1.keyId,
        destroyedBy: "service",
        reason: "test",
    });
    // Destroy all
    const destroyed = service.destroyAllTenantDeks("tenant-123", "erasure-service", "tenant_erasure");
    // Only one more should be destroyed
    assert.equal(destroyed.length, 1);
});
test("DataEncryptionKeyService.getActiveDek returns active DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
    });
    const active = service.getActiveDek("tenant-123");
    assert.ok(active);
    assert.equal(active.keyId, dek.keyId);
});
test("DataEncryptionKeyService.getActiveDek returns null for no DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const active = service.getActiveDek("tenant-nonexistent");
    assert.equal(active, null);
});
test("DataEncryptionKeyService.requireActiveDek returns DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
    });
    const required = service.requireActiveDek("tenant-123");
    assert.equal(required.keyId, dek.keyId);
});
test("DataEncryptionKeyService.requireActiveDek throws when no DEK", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    assert.throws(() => service.requireActiveDek("tenant-nonexistent"), (err) => err.code.startsWith("dek.no_active_dek"));
});
test("DataEncryptionKeyService.getDek retrieves DEK by ID", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
    });
    const retrieved = service.getDek(dek.keyId);
    assert.ok(retrieved);
    assert.equal(retrieved.keyId, dek.keyId);
});
test("DataEncryptionKeyService.getDek returns null for non-existent", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const retrieved = service.getDek("nonexistent_dek");
    assert.equal(retrieved, null);
});
test("DataEncryptionKeyService.listDekVersions returns versions sorted", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "v1",
        createdBy: "system",
    });
    service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "v2",
        createdBy: "system",
    });
    service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "v3",
        createdBy: "system",
    });
    const versions = service.listDekVersions("tenant-123");
    assert.equal(versions.length, 3);
    assert.equal(versions[0].version, 3); // Newest first
    assert.equal(versions[2].version, 1); // Oldest last
});
test("DataEncryptionKeyService.getTenantDekSummary returns correct summary", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    // No DEKs
    let summary = service.getTenantDekSummary("tenant-empty");
    assert.equal(summary.totalVersions, 0);
    assert.equal(summary.activeKey, null);
    // With DEKs
    service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "v1",
        createdBy: "system",
    });
    summary = service.getTenantDekSummary("tenant-123");
    assert.equal(summary.totalVersions, 1);
    assert.ok(summary.activeKey);
    assert.equal(summary.destroyedKeys, 0);
    assert.ok(summary.oldestKeyAt);
    assert.ok(summary.newestKeyAt);
});
test("DataEncryptionKeyService.listDestroyedDeks returns destroyed keys", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    const dek1 = service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "v1",
        createdBy: "system",
    });
    service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "v2",
        createdBy: "system",
    });
    // Destroy first DEK
    service.destroyDek({
        keyId: dek1.keyId,
        destroyedBy: "service",
        reason: "test",
    });
    const destroyed = service.listDestroyedDeks("tenant-123");
    assert.equal(destroyed.length, 1);
    assert.equal(destroyed[0].version, 1);
    assert.equal(destroyed[0].status, "destroyed");
});
test("DataEncryptionKeyService emits events on create/rotate/destroy", () => {
    resetMocks();
    const mockStore = createMockStore();
    const mockDb = createMockDb();
    const service = new DataEncryptionKeyService(mockDb, mockStore);
    service.createDek({
        tenantId: "tenant-123",
        encryptedKeyMaterial: "key_data",
        createdBy: "system",
        traceId: "trace_123",
    });
    assert.ok(events.some(e => e.eventType === "dek:created"));
    service.rotateDek({
        tenantId: "tenant-123",
        newEncryptedKeyMaterial: "new_key",
        rotatedBy: "system",
        traceId: "trace_123",
    });
    assert.ok(events.some(e => e.eventType === "dek:rotated"));
    const active = service.getActiveDek("tenant-123");
    service.destroyDek({
        keyId: active.keyId,
        destroyedBy: "service",
        reason: "test",
        traceId: "trace_123",
    });
    assert.ok(events.some(e => e.eventType === "dek:destroyed"));
});
//# sourceMappingURL=data-encryption-key-service.test.js.map