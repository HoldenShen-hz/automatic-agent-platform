import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PackCatalogService, type CreatePackCatalogInput } from "../../../../../src/platform/five-plane-interface/api/pack-catalog-service.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("PackCatalogService.createPack creates a new pack", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack_abc123",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain_test",
    description: "A test pack",
    createdBy: "user_holder",
  };

  const result = service.createPack(input);

  assert.equal(result.packId, "pack_abc123");
  assert.equal(result.name, "Test Pack");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.domainId, "domain_test");
  assert.equal(result.description, "A test pack");
  assert.equal(result.lifecycleStage, "draft");
  assert.equal(result.createdBy, "user_holder");
  assert.equal(result.riskCount, 0);
  assert.equal(result.dependencyCount, 0);
  assert.equal(result.pluginCount, 0);
  assert.equal(result.toolBundleCount, 0);
  assert.ok(result.createdAt.length > 0);
  assert.ok(result.updatedAt.length > 0);
});

test("PackCatalogService.createPack sets default sandboxTier to read_only", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack_no_tier",
    name: "No Tier Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  };

  const result = service.createPack(input);

  assert.equal(result.sandboxTier, "read_only");
});

test("PackCatalogService.createPack uses provided optional fields", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack_full",
    name: "Full Pack",
    version: "2.0.0",
    domainId: "domain_prod",
    description: "Full featured pack",
    createdBy: "user_admin",
    sandboxTier: "workspace_write",
    riskCount: 5,
    dependencyCount: 3,
    pluginCount: 10,
    toolBundleCount: 7,
  };

  const result = service.createPack(input);

  assert.equal(result.sandboxTier, "workspace_write");
  assert.equal(result.riskCount, 5);
  assert.equal(result.dependencyCount, 3);
  assert.equal(result.pluginCount, 10);
  assert.equal(result.toolBundleCount, 7);
});

test("PackCatalogService.createPack throws ValidationError when pack already exists", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack_duplicate",
    name: "First Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  };

  service.createPack(input);

  assert.throws(
    () =>
      service.createPack({
        packId: "pack_duplicate",
        name: "Second Pack",
        version: "2.0.0",
        domainId: "domain_test",
        createdBy: "user_holder",
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "pack.already_exists",
  );
});

test("PackCatalogService.getPack returns created pack", () => {
  const service = new PackCatalogService();
  const input: CreatePackCatalogInput = {
    packId: "pack_get_test",
    name: "Get Test Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  };

  service.createPack(input);
  const result = service.getPack("pack_get_test");

  assert.ok(result != null);
  assert.equal(result!.packId, "pack_get_test");
  assert.equal(result!.name, "Get Test Pack");
});

test("PackCatalogService.getPack returns null for non-existent pack", () => {
  const service = new PackCatalogService();
  const result = service.getPack("pack_nonexistent");
  assert.equal(result, null);
});

test("PackCatalogService.listPacks returns empty array when no packs", () => {
  const service = new PackCatalogService();
  const result = service.listPacks();
  assert.deepEqual(result, []);
});

test("PackCatalogService.listPacks returns packs sorted by createdAt descending", async () => {
  const service = new PackCatalogService();

  // Create packs in order - newest first in the list
  // Use delays to ensure distinct timestamps
  service.createPack({
    packId: "pack_first",
    name: "First Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  });

  await new Promise((resolve) => setTimeout(resolve, 1));

  service.createPack({
    packId: "pack_second",
    name: "Second Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  });

  await new Promise((resolve) => setTimeout(resolve, 1));

  service.createPack({
    packId: "pack_third",
    name: "Third Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  });

  const result = service.listPacks();

  assert.equal(result.length, 3);
  // Most recently created should be first
  const first = result[0];
  const second = result[1];
  const third = result[2];
  assert.ok(first != null && second != null && third != null);
  assert.equal(first.packId, "pack_third");
  assert.equal(second.packId, "pack_second");
  assert.equal(third.packId, "pack_first");
});

test("PackCatalogService.listPacks respects limit parameter", () => {
  const service = new PackCatalogService();

  for (let i = 0; i < 10; i++) {
    service.createPack({
      packId: `pack_${i}`,
      name: `Pack ${i}`,
      version: "1.0.0",
      domainId: "domain_test",
      createdBy: "user_holder",
    });
  }

  const result = service.listPacks(5);

  assert.equal(result.length, 5);
});

test("PackCatalogService.listPacks handles zero limit", () => {
  const service = new PackCatalogService();

  service.createPack({
    packId: "pack_limit_zero",
    name: "Pack Zero",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  });

  const result = service.listPacks(0);

  assert.equal(result.length, 0);
});

test("PackCatalogService.listPacks handles negative limit", () => {
  const service = new PackCatalogService();

  service.createPack({
    packId: "pack_negative",
    name: "Pack Negative",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  });

  const result = service.listPacks(-5);

  // Negative limit should result in empty array per Math.max(0, -5) = 0
  assert.equal(result.length, 0);
});

test("PackCatalogService.listPacks uses default limit of 50", () => {
  const service = new PackCatalogService();

  for (let i = 0; i < 100; i++) {
    service.createPack({
      packId: `pack_default_${i}`,
      name: `Pack Default ${i}`,
      version: "1.0.0",
      domainId: "domain_test",
      createdBy: "user_holder",
    });
  }

  const result = service.listPacks();

  assert.equal(result.length, 50);
});

test("PackCatalogService.createPack generates timestamps with nowIso", () => {
  const service = new PackCatalogService();
  const beforeCreate = new Date().toISOString();

  service.createPack({
    packId: "pack_timestamp",
    name: "Timestamp Pack",
    version: "1.0.0",
    domainId: "domain_test",
    createdBy: "user_holder",
  });

  const afterCreate = new Date().toISOString();
  const result = service.getPack("pack_timestamp");

  assert.ok(result != null);
  assert.ok(result!.createdAt >= beforeCreate);
  assert.ok(result!.createdAt <= afterCreate);
  assert.equal(result!.createdAt, result!.updatedAt);
});
