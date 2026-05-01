import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AdminConfigService,
  type ApplyAdminConfigInput,
} from "../../../../../src/platform/five-plane-interface/api/admin-config-service.js";

describe("AdminConfigService", () => {
  describe("applyUpdate", () => {
    it("should apply update and return record", () => {
      const service = new AdminConfigService();
      const input: ApplyAdminConfigInput = {
        key: "feature.enabled",
        value: true,
        updatedBy: "admin-1",
      };

      const record = service.applyUpdate(input);

      assert.ok(record.updateId.startsWith("config_update_"));
      assert.strictEqual(record.key, "feature.enabled");
      assert.strictEqual(record.value, true);
      assert.strictEqual(record.updatedBy, "admin-1");
      assert.strictEqual(record.tenantId, null);
      assert.ok(record.updatedAt);
    });

    it("should apply update with tenant ID", () => {
      const service = new AdminConfigService();
      const input: ApplyAdminConfigInput = {
        key: "tenant.setting",
        value: { limit: 100 },
        tenantId: "tenant-abc",
        updatedBy: "admin-2",
      };

      const record = service.applyUpdate(input);

      assert.strictEqual(record.tenantId, "tenant-abc");
    });

    it("should apply update with null tenant ID when explicitly passed", () => {
      const service = new AdminConfigService();
      const input: ApplyAdminConfigInput = {
        key: "global.setting",
        value: "global-value",
        tenantId: null,
        updatedBy: "admin-1",
      };

      const record = service.applyUpdate(input);

      assert.strictEqual(record.tenantId, null);
    });

    it("should store multiple updates", () => {
      const service = new AdminConfigService();
      const input1: ApplyAdminConfigInput = { key: "key-1", value: "value1", updatedBy: "admin" };
      const input2: ApplyAdminConfigInput = { key: "key-2", value: "value2", updatedBy: "admin" };

      service.applyUpdate(input1);
      service.applyUpdate(input2);

      const updates = service.listUpdates(50);
      assert.strictEqual(updates.length, 2);
    });

    it("should generate unique update IDs", () => {
      const service = new AdminConfigService();
      const input: ApplyAdminConfigInput = { key: "test", value: "test", updatedBy: "admin" };

      const record1 = service.applyUpdate(input);
      const record2 = service.applyUpdate(input);

      assert.notStrictEqual(record1.updateId, record2.updateId);
    });
  });

  describe("listUpdates", () => {
    it("should list all updates when no tenant filter", () => {
      const service = new AdminConfigService();
      service.applyUpdate({ key: "k1", value: "v1", updatedBy: "admin", tenantId: "tenant-1" });
      service.applyUpdate({ key: "k2", value: "v2", updatedBy: "admin", tenantId: "tenant-2" });
      service.applyUpdate({ key: "k3", value: "v3", updatedBy: "admin", tenantId: null });

      const updates = service.listUpdates(50);

      assert.strictEqual(updates.length, 3);
    });

    it("should filter by tenant ID", () => {
      const service = new AdminConfigService();
      service.applyUpdate({ key: "k1", value: "v1", updatedBy: "admin", tenantId: "tenant-abc" });
      service.applyUpdate({ key: "k2", value: "v2", updatedBy: "admin", tenantId: "tenant-xyz" });
      service.applyUpdate({ key: "k3", value: "v3", updatedBy: "admin", tenantId: null });

      const updates = service.listUpdates(50, "tenant-abc");

      assert.strictEqual(updates.length, 1);
      assert.strictEqual(updates[0].key, "k1");
    });

    it("should return empty array when no matches for tenant", () => {
      const service = new AdminConfigService();
      service.applyUpdate({ key: "k1", value: "v1", updatedBy: "admin", tenantId: "tenant-abc" });

      const updates = service.listUpdates(50, "tenant-nonexistent");

      assert.strictEqual(updates.length, 0);
    });

    it("should limit results", () => {
      const service = new AdminConfigService();
      for (let i = 0; i < 20; i++) {
        service.applyUpdate({ key: `key-${i}`, value: i, updatedBy: "admin" });
      }

      const updates = service.listUpdates(5);

      assert.strictEqual(updates.length, 5);
    });

    it("should return empty array when no updates exist", () => {
      const service = new AdminConfigService();

      const updates = service.listUpdates(50);

      assert.strictEqual(updates.length, 0);
    });

    it("should sort by updatedAt descending (newest first)", () => {
      const service = new AdminConfigService();
      service.applyUpdate({ key: "first", value: "first", updatedBy: "admin" });
      // Small delay to ensure different timestamps
      const second = service.applyUpdate({ key: "second", value: "second", updatedBy: "admin" });

      const updates = service.listUpdates(50);

      // The newest one should be first
      assert.strictEqual(updates[0].key, "second");
      assert.strictEqual(updates[1].key, "first");
    });

    it("should ignore negative limit", () => {
      const service = new AdminConfigService();
      service.applyUpdate({ key: "k1", value: "v1", updatedBy: "admin" });

      const updates = service.listUpdates(-5);

      assert.strictEqual(updates.length, 0);
    });
  });
});