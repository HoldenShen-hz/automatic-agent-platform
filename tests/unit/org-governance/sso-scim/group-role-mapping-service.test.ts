import test from "node:test";
import assert from "node:assert/strict";
import { GroupRoleMappingService, type GroupRoleMappingRule } from "../../../../src/org-governance/sso-scim/group-role-mapping-service.js";

const ADMIN_CONTEXT = { callerIsPlatformAdmin: true };

test("register() stores the mapping rule", () => {
  const service = new GroupRoleMappingService();
  const rule: GroupRoleMappingRule = { groupName: "admins", roleIds: ["admin", "superuser"] };

  const result = service.register(rule, ADMIN_CONTEXT);

  assert.deepStrictEqual(result, rule);
});

test("resolve() returns combined roleIds for multiple groups", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT);
  service.register({ groupName: "engineers", roleIds: ["developer"] }, ADMIN_CONTEXT);

  const roles = service.resolve(["admins", "engineers"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "developer"]);
});

test("resolve() deduplicates roleIds across groups", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin", "developer"] }, ADMIN_CONTEXT);
  service.register({ groupName: "engineers", roleIds: ["developer", "tester"] }, ADMIN_CONTEXT);

  const roles = service.resolve(["admins", "engineers"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "developer", "tester"]);
});

test("resolve() returns empty array when no groups match", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT);

  const roles = service.resolve(["unknown_group"]);

  assert.deepStrictEqual(roles, []);
});

test("resolve() returns empty array for empty group list", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT);

  const roles = service.resolve([]);

  assert.deepStrictEqual(roles, []);
});

test("resolve() returns roles for single group", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin", "superuser"] }, ADMIN_CONTEXT);

  const roles = service.resolve(["admins"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "superuser"]);
});

test("register() overwrites existing rule for same groupName", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT);
  service.register({ groupName: "admins", roleIds: ["admin", "superuser"] }, ADMIN_CONTEXT);

  const roles = service.resolve(["admins"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "superuser"]);
});

test("unregister() removes an existing mapping rule", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT);

  const removed = service.unregister("admins");

  assert.equal(removed, true);
  assert.deepStrictEqual(service.resolve(["admins"]), []);
});

test("listRules() returns registered rules sorted by group name", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "z-team", roleIds: ["viewer"] }, ADMIN_CONTEXT);
  service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT);

  assert.deepStrictEqual(service.listRules(), [
    { groupName: "admins", roleIds: ["admin"] },
    { groupName: "z-team", roleIds: ["viewer"] },
  ]);
});

test("register() rejects callers without platform admin authorization", () => {
  const service = new GroupRoleMappingService();

  assert.throws(
    () => service.register({ groupName: "admins", roleIds: ["admin"] }),
    /group_role_mapping\.unauthorized/,
  );
});

test("register() rejects roleIds outside the configured allowlist", () => {
  const service = new GroupRoleMappingService();
  service.setValidRoleIds(["viewer", "developer"]);

  assert.throws(
    () => service.register({ groupName: "admins", roleIds: ["admin"] }, ADMIN_CONTEXT),
    /group_role_mapping\.invalid_role_id:admin/,
  );
});
