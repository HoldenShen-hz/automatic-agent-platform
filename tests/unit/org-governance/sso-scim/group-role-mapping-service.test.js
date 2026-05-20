import test from "node:test";
import assert from "node:assert/strict";
import { GroupRoleMappingService } from "../../../../src/org-governance/sso-scim/group-role-mapping-service.js";
const TENANT_ID = "tenant-1";
test("register() stores the mapping rule", () => {
    const service = new GroupRoleMappingService();
    const rule = { groupName: "admins", roleIds: ["admin", "superuser"], tenantId: TENANT_ID };
    const result = service.register(rule);
    assert.deepStrictEqual(result, rule);
});
test("resolve() returns combined roleIds for multiple groups", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID });
    service.register({ groupName: "engineers", roleIds: ["developer"], tenantId: TENANT_ID });
    const roles = service.resolve(["admins", "engineers"], TENANT_ID);
    assert.deepStrictEqual(roles.sort(), ["admin", "developer"]);
});
test("resolve() deduplicates roleIds across groups", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin", "developer"], tenantId: TENANT_ID });
    service.register({ groupName: "engineers", roleIds: ["developer", "tester"], tenantId: TENANT_ID });
    const roles = service.resolve(["admins", "engineers"], TENANT_ID);
    assert.deepStrictEqual(roles.sort(), ["admin", "developer", "tester"]);
});
test("resolve() returns empty array when no groups match", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID });
    const roles = service.resolve(["unknown_group"], TENANT_ID);
    assert.deepStrictEqual(roles, []);
});
test("resolve() returns empty array for empty group list", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID });
    const roles = service.resolve([], TENANT_ID);
    assert.deepStrictEqual(roles, []);
});
test("resolve() returns roles for single group", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin", "superuser"], tenantId: TENANT_ID });
    const roles = service.resolve(["admins"], TENANT_ID);
    assert.deepStrictEqual(roles.sort(), ["admin", "superuser"]);
});
test("register() rejects duplicate rules for the same tenant and groupName", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID });
    assert.throws(() => service.register({ groupName: "admins", roleIds: ["admin", "superuser"], tenantId: TENANT_ID }), /group_role_mapping\.duplicate_rule/);
});
test("unregister() removes an existing mapping rule", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID });
    const removed = service.unregister("admins", TENANT_ID);
    assert.equal(removed, true);
    assert.deepStrictEqual(service.resolve(["admins"], TENANT_ID), []);
});
test("listRules() returns registered rules sorted by group name", () => {
    const service = new GroupRoleMappingService();
    service.register({ groupName: "z-team", roleIds: ["viewer"], tenantId: TENANT_ID });
    service.register({ groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID });
    assert.deepStrictEqual(service.listRules(), [
        { groupName: "admins", roleIds: ["admin"], tenantId: TENANT_ID },
        { groupName: "z-team", roleIds: ["viewer"], tenantId: TENANT_ID },
    ]);
});
//# sourceMappingURL=group-role-mapping-service.test.js.map
