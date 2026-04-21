import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  PackRegistryService,
  type ListPacksFilter,
  type PackVersion,
} from "../../../../src/domains/business-pack/pack-registry-service.js";
import type { BusinessPackManifest } from "../../../../src/domains/business-pack/business-pack-manifest.js";

function createTestManifest(packId: string, overrides: Partial<BusinessPackManifest> = {}): BusinessPackManifest {
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
    ...overrides,
  };
}

describe("PackRegistryService", () => {
  let service: PackRegistryService;

  beforeEach(() => {
    service = new PackRegistryService();
  });

  describe("registerPack", () => {
    it("should register a new pack", () => {
      const manifest = createTestManifest("pack-001");

      const entry = service.registerPack("pack-001", manifest);

      assert.strictEqual(entry.packId, "pack-001");
      assert.strictEqual(entry.currentManifest.packId, "pack-001");
      assert.strictEqual(entry.versions.length, 1);
      assert.strictEqual(entry.versions[0]?.version, "1.0.0");
    });

    it("should throw if pack already registered", () => {
      const manifest = createTestManifest("pack-001");
      service.registerPack("pack-001", manifest);

      assert.throws(
        () => service.registerPack("pack-001", manifest),
        /already registered/,
      );
    });
  });

  describe("getPack", () => {
    it("should return pack entry", () => {
      const manifest = createTestManifest("pack-001");
      service.registerPack("pack-001", manifest);

      const entry = service.getPack("pack-001");

      assert.ok(entry);
      assert.strictEqual(entry?.packId, "pack-001");
    });

    it("should return null for non-existent pack", () => {
      const entry = service.getPack("nonexistent");
      assert.strictEqual(entry, null);
    });
  });

  describe("getPackManifest", () => {
    it("should return current manifest", () => {
      const manifest = createTestManifest("pack-001");
      service.registerPack("pack-001", manifest);

      const result = service.getPackManifest("pack-001");

      assert.ok(result);
      assert.strictEqual(result?.packId, "pack-001");
    });

    it("should return null for non-existent pack", () => {
      const result = service.getPackManifest("nonexistent");
      assert.strictEqual(result, null);
    });
  });

  describe("getPackVersions", () => {
    it("should return all versions of a pack", () => {
      const manifest1 = createTestManifest("pack-001");
      service.registerPack("pack-001", manifest1);

      const versions = service.getPackVersions("pack-001");

      assert.strictEqual(versions.length, 1);
      assert.strictEqual(versions[0]?.version, "1.0.0");
    });

    it("should return empty array for non-existent pack", () => {
      const versions = service.getPackVersions("nonexistent");
      assert.strictEqual(versions.length, 0);
    });
  });

  describe("listPacks", () => {
    beforeEach(() => {
      service.registerPack("pack-001", createTestManifest("pack-001", { lifecycleStage: "draft", domainId: "domain-001", author: "author-a", tags: ["tag1", "tag2"] }));
      service.registerPack("pack-002", createTestManifest("pack-002", { lifecycleStage: "published", domainId: "domain-001", author: "author-b", tags: ["tag2", "tag3"] }));
      service.registerPack("pack-003", createTestManifest("pack-003", { lifecycleStage: "draft", domainId: "domain-002", author: "author-a", tags: ["tag3"] }));
    });

    it("should list all packs with no filter", () => {
      const packs = service.listPacks();
      assert.strictEqual(packs.length, 3);
    });

    it("should filter by status", () => {
      const drafts = service.listPacks({ status: ["draft"] });
      assert.strictEqual(drafts.length, 2);
      assert.ok(drafts.every((p) => p.currentManifest.lifecycleStage === "draft"));

      const published = service.listPacks({ status: ["published"] });
      assert.strictEqual(published.length, 1);

      const multiple = service.listPacks({ status: ["draft", "published"] });
      assert.strictEqual(multiple.length, 3);
    });

    it("should filter by domainId", () => {
      const domain1 = service.listPacks({ domainId: "domain-001" });
      assert.strictEqual(domain1.length, 2);

      const domain2 = service.listPacks({ domainId: "domain-002" });
      assert.strictEqual(domain2.length, 1);
    });

    it("should filter by author", () => {
      const authorA = service.listPacks({ author: "author-a" });
      assert.strictEqual(authorA.length, 2);

      const authorB = service.listPacks({ author: "author-b" });
      assert.strictEqual(authorB.length, 1);
    });

    it("should filter by tags", () => {
      const tag2 = service.listPacks({ tags: ["tag2"] });
      assert.strictEqual(tag2.length, 2);

      const tag3 = service.listPacks({ tags: ["tag3"] });
      assert.strictEqual(tag3.length, 2);
    });

    it("should combine multiple filters", () => {
      const result = service.listPacks({
        status: ["draft"],
        domainId: "domain-001",
        author: "author-a",
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.packId, "pack-001");
    });
  });

  describe("findPacksByDomain", () => {
    it("should find packs by domain", () => {
      service.registerPack("pack-001", createTestManifest("pack-001", { domainId: "domain-001" }));
      service.registerPack("pack-002", createTestManifest("pack-002", { domainId: "domain-001" }));
      service.registerPack("pack-003", createTestManifest("pack-003", { domainId: "domain-002" }));

      const domain1 = service.findPacksByDomain("domain-001");
      assert.strictEqual(domain1.length, 2);

      const domain2 = service.findPacksByDomain("domain-002");
      assert.strictEqual(domain2.length, 1);
    });
  });

  describe("listPackIds", () => {
    it("should list all pack IDs", () => {
      service.registerPack("pack-001", createTestManifest("pack-001"));
      service.registerPack("pack-002", createTestManifest("pack-002"));

      const ids = service.listPackIds();
      assert.strictEqual(ids.length, 2);
      assert.ok(ids.includes("pack-001"));
      assert.ok(ids.includes("pack-002"));
    });
  });

  describe("isRegistered", () => {
    it("should return true for registered packs", () => {
      service.registerPack("pack-001", createTestManifest("pack-001"));
      assert.strictEqual(service.isRegistered("pack-001"), true);
    });

    it("should return false for non-registered packs", () => {
      assert.strictEqual(service.isRegistered("nonexistent"), false);
    });
  });

  describe("updatePack", () => {
    it("should update pack and create new version", () => {
      const manifest1 = createTestManifest("pack-001");
      service.registerPack("pack-001", manifest1);

      const manifest2 = createTestManifest("pack-001", { version: "1.0.1", description: "Updated description" });
      const version = service.updatePack("pack-001", manifest2);

      assert.strictEqual(version.version, "1.0.1");
      assert.strictEqual(version.manifest.description, "Updated description");

      const versions = service.getPackVersions("pack-001");
      assert.strictEqual(versions.length, 2);
    });

    it("should throw if pack not found", () => {
      const manifest = createTestManifest("nonexistent");
      assert.throws(
        () => service.updatePack("nonexistent", manifest),
        /not found/,
      );
    });
  });

  describe("unregisterPack", () => {
    it("should remove pack from registry", () => {
      service.registerPack("pack-001", createTestManifest("pack-001"));
      assert.strictEqual(service.isRegistered("pack-001"), true);

      const removed = service.unregisterPack("pack-001");
      assert.strictEqual(removed, true);
      assert.strictEqual(service.isRegistered("pack-001"), false);
    });

    it("should return false for non-existent pack", () => {
      const removed = service.unregisterPack("nonexistent");
      assert.strictEqual(removed, false);
    });
  });

  describe("version bumping", () => {
    it("should increment patch version", () => {
      const manifest1 = createTestManifest("pack-001", { version: "1.0.0" });
      service.registerPack("pack-001", manifest1);

      const manifest2 = createTestManifest("pack-001", { version: "1.0.1" });
      const version2 = service.updatePack("pack-001", manifest2);

      assert.strictEqual(version2.version, "1.0.1");
    });
  });
});
