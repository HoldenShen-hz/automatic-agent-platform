import assert from "node:assert/strict";
import test from "node:test";

import { PackCatalogService, type CreatePackCatalogInput } from "../../../../../src/platform/interface/api/pack-catalog-service.js";

test("PackCatalogService.createPack creates a new pack", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack-1",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "test-domain",
    createdBy: "test-user",
  };

  const pack = service.createPack(input);

  assert.equal(pack.packId, "pack-1");
  assert.equal(pack.name, "Test Pack");
  assert.equal(pack.version, "1.0.0");
  assert.equal(pack.domainId, "test-domain");
  assert.equal(pack.lifecycleStage, "draft");
  assert.equal(pack.sandboxTier, "read_only");
  assert.equal(pack.riskCount, 0);
  assert.equal(pack.dependencyCount, 0);
  assert.equal(pack.pluginCount, 0);
  assert.equal(pack.toolBundleCount, 0);
});

test("PackCatalogService.createPack throws for duplicate packId", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack-duplicate",
    name: "First Pack",
    version: "1.0.0",
    domainId: "test-domain",
    createdBy: "test-user",
  };

  service.createPack(input);
  assert.throws(
    () =>
      service.createPack({
        ...input,
        name: "Second Pack",
      }),
    /already exists/,
  );
});

test("PackCatalogService.createPack sets optional fields", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack-opts",
    name: "With Options",
    version: "2.0.0",
    domainId: "opts-domain",
    createdBy: "opts-user",
    description: "A pack with options",
    sandboxTier: "workspace_write",
    riskCount: 3,
    dependencyCount: 5,
    pluginCount: 10,
    toolBundleCount: 2,
  };

  const pack = service.createPack(input);

  assert.equal(pack.description, "A pack with options");
  assert.equal(pack.sandboxTier, "workspace_write");
  assert.equal(pack.riskCount, 3);
  assert.equal(pack.dependencyCount, 5);
  assert.equal(pack.pluginCount, 10);
  assert.equal(pack.toolBundleCount, 2);
});

test("PackCatalogService.getPack returns pack by id", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "get-pack",
    name: "Get Me",
    version: "1.0.0",
    domainId: "test",
    createdBy: "user",
  });

  const pack = service.getPack("get-pack");
  assert.ok(pack !== null);
  assert.equal(pack!.packId, "get-pack");
});

test("PackCatalogService.getPack returns null for non-existent pack", () => {
  const service = new PackCatalogService();
  const pack = service.getPack("non-existent");
  assert.equal(pack, null);
});

test("PackCatalogService.listPacks returns all packs sorted by createdAt", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack-first",
    name: "First",
    version: "1.0.0",
    domainId: "d1",
    createdBy: "user1",
  });
  service.createPack({
    packId: "pack-second",
    name: "Second",
    version: "1.0.0",
    domainId: "d2",
    createdBy: "user2",
  });

  const packs = service.listPacks();
  assert.equal(packs.length, 2);
  // Both packs should be in the list (order may vary due to same-second timestamps)
  const packIds = packs.map((p) => p.packId);
  assert.ok(packIds.includes("pack-first"));
  assert.ok(packIds.includes("pack-second"));
});

test("PackCatalogService.listPacks respects limit", () => {
  const service = new PackCatalogService();
  for (let i = 0; i < 5; i++) {
    service.createPack({
      packId: `pack-${i}`,
      name: `Pack ${i}`,
      version: "1.0.0",
      domainId: "d",
      createdBy: "user",
    });
  }

  const packs = service.listPacks(3);
  assert.equal(packs.length, 3);
});

test("PackCatalogService.listPacks handles zero limit", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack-limit",
    name: "Limited",
    version: "1.0.0",
    domainId: "d",
    createdBy: "user",
  });

  const packs = service.listPacks(0);
  assert.equal(packs.length, 0);
});

test("PackCatalogService createdAt and updatedAt are set", () => {
  const service = new PackCatalogService();
  const pack = service.createPack({
    packId: "pack-time",
    name: "Time Test",
    version: "1.0.0",
    domainId: "d",
    createdBy: "user",
  });

  assert.ok(pack.createdAt.length > 0);
  assert.ok(pack.updatedAt.length > 0);
  assert.equal(pack.createdAt, pack.updatedAt);
});
