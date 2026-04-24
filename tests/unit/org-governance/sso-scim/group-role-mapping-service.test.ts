import test from "node:test";
import assert from "node:assert/strict";
import { GroupRoleMappingService, type GroupRoleMappingRule } from "../../../../src/org-governance/sso-scim/group-role-mapping-service.js";

test("register() stores the mapping rule", () => {
  const service = new GroupRoleMappingService();
  const rule: GroupRoleMappingRule = { groupName: "admins", roleIds: ["admin", "superuser"] };

  const result = service.register(rule);

  assert.deepStrictEqual(result, rule);
});

test("resolve() returns combined roleIds for multiple groups", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] });
  service.register({ groupName: "engineers", roleIds: ["developer"] });

  const roles = service.resolve(["admins", "engineers"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "developer"]);
});

test("resolve() deduplicates roleIds across groups", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin", "developer"] });
  service.register({ groupName: "engineers", roleIds: ["developer", "tester"] });

  const roles = service.resolve(["admins", "engineers"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "developer", "tester"]);
});

test("resolve() returns empty array when no groups match", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] });

  const roles = service.resolve(["unknown_group"]);

  assert.deepStrictEqual(roles, []);
});

test("resolve() returns empty array for empty group list", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] });

  const roles = service.resolve([]);

  assert.deepStrictEqual(roles, []);
});

test("resolve() returns roles for single group", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin", "superuser"] });

  const roles = service.resolve(["admins"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "superuser"]);
});

test("register() overwrites existing rule for same groupName", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] });
  service.register({ groupName: "admins", roleIds: ["admin", "superuser"] });

  const roles = service.resolve(["admins"]);

  assert.deepStrictEqual(roles.sort(), ["admin", "superuser"]);
});

test("unregister() removes an existing mapping rule", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "admins", roleIds: ["admin"] });

  const removed = service.unregister("admins");

  assert.equal(removed, true);
  assert.deepStrictEqual(service.resolve(["admins"]), []);
});

test("listRules() returns registered rules sorted by group name", () => {
  const service = new GroupRoleMappingService();
  service.register({ groupName: "z-team", roleIds: ["viewer"] });
  service.register({ groupName: "admins", roleIds: ["admin"] });

  assert.deepStrictEqual(service.listRules(), [
    { groupName: "admins", roleIds: ["admin"] },
    { groupName: "z-team", roleIds: ["viewer"] },
  ]);
});
