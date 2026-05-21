/**
 * CapabilityDelegation Unit Tests
 *
 * Tests for federation/capability-delegation.ts - Capability granting and revocation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CapabilityDelegation,
  createCapabilityDelegation,
  type Capability,
  type CapabilityCategory,
  type CapabilityPermission,
  type CapabilityConstraintType,
} from "../../../../src/scale-ecosystem/federation/capability-delegation.js";

// ─────────────────────────────────────────────────────────────────────────────
// CapabilityDelegation Construction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: createCapabilityDelegation returns instance", () => {
  const delegation = createCapabilityDelegation();
  assert.ok(delegation instanceof CapabilityDelegation);
});

test("capability-delegation: constructor accepts initial capabilities", () => {
  const capabilities: Capability[] = [
    {
      id: "cap-1",
      name: "Test Capability",
      description: "A test capability",
      category: "execution",
      permissions: ["invoke", "audit"],
      constraints: [],
      version: "1.0",
      deprecated: false,
    },
  ];

  const delegation = new CapabilityDelegation(capabilities);
  const retrieved = delegation.getCapability("cap-1");
  assert.ok(retrieved != null);
  assert.equal(retrieved?.name, "Test Capability");
});

// ─────────────────────────────────────────────────────────────────────────────
// Capability Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: registerCapability adds capability with generated id", () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "New Capability",
    description: "Description",
    category: "monitoring",
    permissions: ["invoke", "configure"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  assert.ok(capability.id != null && capability.id.length > 0);
  assert.equal(capability.name, "New Capability");
});

test("capability-delegation: registerCapability records audit entry", () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Audit Test",
    description: "Test",
    category: "data",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const auditEntries = delegation.getAuditLog({ capabilityId: capability.id });
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.action, "capability.registered");
});

test("capability-delegation: getCapability returns registered capability", () => {
  const delegation = new CapabilityDelegation();
  const registered = delegation.registerCapability({
    name: "Get Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const retrieved = delegation.getCapability(registered.id);
  assert.ok(retrieved != null);
  assert.equal(retrieved?.name, "Get Test");
});

test("capability-delegation: getCapability returns undefined for unknown id", () => {
  const delegation = new CapabilityDelegation();
  const retrieved = delegation.getCapability("unknown-id");
  assert.equal(retrieved, undefined);
});

test("capability-delegation: getCapabilitiesByCategory returns only non-deprecated", () => {
  const delegation = new CapabilityDelegation();
  delegation.registerCapability({
    name: "Exec 1",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });
  delegation.registerCapability({
    name: "Exec 2",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: true,
  });

  const capabilities = delegation.getCapabilitiesByCategory("execution");
  assert.equal(capabilities.length, 1);
  assert.equal(capabilities[0]?.name, "Exec 1");
});

test("capability-delegation: deprecateCapability marks as deprecated", () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Deprecate Test",
    description: "Test",
    category: "admin",
    permissions: ["invoke", "configure"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  delegation.deprecateCapability(capability.id);

  const retrieved = delegation.getCapability(capability.id);
  assert.equal(retrieved?.deprecated, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Grant Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: createGrant creates active grant", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Grant Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke", "configure"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const grant = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  assert.ok(grant.id != null && grant.id.length > 0);
  assert.equal(grant.status, "active");
  assert.equal(grant.capabilityId, capability.id);
});

test("capability-delegation: createGrant applies default constraints", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Constraint Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [
      {
        type: "rate_limit",
        name: "requests_per_minute",
        description: "Rate limit",
        defaultValue: 100,
        required: true,
      },
    ],
    version: "1.0",
    deprecated: false,
  });

  const grant = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  assert.ok(grant.constraints.length > 0);
});

test("capability-delegation: createGrant throws for deprecated capability", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Deprecated Grant Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  delegation.deprecateCapability(capability.id);

  await assert.rejects(
    async () => {
      await delegation.createGrant({
        capabilityId: capability.id,
        delegatingOrgId: "org-1",
        delegatedOrgId: "org-2",
        grantedBy: "admin",
        permissions: ["invoke"],
      });
    },
    (err: unknown) => (err as Error).message.includes("deprecated")
  );
});

test("capability-delegation: getGrant returns grant by id", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Get Grant Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const created = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  const retrieved = delegation.getGrant(created.id);
  assert.ok(retrieved != null);
  assert.equal(retrieved?.id, created.id);
});

test("capability-delegation: getGrantsForOrg returns only active grants", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Org Grants Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  const grants = delegation.getGrantsForOrg("org-1");
  assert.ok(grants.length > 0);
  assert.ok(grants.every((g) => g.status === "active"));
});

test("capability-delegation: suspendGrant updates status", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Suspend Grant Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const grant = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  await delegation.suspendGrant(grant.id, "Test suspension", "admin");

  const retrieved = delegation.getGrant(grant.id);
  assert.equal(retrieved?.status, "suspended");
});

test("capability-delegation: revokeGrant updates status", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Revoke Grant Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const grant = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  await delegation.revokeGrant(grant.id, "Test revocation", "admin");

  const retrieved = delegation.getGrant(grant.id);
  assert.equal(retrieved?.status, "revoked");
});

test("capability-delegation: renewGrant updates expiry", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Renew Grant Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const grant = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await delegation.renewGrant(grant.id, newExpiry, "admin");

  const retrieved = delegation.getGrant(grant.id);
  assert.ok(retrieved?.expiresAt != null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Request Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: createDelegationRequest creates pending request", () => {
  const delegation = new CapabilityDelegation();
  const request = delegation.createDelegationRequest({
    capabilityId: "cap-1",
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    requestedPermissions: ["invoke"],
    requestedBy: "user",
    requestedConstraints: [],
  });

  assert.ok(request.id != null && request.id.length > 0);
  assert.equal(request.status, "pending");
});

test("capability-delegation: getDelegationRequest returns request by id", () => {
  const delegation = new CapabilityDelegation();
  const created = delegation.createDelegationRequest({
    capabilityId: "cap-1",
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    requestedPermissions: ["invoke"],
    requestedBy: "user",
  });

  const retrieved = delegation.getDelegationRequest(created.id);
  assert.ok(retrieved != null);
  assert.equal(retrieved?.id, created.id);
});

test("capability-delegation: getPendingRequestsForOrg returns pending requests", () => {
  const delegation = new CapabilityDelegation();
  delegation.createDelegationRequest({
    capabilityId: "cap-1",
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    requestedPermissions: ["invoke"],
    requestedBy: "user",
  });

  const pending = delegation.getPendingRequestsForOrg("org-1");
  assert.equal(pending.length, 1);
});

test("capability-delegation: approveRequest changes status and creates grant", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Approve Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const request = delegation.createDelegationRequest({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    requestedPermissions: ["invoke"],
    requestedBy: "user",
  });

  const grant = await delegation.approveRequest(request.id, "approver");

  assert.equal(grant.capabilityId, capability.id);
  const retrieved = delegation.getDelegationRequest(request.id);
  assert.equal(retrieved?.status, "approved");
});

test("capability-delegation: rejectRequest changes status", () => {
  const delegation = new CapabilityDelegation();
  const request = delegation.createDelegationRequest({
    capabilityId: "cap-1",
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    requestedPermissions: ["invoke"],
    requestedBy: "user",
  });

  delegation.rejectRequest(request.id, "admin", "Not approved");

  const retrieved = delegation.getDelegationRequest(request.id);
  assert.equal(retrieved?.status, "rejected");
});

// ─────────────────────────────────────────────────────────────────────────────
// Access Control Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: checkAccess returns denied when no grants", async () => {
  const delegation = new CapabilityDelegation();
  const decision = await delegation.checkAccess({
    orgId: "org-1",
    capabilityId: "unknown-cap",
    permission: "invoke",
  });

  assert.equal(decision.allowed, false);
});

test("capability-delegation: checkAccess returns allowed with valid grant", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Access Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke", "configure"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke", "configure"],
  });

  const decision = await delegation.checkAccess({
    orgId: "org-2",
    capabilityId: capability.id,
    permission: "invoke",
  });

  assert.equal(decision.allowed, true);
});

test("capability-delegation: checkAccess returns denied for ungranted permission", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Permission Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  const decision = await delegation.checkAccess({
    orgId: "org-2",
    capabilityId: capability.id,
    permission: "configure",
  });

  assert.equal(decision.allowed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Quota Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: setQuota configures quota", () => {
  const delegation = new CapabilityDelegation();
  delegation.setQuota({
    orgId: "org-1",
    capabilityId: "cap-1",
    limit: 100,
    windowType: "hourly",
  });

  const quota = delegation.getQuota("org-1", "cap-1");
  assert.ok(quota != null);
  assert.equal(quota?.limit, 100);
  assert.equal(quota?.windowType, "hourly");
});

test("capability-delegation: quota tracks usage", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Quota Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  delegation.setQuota({
    orgId: "org-1",
    capabilityId: capability.id,
    limit: 100,
    windowType: "daily",
  });

  await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  // Simulate accesses
  delegation.recordAccess({ orgId: "org-2", capabilityId: capability.id, permission: "invoke", granted: true });
  delegation.recordAccess({ orgId: "org-2", capabilityId: capability.id, permission: "invoke", granted: true });

  const quota = delegation.getQuota("org-1", capability.id);
  assert.equal(quota?.used, 2);
});

test("capability-delegation: unlimited window type bypasses quota", async () => {
  const delegation = new CapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Unlimited Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  delegation.setQuota({
    orgId: "org-1",
    capabilityId: capability.id,
    limit: 1,
    windowType: "unlimited",
  });

  await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  const decision = await delegation.checkAccess({
    orgId: "org-2",
    capabilityId: capability.id,
    permission: "invoke",
  });

  assert.equal(decision.allowed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("capability-delegation: getAuditLog returns all entries when no filter", () => {
  const delegation = new CapabilityDelegation();
  delegation.registerCapability({
    name: "Audit Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const auditEntries = delegation.getAuditLog({});
  assert.ok(auditEntries.length > 0);
});

test("capability-delegation: getAuditLog filters by orgId", () => {
  const delegation = new CapabilityDelegation();
  delegation.registerCapability({
    name: "Org Filter Test",
    description: "Test",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const auditEntries = delegation.getAuditLog({ orgId: "system" });
  assert.ok(auditEntries.length > 0);
  assert.ok(auditEntries.every((e) => e.orgId === "system"));
});

test("capability-delegation: getAuditLog applies limit", () => {
  const delegation = new CapabilityDelegation();
  for (let i = 0; i < 5; i++) {
    delegation.registerCapability({
      name: `Capability ${i}`,
      description: "Test",
      category: "execution",
      permissions: ["invoke"],
      constraints: [],
      version: "1.0",
      deprecated: false,
    });
  }

  const auditEntries = delegation.getAuditLog({ limit: 3 });
  assert.equal(auditEntries.length, 3);
});