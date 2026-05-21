/**
 * Federation Index Unit Tests
 *
 * Tests for federation/index.ts - Barrel exports for federation module
 */

import assert from "node:assert/strict";
import test from "node:test";

// Test all exports from the federation index
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
  FederationAudit,
  createFederationAudit,
  type FederationAuditRecord,
  type AuditAction,
  type ResourceType,
  type AuditStatus,
  type AuditQuery,
  type AuditSummary,
  type AuditRetentionPolicy,
  TrustRelationshipManager,
  createTrustRelationshipManager,
  CapabilityDelegation,
  createCapabilityDelegation,
} from "../../../../src/scale-ecosystem/federation/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Index Export Tests - Types and Values
// ─────────────────────────────────────────────────────────────────────────────

test("federation-index: exports FederationGateway class", () => {
  assert.ok(typeof FederationGateway === "function");
});

test("federation-index: exports createFederationGateway factory function", () => {
  assert.ok(typeof createFederationGateway === "function");
});

test("federation-index: exports TrustLevel enum", () => {
  assert.ok(typeof TrustLevel === "object");
  assert.equal(TrustLevel.READ, "read");
});

test("federation-index: exports FederationAudit class", () => {
  assert.ok(typeof FederationAudit === "function");
});

test("federation-index: exports createFederationAudit factory function", () => {
  assert.ok(typeof createFederationAudit === "function");
});

test("federation-index: exports TrustRelationshipManager class", () => {
  assert.ok(typeof TrustRelationshipManager === "function");
});

test("federation-index: exports createTrustRelationshipManager factory function", () => {
  assert.ok(typeof createTrustRelationshipManager === "function");
});

test("federation-index: exports CapabilityDelegation class", () => {
  assert.ok(typeof CapabilityDelegation === "function");
});

test("federation-index: exports createCapabilityDelegation factory function", () => {
  assert.ok(typeof createCapabilityDelegation === "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Index Export Tests - Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

test("federation-index: exports FederationGatewayConfig type", () => {
  const config: FederationGatewayConfig = {
    federationId: "test",
    enableAudit: true,
    maxDelegationDepth: 3,
    requireApproval: true,
  };
  assert.ok(config != null);
});

test("federation-index: exports FederationOrg type", () => {
  const org: FederationOrg = {
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "standard",
    capabilities: new Set<string>(),
    enabled: true,
  };
  assert.ok(org != null);
  assert.equal(org.tier, "standard");
});

test("federation-index: exports CapabilityPermission type", () => {
  const permissions: CapabilityPermission[] = ["invoke", "configure", "delegate", "audit"];
  assert.ok(permissions.includes("invoke"));
  assert.ok(permissions.includes("delegate"));
});

test("federation-index: exports CapabilityConstraint type", () => {
  const constraint: CapabilityConstraint = {
    type: "rate_limit",
    value: 100,
    description: "Rate limit constraint",
  };
  assert.ok(constraint != null);
  assert.equal(constraint.type, "rate_limit");
});

test("federation-index: exports DelegationResult type", () => {
  const result: DelegationResult = {
    success: true,
  };
  assert.ok(result != null);
  assert.equal(result.success, true);
});

test("federation-index: exports FederationEvent type", () => {
  const event: FederationEvent = {
    type: "org.registered",
    sourceOrgId: "org-1",
    timestamp: new Date(),
    data: {},
  };
  assert.ok(event != null);
  assert.equal(event.type, "org.registered");
});

test("federation-index: exports FederationRegionPriority type", () => {
  const priority: FederationRegionPriority = {
    regionId: "us-east-1",
    federationId: "fed-1",
    priority: 1,
    isPreferred: true,
    failoverWeight: 100,
  };
  assert.ok(priority != null);
  assert.equal(priority.isPreferred, true);
});

test("federation-index: exports FederationTopologyDiff type", () => {
  const diff: FederationTopologyDiff = {
    addedRegions: [],
    removedRegions: [],
    modifiedRegions: [],
    unchangedRegions: [],
    diffTimestamp: new Date().toISOString(),
  };
  assert.ok(diff != null);
  assert.ok(Array.isArray(diff.addedRegions));
});

test("federation-index: exports FederationTopologyRegion type", () => {
  const region: FederationTopologyRegion = {
    regionId: "us-east-1",
    endpoint: "https://us-east-1.example.com",
    priority: 1,
    status: "active",
  };
  assert.ok(region != null);
  assert.equal(region.status, "active");
});

test("federation-index: exports FederationTopology type", () => {
  const topology: FederationTopology = {
    federationId: "fed-1",
    regions: [],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };
  assert.ok(topology != null);
  assert.equal(topology.federationId, "fed-1");
});

test("federation-index: exports FederationCatalogEntry type", () => {
  const entry: FederationCatalogEntry = {
    federationId: "fed-1",
    name: "Test Federation",
    description: "Test federation",
    regionCount: 1,
    orgCount: 2,
    trustLevel: TrustLevel.READ,
    capabilities: [],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.ok(entry != null);
  assert.equal(entry.status, "active");
});

test("federation-index: exports FederationCatalog type", () => {
  const catalog: FederationCatalog = {
    catalogId: "cat-1",
    entries: [],
    totalCount: 0,
    generatedAt: new Date().toISOString(),
  };
  assert.ok(catalog != null);
  assert.equal(catalog.totalCount, 0);
});

test("federation-index: exports FederationAuditRecord type", () => {
  const record: FederationAuditRecord = {
    id: "rec-1",
    timestamp: new Date(),
    orgId: "org-1",
    action: "org.registered",
    resourceType: "organization",
    status: "success",
    details: {},
  };
  assert.ok(record != null);
  assert.equal(record.action, "org.registered");
});

test("federation-index: exports AuditAction type", () => {
  const actions: AuditAction[] = [
    "org.registered",
    "trust.established",
    "capability.granted",
    "delegation.requested",
  ];
  assert.ok(actions.includes("org.registered"));
  assert.ok(actions.includes("trust.established"));
});

test("federation-index: exports ResourceType type", () => {
  const types: ResourceType[] = ["organization", "trust", "capability", "delegation", "audit"];
  assert.ok(types.includes("organization"));
  assert.ok(types.includes("trust"));
});

test("federation-index: exports AuditStatus type", () => {
  const statuses: AuditStatus[] = ["success", "failure", "pending", "denied"];
  assert.ok(statuses.includes("success"));
  assert.ok(statuses.includes("pending"));
});

test("federation-index: exports AuditQuery type", () => {
  const query: AuditQuery = {
    orgId: "org-1",
    limit: 100,
  };
  assert.ok(query != null);
  assert.equal(query.limit, 100);
});

test("federation-index: exports AuditSummary type", () => {
  const summary: AuditSummary = {
    totalRecords: 10,
    byAction: { "org.registered": 5 },
    byStatus: { success: 10 },
    byOrg: { "org-1": 10 },
    timeRange: { start: new Date(), end: new Date() },
  };
  assert.ok(summary != null);
  assert.equal(summary.totalRecords, 10);
});

test("federation-index: exports AuditRetentionPolicy type", () => {
  const policy: AuditRetentionPolicy = {
    maxAgeDays: 2555,
    minRetentionDays: 2555,
    archiveBeforeDelete: true,
    compressArchives: true,
  };
  assert.ok(policy != null);
  assert.equal(policy.maxAgeDays, 2555);
});

// ─────────────────────────────────────────────────────────────────────────────
// Index Export Tests - computeFederationTopologyDiff Function
// ─────────────────────────────────────────────────────────────────────────────

test("federation-index: exports computeFederationTopologyDiff function", () => {
  assert.ok(typeof computeFederationTopologyDiff === "function");
});

test("federation-index: computeFederationTopologyDiff returns empty diff for identical topologies", () => {
  const topology: FederationTopology = {
    federationId: "fed-1",
    regions: [
      {
        regionId: "us-east-1",
        endpoint: "https://us-east-1.example.com",
        priority: 1,
        status: "active",
      },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(topology, topology);

  assert.ok(diff != null);
  assert.equal(diff.addedRegions.length, 0);
  assert.equal(diff.removedRegions.length, 0);
  assert.equal(diff.modifiedRegions.length, 0);
  assert.equal(diff.unchangedRegions.length, 1);
});

test("federation-index: computeFederationTopologyDiff detects added regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [
      {
        regionId: "us-east-1",
        endpoint: "https://us-east-1.example.com",
        priority: 1,
        status: "active",
      },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);

  assert.ok(diff.addedRegions.includes("us-east-1"));
  assert.equal(diff.removedRegions.length, 0);
});

test("federation-index: computeFederationTopologyDiff detects removed regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [
      {
        regionId: "us-east-1",
        endpoint: "https://us-east-1.example.com",
        priority: 1,
        status: "active",
      },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);

  assert.ok(diff.removedRegions.includes("us-east-1"));
  assert.equal(diff.addedRegions.length, 0);
});

test("federation-index: computeFederationTopologyDiff detects modified regions", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [
      {
        regionId: "us-east-1",
        endpoint: "https://us-east-1.example.com",
        priority: 1,
        status: "active",
      },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [
      {
        regionId: "us-east-1",
        endpoint: "https://us-west-1.example.com",
        priority: 2,
        status: "standby",
      },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);

  assert.equal(diff.modifiedRegions.length, 1);
  assert.ok(diff.modifiedRegions[0].changes.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Index Export Tests - buildFederationCatalog Function
// ─────────────────────────────────────────────────────────────────────────────

test("federation-index: exports buildFederationCatalog function", () => {
  assert.ok(typeof buildFederationCatalog === "function");
});

test("federation-index: buildFederationCatalog builds catalog with no organizations", () => {
  const gateway = createFederationGateway();
  const catalog = buildFederationCatalog(gateway);

  assert.ok(catalog != null);
  assert.equal(catalog.totalCount, 0);
  assert.ok(Array.isArray(catalog.entries));
});

test("federation-index: buildFederationCatalog includes registered organizations", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.com",
    tier: "standard",
  });

  const catalog = buildFederationCatalog(gateway);

  assert.equal(catalog.totalCount, 1);
  assert.equal(catalog.entries[0].name, "Test Org");
});

test("federation-index: buildFederationCatalog filters by status", async () => {
  const gateway = createFederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Active Org",
    domain: "active.com",
    tier: "standard",
  });
  await gateway.registerOrganization({
    id: "org-2",
    name: "Inactive Org",
    domain: "inactive.com",
    tier: "standard",
  });
  await gateway.enableOrganization("org-2", false);

  const activeCatalog = buildFederationCatalog(gateway, { status: "active" });
  const inactiveCatalog = buildFederationCatalog(gateway, { status: "inactive" });

  assert.equal(activeCatalog.totalCount, 1);
  assert.equal(activeCatalog.entries[0].name, "Active Org");
  assert.equal(inactiveCatalog.totalCount, 1);
  assert.equal(inactiveCatalog.entries[0].name, "Inactive Org");
});

// ─────────────────────────────────────────────────────────────────────────────
// Index Integration Tests - Factory Functions Create Working Instances
// ─────────────────────────────────────────────────────────────────────────────

test("federation-index: createFederationGateway creates working gateway", async () => {
  const gateway = createFederationGateway({ federationId: "test-fed" });
  const org = await gateway.registerOrganization({
    id: "org-1",
    name: "Test",
    domain: "test.com",
    tier: "standard",
  });

  assert.ok(org != null);
  assert.equal(org.id, "org-1");
});

test("federation-index: createFederationAudit creates working audit", () => {
  const audit = createFederationAudit();
  const record = audit.record({
    orgId: "org-1",
    action: "org.registered",
    resourceType: "organization",
    status: "success",
    details: {},
  });

  assert.ok(record != null);
  assert.ok(record.id != null);
});

test("federation-index: createTrustRelationshipManager creates working manager", async () => {
  const manager = createTrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  assert.ok(trust != null);
  assert.equal(trust.sourceOrgId, "org-1");
});

test("federation-index: createCapabilityDelegation creates working delegation", () => {
  const delegation = createCapabilityDelegation();
  const capability = delegation.registerCapability({
    name: "Test Capability",
    description: "A test capability",
    category: "execution",
    permissions: ["invoke"],
    constraints: [],
    version: "1.0",
    deprecated: false,
  });

  assert.ok(capability != null);
  assert.ok(capability.id != null);
});