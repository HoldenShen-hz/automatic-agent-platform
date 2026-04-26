import assert from "node:assert/strict";
import test from "node:test";

import { PackCatalogService } from "../../../../src/platform/interface/api/pack-catalog-service.js";

test("PackCatalogService.createPack creates a new pack", () => {
  const service = new PackCatalogService();
  const pack = service.createPack({
    packId: "pack_001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_123",
  });

  assert.equal(pack.packId, "pack_001");
  assert.equal(pack.name, "Test Pack");
  assert.equal(pack.version, "1.0.0");
  assert.equal(pack.domainId, "domain_test");
  assert.equal(pack.lifecycleStage, "draft");
  assert.equal(pack.sandboxTier, "process");
  assert.equal(pack.createdBy, "user_123");
});

test("PackCatalogService.createPack throws on duplicate packId", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack_001",
    name: "First Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_123",
  });

  assert.throws(
    () => service.createPack({
      packId: "pack_001",
      name: "Second Pack",
      version: "2.0.0",
      domainId: "domain_test",
      createdBy: "user_456",
    }),
    (err: any) => err.code === "pack.already_exists"
  );
});

test("PackCatalogService.getPack returns pack by id", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack_001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_123",
  });

  const pack = service.getPack("pack_001");
  assert.ok(pack);
  assert.equal(pack!.packId, "pack_001");
});

test("PackCatalogService.getPack returns null for unknown id", () => {
  const service = new PackCatalogService();
  const pack = service.getPack("nonexistent");
  assert.equal(pack, null);
});

test("PackCatalogService.listPacks returns all packs sorted by createdAt desc", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack_first",
    name: "First",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_123",
  });
  service.createPack({
    packId: "pack_second",
    name: "Second",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_123",
  });

  const packs = service.listPacks();
  assert.equal(packs.length, 2);
  assert.equal(packs[0].packId, "pack_second");
  assert.equal(packs[1].packId, "pack_first");
});

test("PackCatalogService.listPacks respects limit", () => {
  const service = new PackCatalogService();
  for (let i = 0; i < 10; i++) {
    service.createPack({
      packId: `pack_${i}`,
      name: `Pack ${i}`,
      version: "1.0.0",
      domainId: "domain_test",
      createdBy: "user_123",
    });
  }

  const packs = service.listPacks(5);
  assert.equal(packs.length, 5);
});

test("PackCatalogService.createPack accepts optional fields", () => {
  const service = new PackCatalogService();
  const pack = service.createPack({
    packId: "pack_001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_123",
    description: "A test pack",
    sandboxTier: "container",
    riskCount: 5,
    dependencyCount: 3,
    pluginCount: 10,
    toolBundleCount: 20,
  });

  assert.equal(pack.description, "A test pack");
  assert.equal(pack.sandboxTier, "container");
  assert.equal(pack.riskCount, 5);
  assert.equal(pack.dependencyCount, 3);
  assert.equal(pack.pluginCount, 10);
  assert.equal(pack.toolBundleCount, 20);
});
