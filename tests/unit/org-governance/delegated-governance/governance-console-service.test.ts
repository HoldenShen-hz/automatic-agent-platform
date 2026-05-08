/**
 * Unit tests for SelfServiceGovernanceConsole
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { SelfServiceGovernanceConsole } from "../../../../src/org-governance/delegated-governance/governance-console-service.js";
import { InMemoryDelegationStore, InMemoryAuditLogStore } from "../../../../src/org-governance/delegated-governance/stores/index.js";

test("SelfServiceGovernanceConsole.createDelegation creates a valid delegation", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    orgNodeIds: ["org-node-1"],
    domainIds: ["domain-1"],
    permissions: ["read", "write"],
    expiresAt: "2025-12-31T23:59:59Z",
    revocable: true,
  });

  assert.strictEqual(delegation.grantorId, "grantor-1");
  assert.strictEqual(delegation.granteeId, "grantee-1");
  assert.strictEqual(delegation.status, "active");
  assert.strictEqual(delegation.revocable, true);
  assert.ok(delegation.delegationId.startsWith("del_"));
});

test("SelfServiceGovernanceConsole.createDelegation preserves requested level and delegatable flag", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
    level: "operate",
    delegatable: true,
  } as Parameters<SelfServiceGovernanceConsole["createDelegation"]>[0]);

  assert.strictEqual(delegation.level, "operate");
  assert.strictEqual(delegation.delegatable, true);
});

test("SelfServiceGovernanceConsole.createDelegation adds audit log entry", () => {
  const delegationStore = new InMemoryDelegationStore();
  const auditLogStore = new InMemoryAuditLogStore();
  const console = new SelfServiceGovernanceConsole({
    delegationStore,
    auditLogStore,
  });

  console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  const auditEntries = auditLogStore.list();
  assert.strictEqual(auditEntries.length, 1);
  assert.strictEqual(auditEntries[0]?.action, "delegate");
});

test("SelfServiceGovernanceConsole.revokeDelegation successfully revokes", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
    revocable: true,
  });

  const result = console.revokeDelegation(delegation.delegationId, { actorId: "grantor-1", role: "platform_team" });

  assert.strictEqual(result.success, true);
  const revoked = console.getDelegation(delegation.delegationId, { actorId: "grantor-1", role: "platform_team" });
  assert.strictEqual(revoked?.status, "revoked");
});

test("SelfServiceGovernanceConsole.revokeDelegation fails for non-existent delegation", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const result = console.revokeDelegation("non-existent-id", { actorId: "grantor-1", role: "platform_team" });

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("delegation_not_found"));
});

test("SelfServiceGovernanceConsole.revokeDelegation fails for non-revocable delegation", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
    revocable: false,
  });

  const result = console.revokeDelegation(delegation.delegationId, { actorId: "grantor-1", role: "platform_team" });

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("delegation_not_revocable"));
});

test("SelfServiceGovernanceConsole.revokeDelegation rejects non-grantor callers", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
    revocable: true,
  });

  const result = console.revokeDelegation(delegation.delegationId, { actorId: "random-user", role: "team_lead" });

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("permission_denied"));
  assert.strictEqual(console.getDelegation(delegation.delegationId, { actorId: "random-user", role: "team_lead" })?.status, "active");
});

test("SelfServiceGovernanceConsole.listDelegationsForGrantee returns only active delegations", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  console.createDelegation({
    grantorId: "grantor-2",
    granteeId: "grantee-1",
    permissions: ["write"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  const delegations = console.listDelegationsForGrantee("grantee-1");

  assert.strictEqual(delegations.length, 2);
});

test("SelfServiceGovernanceConsole.listDelegationsForGrantee excludes revoked delegations", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  console.revokeDelegation(delegation.delegationId, { actorId: "grantor-1", role: "platform_team" });

  const delegations = console.listDelegationsForGrantee("grantee-1", { actorId: "grantor-1", role: "platform_team" });

  assert.strictEqual(delegations.length, 0);
});

test("SelfServiceGovernanceConsole.listDelegationsForOrgNode returns delegations for org", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    orgNodeIds: ["org-node-1"],
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  const delegations = console.listDelegationsForOrgNode("org-node-1");

  assert.strictEqual(delegations.length, 1);
  assert.strictEqual(delegations[0]?.orgNodeIds[0], "org-node-1");
});

test("SelfServiceGovernanceConsole.exportAuditLog returns all entries without filters", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  const entries = console.exportAuditLog();

  assert.ok(entries.length >= 1);
});

test("SelfServiceGovernanceConsole.exportAuditLog filters by actorId", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  const entries = console.exportAuditLog({ actorId: "grantor-1" });

  assert.ok(entries.every(e => e.actorId === "grantor-1"));
});

test("SelfServiceGovernanceConsole.isActionAllowed platform_team has full access", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const result = console.isActionAllowed("user-1", "platform_team", "domain_onboarding");

  assert.strictEqual(result.allowed, true);
});

test("SelfServiceGovernanceConsole.isActionAllowed division_admin has limited access", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const allowedResult = console.isActionAllowed("user-1", "division_admin", "domain_onboarding");
  assert.strictEqual(allowedResult.allowed, true);

  const deniedResult = console.isActionAllowed("user-1", "division_admin", "cross_domain_strategy");
  assert.strictEqual(deniedResult.allowed, false);
});

test("SelfServiceGovernanceConsole.isActionAllowed team_lead has no governance permissions", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const result = console.isActionAllowed("user-1", "team_lead", "domain_onboarding");

  assert.strictEqual(result.allowed, false);
});

test("SelfServiceGovernanceConsole.getDelegation returns null for non-existent", () => {
  const console = new SelfServiceGovernanceConsole({
    delegationStore: new InMemoryDelegationStore(),
    auditLogStore: new InMemoryAuditLogStore(),
  });

  const result = console.getDelegation("non-existent");

  assert.strictEqual(result, null);
});

test("SelfServiceGovernanceConsole.reviewDelegation returns delegation and logs audit", () => {
  const delegationStore = new InMemoryDelegationStore();
  const auditLogStore = new InMemoryAuditLogStore();
  const console = new SelfServiceGovernanceConsole({
    delegationStore,
    auditLogStore,
  });

  const delegation = console.createDelegation({
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    permissions: ["read"],
    expiresAt: "2025-12-31T23:59:59Z",
  });

  const beforeCount = auditLogStore.list().length;
  const result = console.reviewDelegation(delegation.delegationId, { actorId: "reviewer-1", role: "platform_team" });
  const afterCount = auditLogStore.list().length;

  assert.ok(result !== null);
  assert.strictEqual(result?.delegationId, delegation.delegationId);
  assert.strictEqual(afterCount, beforeCount + 1);
});
