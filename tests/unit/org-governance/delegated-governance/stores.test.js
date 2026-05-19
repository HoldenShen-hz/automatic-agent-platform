import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { InMemoryAuditLogStore, InMemoryDelegationStore, SqliteAuditLogStore, SqliteDelegationStore, } from "../../../../src/org-governance/delegated-governance/stores/index.js";
test("SqliteDelegationStore persists and restores delegations", () => {
    const db = new DatabaseSync(":memory:");
    const store = new SqliteDelegationStore(db);
    store.save({
        delegationId: "del_1",
        grantorId: "grantor",
        granteeId: "grantee",
        orgNodeIds: ["finance"],
        domainIds: ["legal"],
        permissions: ["manage_domains"],
        guardrails: [],
        expiresAt: "2030-01-01T00:00:00.000Z",
        revocable: true,
        status: "active",
    });
    assert.equal(store.get("del_1")?.granteeId, "grantee");
    assert.equal(store.listByGrantee("grantee").length, 1);
    assert.equal(store.listByOrgNode("finance").length, 1);
});
test("SqliteAuditLogStore persists and filters audit entries", () => {
    const db = new DatabaseSync(":memory:");
    const store = new SqliteAuditLogStore(db);
    store.append({
        action: "delegate",
        actorId: "grantor",
        delegationId: "del_1",
        timestamp: "2026-04-23T00:00:00.000Z",
        details: { granteeId: "grantee" },
    });
    store.append({
        action: "review",
        actorId: "auditor",
        delegationId: "del_1",
        timestamp: "2026-04-23T00:05:00.000Z",
        details: {},
    });
    assert.equal(store.list().length, 2);
    assert.equal(store.listByDelegationId("del_1").length, 2);
});
test("in-memory stores preserve current governance console defaults", () => {
    const delegationStore = new InMemoryDelegationStore();
    const auditStore = new InMemoryAuditLogStore();
    delegationStore.save({
        delegationId: "del_memory",
        grantorId: "grantor",
        granteeId: "grantee",
        orgNodeIds: [],
        domainIds: [],
        permissions: [],
        guardrails: [],
        expiresAt: "2030-01-01T00:00:00.000Z",
        revocable: true,
        status: "active",
    });
    auditStore.append({
        action: "delegate",
        actorId: "grantor",
        delegationId: "del_memory",
        timestamp: "2026-04-23T00:00:00.000Z",
        details: {},
    });
    assert.equal(delegationStore.list().length, 1);
    assert.equal(auditStore.list().length, 1);
});
//# sourceMappingURL=stores.test.js.map