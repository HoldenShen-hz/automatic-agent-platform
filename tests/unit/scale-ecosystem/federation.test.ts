/**
 * Unit tests for Federation module in src/scale-ecosystem/federation/
 *
 * Tests FederationGateway, TrustRelationshipManager, CapabilityDelegation,
 * and federation audit functionality per §52 requirements:
 * - Cross-platform discovery
 * - Trust establishment
 * - Workload delegation
 * - Federation identity
 * - Data sovereignty enforcement
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FederationGateway,
  createFederationGateway,
  type FederationGatewayConfig,
  type FederationOrg,
  TrustLevel,
  type TrustRelationship,
  type CapabilityGrant,
  type CapabilityPermission,
  type CapabilityConstraint,
  type DelegationRequest,
  type DelegationResult,
  type FederationEvent,
  type FederationRegionPriority,
  type FederationTopologyDiff,
  type FederationTopologyRegion,
  type FederationTopology,
  computeFederationTopologyDiff,
  type FederationCatalogEntry,
  type FederationCatalog,
  buildFederationCatalog,
} from "../../../src/scale-ecosystem/federation/index.js";
import {
  FederationAudit,
  createFederationAudit,
  type FederationAuditRecord,
  type AuditAction,
  type ResourceType,
  type AuditStatus,
  type AuditQuery,
  type AuditSummary,
  type AuditRetentionPolicy,
} from "../../../src/scale-ecosystem/federation/federation-audit.js";
import {
  TrustRelationshipManager,
  createTrustRelationshipManager,
  type TrustPolicy,
  TrustLevel as TRustLevel,
} from "../../../src/scale-ecosystem/federation/trust-relationship.js";
import {
  CapabilityDelegation,
  createCapabilityDelegation,
  type Capability,
  type CapabilityCategory,
  type CapabilityPermission as CapPerm,
  type CapabilityConstraintDefinition,
  type AppliedConstraint,
  type GrantStatus,
  type RequestStatus,
} from "../../../src/scale-ecosystem/federation/capability-delegation.js";

// ─────────────────────────────────────────────────────────────────────────────
// FederationGateway Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FederationGateway - can be created with default config", () => {
  const gateway = createFederationGateway();
  assert.ok(gateway instanceof FederationGateway);
});

test("FederationGateway - can be created with custom config", () => {
  const config: FederationGatewayConfig = {
    federationId: "test-federation",
    enableAudit: true,
    maxDelegationDepth: 5,
    requireApproval: false,
    autoExpiryDays: 30,
  };
  const gateway = createFederationGateway(config);
  assert.ok(gateway instanceof FederationGateway);
});

test("FederationGateway.registerOrganization adds org to registry", async () => {
  const gateway = createFederationGateway();
  const org = await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "standard",
  });
  assert.equal(org.id, "org-1");
  assert.equal(org.name, "Test Org");
  assert.equal(org.enabled, true);
});

test("FederationGateway.registerOrganization emits audit event", async () => {
  const gateway = createFederationGateway({ enableAudit: true });
  let eventEmitted = false;
  gateway.on("federation-event", () => {
    eventEmitted = true;
  });
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "standard",
  });
  assert.equal(eventEmitted, true);
});

test("FederationGateway.getOrganization returns registered org", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "standard",
  });
  const org = await gateway.getOrganization("org-1");
  assert.ok(org !== undefined);
  assert.equal(org?.id, "org-1");
});

test("FederationGateway.getOrganization returns undefined for unknown org", async () => {
  const gateway = createFederationGateway();
  const org = await gateway.getOrganization("unknown-org");
  assert.equal(org, undefined);
});

test("FederationGateway.updateOrganizationCapabilities updates capabilities", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1", "capability-2"]);
  const org = await gateway.getOrganization("org-1");
  assert.ok(org !== undefined);
  assert.equal(org.capabilities.has("capability-1"), true);
  assert.equal(org.capabilities.has("capability-2"), true);
});

test("FederationGateway.enableOrganization toggles enabled status", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "standard",
  });
  await gateway.enableOrganization("org-1", false);
  const org = await gateway.getOrganization("org-1");
  assert.ok(org !== undefined);
  assert.equal(org.enabled, false);
});

test("FederationGateway.establishTrust creates trust relationship", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  // Give org-1 the capability it wants to delegate
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);

  const trust = await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["capability-1"],
    grantedBy: "admin",
  });
  assert.equal(trust.sourceOrgId, "org-1");
  assert.equal(trust.targetOrgId, "org-2");
  assert.equal(trust.level, TrustLevel.READ);
});

test("FederationGateway.establishTrust throws for unknown org", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);

  await assert.rejects(
    async () => gateway.establishTrust({
      sourceOrgId: "org-1",
      targetOrgId: "unknown-org",
      level: TrustLevel.READ,
      capabilities: ["capability-1"],
      grantedBy: "admin",
    }),
    /Source or target organization not found/,
  );
});

test("FederationGateway.establishTrust throws for disabled org", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);
  await gateway.enableOrganization("org-2", false);

  await assert.rejects(
    async () => gateway.establishTrust({
      sourceOrgId: "org-1",
      targetOrgId: "org-2",
      level: TrustLevel.READ,
      capabilities: ["capability-1"],
      grantedBy: "admin",
    }),
    /disabled organization/,
  );
});

test("FederationGateway.getTrustsForOrg returns trust relationships", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);
  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["capability-1"],
    grantedBy: "admin",
  });

  const trusts = await gateway.getTrustsForOrg("org-1");
  assert.equal(trusts.length, 1);
  assert.equal(trusts[0]?.sourceOrgId, "org-1");
});

test("FederationGateway.revokeTrust sets expiry to now", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);
  const trust = await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["capability-1"],
    grantedBy: "admin",
    expiresAt: new Date(Date.now() + 86400000), // Tomorrow
  });

  await gateway.revokeTrust(trust.id, "admin");
  const updatedTrust = await gateway.getTrustRelationship(trust.id);
  assert.ok(updatedTrust !== undefined);
  assert.ok(updatedTrust.expiresAt !== undefined);
  assert.ok(updatedTrust.expiresAt <= new Date());
});

test("FederationGateway.requestDelegation returns success without approval", async () => {
  const gateway = createFederationGateway({ requireApproval: false });
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);
  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.WRITE,
    capabilities: ["capability-1"],
    grantedBy: "admin",
  });

  const result = await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["capability-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
    requestedAt: new Date(),
  });
  assert.equal(result.success, true);
});

test("FederationGateway.requestDelegation returns pending with approval required", async () => {
  const gateway = createFederationGateway({ requireApproval: true });
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);
  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.WRITE,
    capabilities: ["capability-1"],
    grantedBy: "admin",
  });

  const result = await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["capability-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
    requestedAt: new Date(),
  });
  assert.equal(result.success, true);
  assert.equal(result.errorCode, "PENDING_APPROVAL");
});

test("FederationGateway.checkCapabilityAccess returns true for granted permission", async () => {
  const gateway = createFederationGateway({ requireApproval: false });
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "enterprise",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Org Two",
    domain: "two.test.com",
    tier: "enterprise",
  });
  await gateway.updateOrganizationCapabilities("org-1", ["capability-1"]);
  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.WRITE,
    capabilities: ["capability-1"],
    grantedBy: "admin",
  });

  // requestDelegation with requireApproval: false creates the grant directly
  await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["capability-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
    requestedAt: new Date(),
  });

  const hasAccess = await gateway.checkCapabilityAccess("org-1", "org-2", "capability-1", "invoke");
  assert.equal(hasAccess, true);
});

test("FederationGateway.getAuditLog returns audit events", async () => {
  const gateway = createFederationGateway({ enableAudit: true });
  await gateway.registerOrganization({
    id: "org-1",
    name: "Org One",
    domain: "one.test.com",
    tier: "standard",
  });

  const log = gateway.getAuditLog();
  assert.ok(log.length > 0);
  assert.equal(log[0]?.type, "org.registered");
});

// ─────────────────────────────────────────────────────────────────────────────
// FederationTopology Tests
// ─────────────────────────────────────────────────────────────────────────────

test("computeFederationTopologyDiff detects added regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };
  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "region-1", endpoint: "https://region-1.example.com", priority: 1, status: "active" }],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);
  assert.equal(diff.addedRegions.length, 1);
  assert.equal(diff.addedRegions[0], "region-1");
});

test("computeFederationTopologyDiff detects removed regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "region-1", endpoint: "https://region-1.example.com", priority: 1, status: "active" }],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };
  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);
  assert.equal(diff.removedRegions.length, 1);
  assert.equal(diff.removedRegions[0], "region-1");
});

test("computeFederationTopologyDiff detects modified regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "region-1", endpoint: "https://region-1.example.com", priority: 1, status: "active" }],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };
  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "region-1", endpoint: "https://region-1.example.com", priority: 2, status: "active" }],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);
  assert.equal(diff.modifiedRegions.length, 1);
  assert.equal(diff.modifiedRegions[0]?.regionId, "region-1");
});

test("computeFederationTopologyDiff identifies unchanged regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "region-1", endpoint: "https://region-1.example.com", priority: 1, status: "active" }],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };
  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "region-1", endpoint: "https://region-1.example.com", priority: 1, status: "active" }],
    version: "1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);
  assert.equal(diff.unchangedRegions.length, 1);
  assert.equal(diff.unchangedRegions[0], "region-1");
});

// ─────────────────────────────────────────────────────────────────────────────
// FederationAudit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FederationAudit - can be created", () => {
  const audit = createFederationAudit({ federationId: "fed-1" });
  assert.ok(audit instanceof FederationAudit);
});

test("FederationAudit.record adds audit record", () => {
  const audit = createFederationAudit({ federationId: "fed-1" });
  audit.record({
    orgId: "org-1",
    action: "trust.established",
    resourceType: "trust",
    resourceId: "trust-1",
    status: "success",
    details: { trustLevel: "READ" },
  });

  const records = audit.query({});
  assert.equal(records.length, 1);
});

test("FederationAudit.query filters by orgId", () => {
  const audit = createFederationAudit({ federationId: "fed-1" });
  audit.record({
    orgId: "org-1",
    action: "trust.established",
    resourceType: "trust",
    resourceId: "trust-1",
    status: "success",
    details: {},
  });
  audit.record({
    orgId: "org-2",
    action: "capability.granted",
    resourceType: "capability",
    resourceId: "cap-1",
    status: "success",
    details: {},
  });

  const records = audit.query({ orgId: "org-1" });
  assert.equal(records.length, 1);
});

test("FederationAudit.getSummary returns aggregate stats", () => {
  const audit = createFederationAudit({ federationId: "fed-1" });
  audit.record({
    orgId: "org-1",
    action: "trust.established",
    actor: "user-1",
    resourceType: "trust",
    resourceId: "trust-1",
    status: "success",
    details: {},
  });
  audit.record({
    orgId: "org-1",
    action: "trust.established",
    actor: "user-1",
    resourceType: "trust",
    resourceId: "trust-2",
    status: "success",
    details: {},
  });

  const summary = audit.getSummary({});
  assert.equal(summary.totalRecords, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// TrustRelationshipManager Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TrustRelationshipManager - can be created", () => {
  const manager = createTrustRelationshipManager();
  assert.ok(manager instanceof TrustRelationshipManager);
});

test("TrustRelationshipManager.createTrustRelationship creates relationship", async () => {
  const manager = createTrustRelationshipManager();
  const relationship = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TRustLevel.READ,
    capabilities: ["cap-1"],
  });

  assert.equal(relationship.sourceOrgId, "org-1");
  assert.equal(relationship.targetOrgId, "org-2");
  assert.equal(relationship.level, TRustLevel.READ);
  assert.equal(relationship.status, "active");
});

test("TrustRelationshipManager.getTrustsForOrganization returns relationships", async () => {
  const manager = createTrustRelationshipManager();
  await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TRustLevel.READ,
    capabilities: ["cap-1"],
  });

  const trusts = await manager.getTrustsForOrganization("org-1");
  assert.equal(trusts.length, 1);
});

test("TrustRelationshipManager.suspendTrust updates status", async () => {
  const manager = createTrustRelationshipManager();
  const relationship = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TRustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.suspendTrust(relationship.id, "reason");
  const updated = await manager.getTrustRelationship(relationship.id);
  assert.equal(updated?.status, "suspended");
});

test("TrustRelationshipManager.revokeTrust updates status and expires", async () => {
  const manager = createTrustRelationshipManager();
  const relationship = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TRustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.revokeTrust(relationship.id, "reason");
  const updated = await manager.getTrustRelationship(relationship.id);
  assert.equal(updated?.status, "revoked");
  assert.ok(updated?.expiresAt !== undefined);
  assert.ok(updated.expiresAt <= new Date());
});

test("TrustRelationshipManager.evaluateTrust returns evaluation", async () => {
  const manager = createTrustRelationshipManager();
  const relationship = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TRustLevel.READ,
    capabilities: ["cap-1"],
  });

  const evaluation = await manager.evaluateTrust(relationship.id);
  assert.equal(evaluation.trustId, relationship.id);
  assert.ok(evaluation.trustScore >= 0 && evaluation.trustScore <= 1);
});

test("TrustRelationshipManager.updateMetrics updates trust metrics", async () => {
  const manager = createTrustRelationshipManager();
  const relationship = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TRustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.updateMetrics(relationship.id, { success: true, latencyMs: 100 });
  const updated = await manager.getTrustRelationship(relationship.id);
  assert.equal(updated?.metrics.successfulInteractions, 1);
  assert.ok(updated?.metrics.averageLatencyMs > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CapabilityDelegation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CapabilityDelegation - can be created", () => {
  const delegation = createCapabilityDelegation();
  assert.ok(delegation instanceof CapabilityDelegation);
});

test("CapabilityDelegation.registerCapability adds capability", () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
    category: "execution",
    permissions: ["invoke", "configure"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  assert.ok(capability.id);
  assert.equal(capability.name, "Test Capability");
});

test("CapabilityDelegation.getCapability returns registered capability", () => {
  const delegation = createCapabilityDelegation();
  const registered = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const found = delegation.getCapability(registered.id);
  assert.ok(found !== undefined);
  assert.equal(found?.name, "Test Capability");
});

test("CapabilityDelegation.createGrant creates capability grant", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
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

  assert.equal(grant.capabilityId, capability.id);
  assert.equal(grant.status, "active");
});

test("CapabilityDelegation.createGrant throws for deprecated capability", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });
  delegation.deprecateCapability(capability.id);

  await assert.rejects(
    async () => delegation.createGrant({
      capabilityId: capability.id,
      delegatingOrgId: "org-1",
      delegatedOrgId: "org-2",
      grantedBy: "admin",
      permissions: ["invoke"],
    }),
    /deprecated/,
  );
});

test("CapabilityDelegation.getGrantsForOrg returns org grants", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
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
  assert.equal(grants.length, 1);
});

test("CapabilityDelegation.checkAccess allows permitted access", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
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
    orgId: "org-1",
    capabilityId: capability.id,
    permission: "invoke",
  });

  assert.equal(decision.allowed, true);
});

test("CapabilityDelegation.checkAccess denies without grant", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  const decision = await delegation.checkAccess({
    orgId: "org-1",
    capabilityId: capability.id,
    permission: "invoke",
  });

  assert.equal(decision.allowed, false);
});

test("CapabilityDelegation.setQuota enforces quota limits", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  delegation.setQuota({
    orgId: "org-1",
    capabilityId: capability.id,
    limit: 2,
    windowType: "hourly",
  });

  // First access - should be allowed
  const grant = await delegation.createGrant({
    capabilityId: capability.id,
    delegatingOrgId: "org-1",
    delegatedOrgId: "org-2",
    grantedBy: "admin",
    permissions: ["invoke"],
  });

  const decision1 = await delegation.checkAccess({
    orgId: "org-1",
    capabilityId: capability.id,
    permission: "invoke",
  });
  assert.equal(decision1.allowed, true);

  // Second access - should be allowed (limit is 2)
  const decision2 = await delegation.checkAccess({
    orgId: "org-1",
    capabilityId: capability.id,
    permission: "invoke",
  });
  assert.equal(decision2.allowed, true);
});

test("CapabilityDelegation.suspendGrant updates grant status", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
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

  await delegation.suspendGrant(grant.id, "reason", "admin");
  const updated = delegation.getGrant(grant.id);
  assert.equal(updated?.status, "suspended");
});

test("CapabilityDelegation.revokeGrant updates grant status", async () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "Test description",
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

  await delegation.revokeGrant(grant.id, "reason", "admin");
  const updated = delegation.getGrant(grant.id);
  assert.equal(updated?.status, "revoked");
});
