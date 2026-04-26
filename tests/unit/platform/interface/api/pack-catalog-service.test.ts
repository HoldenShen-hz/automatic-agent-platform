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

  assert.throws(
    () =>
      service.createPack({
        packId: "pack_duplicate",
        name: "Second",
        version: "2.0.0",
        domainId: "domain_ops",
        createdBy: "user@example.com",
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "pack.already_exists",
  );
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

test("PackCatalogService defaults description to empty string when not specified", () => {
  const service = new PackCatalogService();
  const entry = service.createPack({
    packId: "pack_desc_default",
    name: "Description Default Test",
    version: "1.0.0",
    domainId: "domain_ops",
    createdBy: "user@example.com",
  });

  assert.equal(entry.description, "");
});

test("PackCatalogService defaults riskCount to 0 when not specified", () => {
  const service = new PackCatalogService();
  const entry = service.createPack({
    packId: "pack_risk_default",
    name: "Risk Default Test",
    version: "1.0.0",
    domainId: "domain_ops",
    createdBy: "user@example.com",
  });

  assert.equal(entry.riskCount, 0);
  assert.equal(entry.dependencyCount, 0);
  assert.equal(entry.pluginCount, 0);
  assert.equal(entry.toolBundleCount, 0);
});

test("PackCatalogService listPacks handles zero limit", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack_zero_limit",
    name: "Zero Limit Test",
    version: "1.0.0",
    domainId: "domain_ops",
    createdBy: "user@example.com",
  });

  const list = service.listPacks(0);

  assert.equal(list.length, 0);
});

test("PackCatalogService listPacks handles negative limit", () => {
  const service = new PackCatalogService();
  service.createPack({
    packId: "pack_neg_limit",
    name: "Negative Limit Test",
    version: "1.0.0",
    domainId: "domain_ops",
    createdBy: "user@example.com",
  });

  const list = service.listPacks(-10);

  assert.equal(list.length, 0);
});

test("PackCatalogService listPacks handles empty service", () => {
  const service = new PackCatalogService();

  const list = service.listPacks();

  assert.deepStrictEqual(list, []);
});

test("PackCatalogService getPack returns null for non-existent pack", () => {
  const service = new PackCatalogService();

  const result = service.getPack("non_existent_pack");

  assert.equal(result, null);
});

test("PackCatalogService createPack accepts all sandboxTier values", () => {
  const service = new PackCatalogService();

  const tiers = ["none", "process", "container", "scoped_external_access"] as const;

  for (const tier of tiers) {
    const entry = service.createPack({
      packId: `pack_tier_${tier}`,
      name: `Tier ${tier} Test`,
      version: "1.0.0",
      domainId: "domain_ops",
      createdBy: "user@example.com",
      sandboxTier: tier,
    });

    assert.equal(entry.sandboxTier, tier);
  }
});
