import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";

import {
  InMemoryDelegationStore,
  InMemoryAuditLogStore,
  SqliteDelegationStore,
  SqliteAuditLogStore,
} from "../../../../../src/org-governance/delegated-governance/stores/index.js";

test("InMemoryDelegationStore saves and retrieves delegation", () => {
  const store = new InMemoryDelegationStore();
  const delegation = {
    delegationId: "del_123",
    grantorId: "grantor_456",
    granteeId: "grantee_789",
    orgNodeIds: ["node_1"],
    domainIds: ["domain_a"],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };

  store.save(delegation);
  const retrieved = store.get("del_123");

  assert.ok(retrieved != null);
  assert.equal(retrieved.delegationId, "del_123");
  assert.equal(retrieved.grantorId, "grantor_456");
  assert.equal(retrieved.granteeId, "grantee_789");
});

test("InMemoryDelegationStore returns null for non-existent delegation", () => {
  const store = new InMemoryDelegationStore();
  const result = store.get("non_existent");
  assert.equal(result, null);
});

test("InMemoryDelegationStore lists all delegations", () => {
  const store = new InMemoryDelegationStore();
  store.save({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });
  store.save({
    delegationId: "del_2",
    grantorId: "grantor_2",
    granteeId: "grantee_2",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });

  const all = store.list();
  assert.equal(all.length, 2);
});

test("InMemoryDelegationStore lists by grantee", () => {
  const store = new InMemoryDelegationStore();
  store.save({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_target",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });
  store.save({
    delegationId: "del_2",
    grantorId: "grantor_2",
    granteeId: "grantee_other",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });

  const byGrantee = store.listByGrantee("grantee_target");
  assert.equal(byGrantee.length, 1);
  assert.equal(byGrantee[0].delegationId, "del_1");
});

test("InMemoryDelegationStore lists by org node", () => {
  const store = new InMemoryDelegationStore();
  store.save({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: ["node_target"],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });
  store.save({
    delegationId: "del_2",
    grantorId: "grantor_2",
    granteeId: "grantee_2",
    orgNodeIds: ["node_other"],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });

  const byOrgNode = store.listByOrgNode("node_target");
  assert.equal(byOrgNode.length, 1);
  assert.equal(byOrgNode[0].delegationId, "del_1");
});

test("InMemoryDelegationStore returns delegations with empty orgNodeIds for any org node", () => {
  const store = new InMemoryDelegationStore();
  store.save({
    delegationId: "del_all",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });

  const byOrgNode = store.listByOrgNode("any_node");
  assert.equal(byOrgNode.length, 1);
  assert.equal(byOrgNode[0].delegationId, "del_all");
});

test("InMemoryAuditLogStore appends and lists entries", () => {
  const store = new InMemoryAuditLogStore();
  const entry = {
    action: "delegate_created" as const,
    actorId: "actor_123",
    delegationId: "del_456",
    timestamp: "2026-04-14T12:00:00.000Z",
    details: { key: "value" },
  };

  store.append(entry);
  const all = store.list();

  assert.equal(all.length, 1);
  assert.equal(all[0].action, "delegate_created");
  assert.equal(all[0].actorId, "actor_123");
});

test("InMemoryAuditLogStore lists by delegation id", () => {
  const store = new InMemoryAuditLogStore();
  store.append({
    action: "action_1",
    actorId: "actor_1",
    delegationId: "del_target",
    timestamp: "2026-04-14T12:00:00.000Z",
    details: {},
  });
  store.append({
    action: "action_2",
    actorId: "actor_2",
    delegationId: "del_other",
    timestamp: "2026-04-14T12:01:00.000Z",
    details: {},
  });

  const byDel = store.listByDelegationId("del_target");
  assert.equal(byDel.length, 1);
  assert.equal(byDel[0].action, "action_1");
});

test("SqliteDelegationStore saves and retrieves delegation", () => {
  const db = new DatabaseSync(":memory:");
  const store = new SqliteDelegationStore(db);

  const delegation = {
    delegationId: "del_sqlite_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: ["node_1"],
    domainIds: ["domain_1"],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };

  store.save(delegation);
  const retrieved = store.get("del_sqlite_1");

  assert.ok(retrieved != null);
  assert.equal(retrieved.delegationId, "del_sqlite_1");
  assert.equal(retrieved.grantorId, "grantor_1");
  assert.deepEqual(retrieved.orgNodeIds, ["node_1"]);
});

test("SqliteDelegationStore updates existing delegation", () => {
  const db = new DatabaseSync(":memory:");
  const store = new SqliteDelegationStore(db);

  const delegation = {
    delegationId: "del_update",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };

  store.save(delegation);
  store.save({ ...delegation, status: "revoked" });
  const retrieved = store.get("del_update");

  assert.ok(retrieved != null);
  assert.equal(retrieved.status, "revoked");
});

test("SqliteDelegationStore lists delegations", () => {
  const db = new DatabaseSync(":memory:");
  const store = new SqliteDelegationStore(db);

  store.save({
    delegationId: "del_list_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });
  store.save({
    delegationId: "del_list_2",
    grantorId: "grantor_2",
    granteeId: "grantee_2",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  });

  const all = store.list();
  assert.equal(all.length, 2);
});

test("SqliteAuditLogStore appends and lists entries", () => {
  const db = new DatabaseSync(":memory:");
  const store = new SqliteAuditLogStore(db);

  const entry = {
    action: "test_action" as const,
    actorId: "actor_sqlite",
    delegationId: "del_sqlite",
    timestamp: "2026-04-14T12:00:00.000Z",
    details: { test: true },
  };

  store.append(entry);
  const all = store.list();

  assert.equal(all.length, 1);
  assert.equal(all[0].action, "test_action");
  assert.equal(all[0].actorId, "actor_sqlite");
});

test("SqliteAuditLogStore lists by delegation id", () => {
  const db = new DatabaseSync(":memory:");
  const store = new SqliteAuditLogStore(db);

  store.append({
    action: "action_target",
    actorId: "actor_1",
    delegationId: "del_for_query",
    timestamp: "2026-04-14T12:00:00.000Z",
    details: {},
  });
  store.append({
    action: "action_other",
    actorId: "actor_2",
    delegationId: "del_other",
    timestamp: "2026-04-14T12:01:00.000Z",
    details: {},
  });

  const byDel = store.listByDelegationId("del_for_query");
  assert.equal(byDel.length, 1);
  assert.equal(byDel[0].action, "action_target");
});
