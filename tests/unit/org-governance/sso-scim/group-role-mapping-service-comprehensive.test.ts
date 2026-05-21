/**
 * Comprehensive Tests: Group Role Mapping Service
 *
 * Tests edge cases, audit logging, case-insensitivity,
 * and all functionality of the GroupRoleMappingService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GroupRoleMappingService, type GroupRoleMappingRule, type GroupRoleMappingAuditEntry } from "../../../../src/org-governance/sso-scim/group-role-mapping-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService.listAuditLog returns empty initially", () => {
  const service = new GroupRoleMappingService();

  const log = service.listAuditLog();

  assert.deepEqual(log, []);
});

test("GroupRoleMappingService.register records audit entry", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  const log = service.listAuditLog();

  assert.equal(log.length, 1);
  assert.equal(log[0]!.action, "register");
  assert.equal(log[0]!.groupName, "admins");
  assert.equal(log[0]!.tenantId, "tenant-1");
});

test("GroupRoleMappingService.unregister records audit entry", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  service.unregister("admins", "tenant-1");

  const log = service.listAuditLog();

  assert.equal(log.length, 2);
  assert.equal(log[1]!.action, "unregister");
  assert.equal(log[1]!.groupName, "admins");
  assert.deepEqual(log[1]!.roleIds, ["admin"]);
});

test("GroupRoleMappingService.register deduplicates roleIds in audit", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin", "admin", "superuser", "superuser"],
    tenantId: "tenant-1",
  });

  const log = service.listAuditLog();

  // Should be deduplicated to just 2 unique roles
  assert.deepEqual(log[0]!.roleIds.sort(), ["admin", "superuser"]);
});

test("GroupRoleMappingService.unregister does not record if rule not found", () => {
  const service = new GroupRoleMappingService();

  service.unregister("non-existent", "tenant-1");

  const log = service.listAuditLog();

  assert.equal(log.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Case Sensitivity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService.resolve is case-insensitive for group names", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "Admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  const roles = service.resolve(["admins"], "tenant-1");

  assert.deepEqual(roles, ["admin"]);
});

test("GroupRoleMappingService.register stores lowercase key internally", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "ADMINs",
    roleIds: ["admin"],
    tenantId: "TENANT-1",
  });

  // Unregister with different case should work
  const result = service.unregister("admins", "tenant-1");
  assert.equal(result, true);
});

test("GroupRoleMappingService.listRules preserves original case in returned rules", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "OriginalCase",
    roleIds: ["role"],
    tenantId: "Tenant1",
  });

  const rules = service.listRules();

  assert.equal(rules.length, 1);
  assert.equal(rules[0]!.groupName, "OriginalCase");
  assert.equal(rules[0]!.tenantId, "Tenant1");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Isolation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService.resolve only returns roles for matching tenant", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-a",
  });

  service.register({
    groupName: "admins",
    roleIds: ["superadmin"],
    tenantId: "tenant-b",
  });

  const rolesA = service.resolve(["admins"], "tenant-a");
  const rolesB = service.resolve(["admins"], "tenant-b");

  assert.deepEqual(rolesA, ["admin"]);
  assert.deepEqual(rolesB, ["superadmin"]);
});

test("GroupRoleMappingService.register allows same group name in different tenants", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "developers",
    roleIds: ["dev"],
    tenantId: "tenant-a",
  });

  service.register({
    groupName: "developers",
    roleIds: ["developer"],
    tenantId: "tenant-b",
  });

  // Both should exist
  const rules = service.listRules();
  assert.equal(rules.length, 2);
});

test("GroupRoleMappingService.unregister only affects specific tenant", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-a",
  });

  service.register({
    groupName: "admins",
    roleIds: ["superadmin"],
    tenantId: "tenant-b",
  });

  // Unregister from tenant-a only
  service.unregister("admins", "tenant-a");

  // tenant-b should still have the rule
  const rolesB = service.resolve(["admins"], "tenant-b");
  assert.deepEqual(rolesB, ["superadmin"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService.register throws on duplicate rule", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  assert.throws(
    () => service.register({
      groupName: "admins",
      roleIds: ["superadmin"],
      tenantId: "tenant-1",
    }),
    /group_role_mapping\.duplicate_rule/,
  );
});

test("GroupRoleMappingService.resolve throws on empty tenantId", () => {
  const service = new GroupRoleMappingService();

  assert.throws(
    () => service.resolve(["admins"], ""),
    /group_role_mapping\.tenant_required/,
  );
});

test("GroupRoleMappingService.resolve returns empty for unknown group", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  const roles = service.resolve(["unknown-group"], "tenant-1");

  assert.deepEqual(roles, []);
});

test("GroupRoleMappingService.resolve returns empty for empty groups array", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  const roles = service.resolve([], "tenant-1");

  assert.deepEqual(roles, []);
});

test("GroupRoleMappingService.resolve handles multiple groups with some unknown", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  service.register({
    groupName: "developers",
    roleIds: ["dev"],
    tenantId: "tenant-1",
  });

  const roles = service.resolve(["admins", "unknown", "developers"], "tenant-1");

  assert.deepEqual(roles.sort(), ["admin", "dev"]);
});

test("GroupRoleMappingService.unregister returns false for non-existent group", () => {
  const service = new GroupRoleMappingService();

  const result = service.unregister("non-existent", "tenant-1");

  assert.equal(result, false);
});

test("GroupRoleMappingService.listRules returns empty when no rules registered", () => {
  const service = new GroupRoleMappingService();

  const rules = service.listRules();

  assert.deepEqual(rules, []);
});

test("GroupRoleMappingService.listRules returns sorted by key", () => {
  const service = new GroupRoleMappingService();

  service.register({ groupName: "zulu", roleIds: ["z-role"], tenantId: "tenant-1" });
  service.register({ groupName: "alpha", roleIds: ["a-role"], tenantId: "tenant-1" });
  service.register({ groupName: "mike", roleIds: ["m-role"], tenantId: "tenant-1" });

  const rules = service.listRules();

  // Should be sorted by "tenantId:groupName" key
  assert.equal(rules[0]!.groupName, "alpha");
  assert.equal(rules[1]!.groupName, "mike");
  assert.equal(rules[2]!.groupName, "zulu");
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty and Whitespace RoleIds Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService.register accepts empty roleIds array", () => {
  const service = new GroupRoleMappingService();

  const rule = service.register({
    groupName: "empty-roles",
    roleIds: [],
    tenantId: "tenant-1",
  });

  assert.deepEqual(rule.roleIds, []);
});

test("GroupRoleMappingService.resolve returns empty for group with no roles", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "no-roles",
    roleIds: [],
    tenantId: "tenant-1",
  });

  const roles = service.resolve(["no-roles"], "tenant-1");

  assert.deepEqual(roles, []);
});

test("GroupRoleMappingService.resolve deduplicates across groups", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "group-a",
    roleIds: ["shared-role"],
    tenantId: "tenant-1",
  });

  service.register({
    groupName: "group-b",
    roleIds: ["shared-role", "another-role"],
    tenantId: "tenant-1",
  });

  const roles = service.resolve(["group-a", "group-b"], "tenant-1");

  // Should still only have one instance of shared-role
  assert.deepEqual(roles.sort(), ["another-role", "shared-role"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Readonly Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService.listAuditLog returns readonly array", () => {
  const service = new GroupRoleMappingService();

  service.register({
    groupName: "admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  const log = service.listAuditLog();

  // Verify it's readonly
  assert.ok(Array.isArray(log));
  assert.ok(Object.isFrozen(log));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRuleKey Tests (via public API)
// ─────────────────────────────────────────────────────────────────────────────

test("GroupRoleMappingService rules are keyed by tenant and lowercase group", () => {
  const service = new GroupRoleMappingService();

  // Register same group with different cases in same tenant - should fail
  service.register({
    groupName: "Admins",
    roleIds: ["admin"],
    tenantId: "tenant-1",
  });

  // Trying to register with different case should throw (key already exists)
  assert.throws(
    () => service.register({
      groupName: "ADMINS",
      roleIds: ["admin"],
      tenantId: "tenant-1",
    }),
    /group_role_mapping\.duplicate_rule/,
  );
});