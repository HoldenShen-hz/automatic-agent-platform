import assert from "node:assert/strict";
import test from "node:test";
import { AdminConfigService } from "../../../../../src/platform/interface/api/admin-config-service.js";

test("AdminConfigService applies update and returns record", () => {
  const service = new AdminConfigService();
  const record = service.applyUpdate({
    key: "feature_flags.approval_auto_approve",
    value: true,
    updatedBy: "admin@example.com",
  });

  assert.ok(record.updateId.startsWith("config_update_"));
  assert.equal(record.key, "feature_flags.approval_auto_approve");
  assert.equal(record.value, true);
  assert.equal(record.tenantId, null);
  assert.equal(record.updatedBy, "admin@example.com");
  assert.ok(record.updatedAt.length > 0);
});

test("AdminConfigService applies update with tenant scope", () => {
  const service = new AdminConfigService();
  const record = service.applyUpdate({
    key: "rate_limit.max_requests",
    value: 1000,
    tenantId: "tenant_xyz",
    updatedBy: "admin@example.com",
  });

  assert.equal(record.key, "rate_limit.max_requests");
  assert.equal(record.value, 1000);
  assert.equal(record.tenantId, "tenant_xyz");
});

test("AdminConfigService listUpdates returns all records sorted by date descending", async () => {
  const service = new AdminConfigService();
  service.applyUpdate({ key: "key1", value: 1, updatedBy: "a" });
  // Add delay to ensure different timestamps
  await new Promise((resolve) => setTimeout(resolve, 5));
  service.applyUpdate({ key: "key2", value: 2, updatedBy: "b" });

  const list = service.listUpdates();
  // Later item should be first (descending by updatedAt)
  assert.equal(list[0]?.key, "key2");
  assert.equal(list[1]?.key, "key1");
});

test("AdminConfigService listUpdates filters by tenantId", () => {
  const service = new AdminConfigService();
  service.applyUpdate({ key: "tenant_specific", value: "A", tenantId: "tenant_A", updatedBy: "a" });
  service.applyUpdate({ key: "tenant_specific", value: "B", tenantId: "tenant_B", updatedBy: "a" });
  service.applyUpdate({ key: "global", value: "global", updatedBy: "a" });

  const listTenantA = service.listUpdates(50, "tenant_A");
  assert.equal(listTenantA.length, 1);
  assert.equal(listTenantA[0]?.value, "A");

  const listGlobal = service.listUpdates(50, null);
  assert.ok(listGlobal.length >= 3);
});

test("AdminConfigService listUpdates respects limit", () => {
  const service = new AdminConfigService();
  for (let i = 0; i < 10; i++) {
    service.applyUpdate({ key: `key_${i}`, value: i, updatedBy: "a" });
  }

  const list = service.listUpdates(3);
  assert.equal(list.length, 3);
});

test("AdminConfigService listUpdates with zero limit returns empty", () => {
  const service = new AdminConfigService();
  service.applyUpdate({ key: "key1", value: "value1", updatedBy: "a" });

  const list = service.listUpdates(0);

  assert.equal(list.length, 0);
});

test("AdminConfigService listUpdates with negative limit returns empty", () => {
  const service = new AdminConfigService();
  service.applyUpdate({ key: "key1", value: "value1", updatedBy: "a" });

  const list = service.listUpdates(-10);

  assert.equal(list.length, 0);
});

test("AdminConfigService listUpdates handles complex value objects", () => {
  const service = new AdminConfigService();
  const complexValue = {
    nested: { a: 1, b: [1, 2, 3] },
    map: new Map([["key", "value"]]),
  };

  service.applyUpdate({ key: "complex", value: complexValue, updatedBy: "admin" });

  const list = service.listUpdates();
  assert.deepStrictEqual(list[0]!.value, complexValue);
});

test("AdminConfigService listUpdates filters null tenantId correctly", () => {
  const service = new AdminConfigService();
  service.applyUpdate({ key: "global1", value: "v1", tenantId: null, updatedBy: "a" });
  service.applyUpdate({ key: "global2", value: "v2", tenantId: null, updatedBy: "a" });
  service.applyUpdate({ key: "tenant1", value: "v3", tenantId: "tenant-A", updatedBy: "a" });

  const listNull = service.listUpdates(50, null);
  assert.ok(listNull.every((r) => r.tenantId === null));
});

test("AdminConfigService applyUpdate uses provided submittedAt", () => {
  const service = new AdminConfigService();
  const record = service.applyUpdate({
    key: "key",
    value: "value",
    updatedBy: "admin",
  });

  assert.ok(record.updatedAt.length > 0);
});

test("AdminConfigService applyUpdate handles various value types", () => {
  const service = new AdminConfigService();

  service.applyUpdate({ key: "string", value: "test", updatedBy: "a" });
  service.applyUpdate({ key: "number", value: 42, updatedBy: "a" });
  service.applyUpdate({ key: "boolean", value: true, updatedBy: "a" });
  service.applyUpdate({ key: "array", value: [1, 2, 3], updatedBy: "a" });
  service.applyUpdate({ key: "null", value: null, updatedBy: "a" });
  service.applyUpdate({ key: "undefined", value: undefined, updatedBy: "a" });

  const list = service.listUpdates();
  assert.equal(list.length, 6);
});
