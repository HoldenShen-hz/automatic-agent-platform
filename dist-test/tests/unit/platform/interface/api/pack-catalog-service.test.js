import assert from "node:assert/strict";
import test from "node:test";
import { PackCatalogService } from "../../../../../src/platform/interface/api/pack-catalog-service.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
test("PackCatalogService createPack adds entry with all fields", () => {
    const service = new PackCatalogService();
    const entry = service.createPack({
        packId: "pack_123",
        name: "My Pack",
        version: "1.0.0",
        domainId: "domain_ops",
        description: "A test pack",
        createdBy: "user@example.com",
        sandboxTier: "container",
        riskCount: 2,
        dependencyCount: 3,
        pluginCount: 1,
        toolBundleCount: 5,
    });
    assert.equal(entry.packId, "pack_123");
    assert.equal(entry.lifecycleStage, "draft");
    assert.equal(entry.sandboxTier, "container");
    assert.equal(entry.createdBy, "user@example.com");
    assert.ok(entry.createdAt.length > 0);
    assert.equal(entry.updatedAt, entry.createdAt);
});
test("PackCatalogService createPack throws ValidationError on duplicate packId", () => {
    const service = new PackCatalogService();
    service.createPack({
        packId: "pack_duplicate",
        name: "First",
        version: "1.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
    });
    assert.throws(() => service.createPack({
        packId: "pack_duplicate",
        name: "Second",
        version: "2.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
    }), (err) => err instanceof ValidationError && err.code === "pack.already_exists");
});
test("PackCatalogService getPack returns entry or null", () => {
    const service = new PackCatalogService();
    service.createPack({
        packId: "pack_get_test",
        name: "Get Test",
        version: "1.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
    });
    assert.ok(service.getPack("pack_get_test") !== null);
    assert.equal(service.getPack("pack_not_found"), null);
});
test("PackCatalogService listPacks returns sorted by createdAt descending", async () => {
    const service = new PackCatalogService();
    service.createPack({
        packId: "pack_first",
        name: "First",
        version: "1.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
    });
    // Add delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 5));
    service.createPack({
        packId: "pack_second",
        name: "Second",
        version: "1.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
    });
    const list = service.listPacks();
    // Second pack created later should appear first (descending by createdAt)
    assert.equal(list[0]?.packId, "pack_second");
    assert.equal(list[1]?.packId, "pack_first");
});
test("PackCatalogService listPacks respects limit", () => {
    const service = new PackCatalogService();
    for (let i = 0; i < 5; i++) {
        service.createPack({
            packId: `pack_list_${i}`,
            name: `Pack ${i}`,
            version: "1.0.0",
            domainId: "domain_ops",
            createdBy: "user@example.com",
        });
    }
    const list = service.listPacks(2);
    assert.equal(list.length, 2);
    assert.ok(list[0]?.packId !== list[1]?.packId);
});
test("PackCatalogService defaults sandboxTier to process when not specified", () => {
    const service = new PackCatalogService();
    const entry = service.createPack({
        packId: "pack_sandbox_default",
        name: "Sandbox Default Test",
        version: "1.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
    });
    assert.equal(entry.sandboxTier, "process");
});
//# sourceMappingURL=pack-catalog-service.test.js.map