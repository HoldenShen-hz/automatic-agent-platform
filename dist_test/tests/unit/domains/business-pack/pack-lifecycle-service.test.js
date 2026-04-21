import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { PackLifecycleService, } from "../../../../src/domains/business-pack/pack-lifecycle-service.js";
function createTestManifest(packId) {
    return {
        packId,
        name: `Test Pack ${packId}`,
        version: "1.0.0",
        domainId: "domain-001",
        description: "Test pack for unit testing",
        lifecycleStage: "draft",
        deprecatedAt: null,
        archivedAt: null,
        riskMatrix: [],
        toolBundles: [],
        pluginIds: [],
        dependencies: [],
        approvalPoints: [],
        artifactTypes: [],
        knowledgeNamespaces: [],
        failureStrategy: "fail_fast",
        rollbackCapability: false,
        domainMetrics: [],
        sandboxTier: "process",
        permissions: [],
        author: "test-author",
        tags: ["test"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}
describe("PackLifecycleService", () => {
    let service;
    beforeEach(() => {
        service = new PackLifecycleService();
    });
    describe("createPack", () => {
        it("should create a pack in draft state", () => {
            const manifest = createTestManifest("pack-001");
            const state = service.createPack({ manifest });
            assert.strictEqual(state.packId, "pack-001");
            assert.strictEqual(state.stage, "draft");
            assert.ok(state.createdAt);
            assert.ok(state.updatedAt);
            assert.strictEqual(state.certifiedAt, null);
            assert.strictEqual(state.deprecatedAt, null);
            assert.strictEqual(state.archivedAt, null);
        });
        it("should throw if pack already exists", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            assert.throws(() => service.createPack({ manifest }), /already exists/);
        });
    });
    describe("submitForCertification", () => {
        it("should transition from draft to certifying", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            const result = service.submitForCertification("pack-001");
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fromStage, "draft");
            assert.strictEqual(result.toStage, "certifying");
        });
        it("should reject transition from published to certifying", () => {
            const manifest = createTestManifest("pack-002");
            service.createPack({ manifest });
            service.submitForCertification("pack-002");
            service.certifyPack("pack-002", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            const result = service.submitForCertification("pack-002");
            assert.strictEqual(result.success, false);
            assert.ok(result.reason?.includes("Invalid transition"));
        });
        it("should throw if pack not found", () => {
            assert.throws(() => service.submitForCertification("nonexistent"), /not found/);
        });
    });
    describe("certifyPack", () => {
        it("should transition from certifying to published on success", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            const certResult = {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            };
            const result = service.certifyPack("pack-001", certResult);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fromStage, "certifying");
            assert.strictEqual(result.toStage, "published");
            const state = service.getPackState("pack-001");
            assert.strictEqual(state?.stage, "published");
            assert.ok(state?.certifiedAt);
        });
        it("should transition back to draft on certification failure", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            const certResult = {
                success: false,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: ["Security scan failed", "Missing approval points"],
            };
            const result = service.certifyPack("pack-001", certResult);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fromStage, "certifying");
            assert.strictEqual(result.toStage, "draft");
            assert.ok(result.reason?.includes("Certification failed"));
        });
        it("should reject certification if not in certifying stage", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            const certResult = {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            };
            const result = service.certifyPack("pack-001", certResult);
            assert.strictEqual(result.success, false);
            assert.ok(result.reason?.includes("must be in certifying stage"));
        });
    });
    describe("deprecatePack", () => {
        it("should transition from published to deprecated", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            const result = service.deprecatePack("pack-001", "Replaced by newer version");
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fromStage, "published");
            assert.strictEqual(result.toStage, "deprecated");
            const state = service.getPackState("pack-001");
            assert.strictEqual(state?.stage, "deprecated");
            assert.strictEqual(state?.deprecationReason, "Replaced by newer version");
        });
        it("should reject deprecation from draft stage", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            const result = service.deprecatePack("pack-001", "Some reason");
            assert.strictEqual(result.success, false);
            assert.ok(result.reason?.includes("Invalid transition"));
        });
    });
    describe("archivePack", () => {
        it("should transition from deprecated to archived", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            service.deprecatePack("pack-001", "End of life");
            const result = service.archivePack("pack-001");
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fromStage, "deprecated");
            assert.strictEqual(result.toStage, "archived");
            const state = service.getPackState("pack-001");
            assert.strictEqual(state?.stage, "archived");
            assert.ok(state?.archivedAt);
        });
        it("should reject any transition from archived (terminal state)", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            service.deprecatePack("pack-001", "End of life");
            service.archivePack("pack-001");
            const result = service.deprecatePack("pack-001", "Try again");
            assert.strictEqual(result.success, false);
        });
    });
    describe("reactivatePack", () => {
        it("should transition from deprecated back to published", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            service.deprecatePack("pack-001", "Temporary deprecation");
            const result = service.reactivatePack("pack-001");
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fromStage, "deprecated");
            assert.strictEqual(result.toStage, "published");
            const state = service.getPackState("pack-001");
            assert.strictEqual(state?.stage, "published");
            assert.strictEqual(state?.deprecatedAt, null);
        });
        it("should reject reactivation from draft stage", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            const result = service.reactivatePack("pack-001");
            assert.strictEqual(result.success, false);
        });
    });
    describe("getPackState", () => {
        it("should return null for non-existent pack", () => {
            const state = service.getPackState("nonexistent");
            assert.strictEqual(state, null);
        });
    });
    describe("isPackExecutable", () => {
        it("should return true for published packs", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            assert.strictEqual(service.isPackExecutable("pack-001"), true);
        });
        it("should return true for deprecated packs (still executable)", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            service.deprecatePack("pack-001", "End of life");
            assert.strictEqual(service.isPackExecutable("pack-001"), true);
        });
        it("should return false for draft packs", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            assert.strictEqual(service.isPackExecutable("pack-001"), false);
        });
        it("should return false for non-existent packs", () => {
            assert.strictEqual(service.isPackExecutable("nonexistent"), false);
        });
    });
    describe("isPackArchived", () => {
        it("should return true only for archived packs", () => {
            const manifest = createTestManifest("pack-001");
            service.createPack({ manifest });
            service.submitForCertification("pack-001");
            service.certifyPack("pack-001", {
                success: true,
                certifiedAt: new Date().toISOString(),
                certifierId: "certifier-001",
                failureReasons: [],
            });
            service.deprecatePack("pack-001", "End of life");
            service.archivePack("pack-001");
            assert.strictEqual(service.isPackArchived("pack-001"), true);
            assert.strictEqual(service.isPackArchived("nonexistent"), false);
        });
    });
    describe("listPacksByStage", () => {
        it("should list packs by stage", () => {
            const manifest1 = createTestManifest("pack-001");
            const manifest2 = createTestManifest("pack-002");
            const manifest3 = createTestManifest("pack-003");
            service.createPack({ manifest: manifest1 });
            service.createPack({ manifest: manifest2 });
            service.createPack({ manifest: manifest3 });
            const drafts = service.listPacksByStage("draft");
            assert.strictEqual(drafts.length, 3);
            service.submitForCertification("pack-001");
            const draftsAfterSubmit = service.listPacksByStage("draft");
            assert.strictEqual(draftsAfterSubmit.length, 2);
            const certifying = service.listPacksByStage("certifying");
            assert.strictEqual(certifying.length, 1);
        });
    });
    describe("listAll", () => {
        it("should list all pack states", () => {
            const manifest1 = createTestManifest("pack-001");
            const manifest2 = createTestManifest("pack-002");
            service.createPack({ manifest: manifest1 });
            service.createPack({ manifest: manifest2 });
            const all = service.listAll();
            assert.strictEqual(all.length, 2);
        });
    });
});
//# sourceMappingURL=pack-lifecycle-service.test.js.map