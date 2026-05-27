/**
 * FederationGateway Unit Tests
 *
 * Tests for federation/federation-gateway.ts - Cross-org trust and capability delegation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  FederationGateway,
  createFederationGateway,
  computeFederationTopologyDiff,
  buildFederationCatalog,
  type FederationTopology,
  type FederationTopologyRegion,
} from "../../../src/scale-ecosystem/federation/federation-gateway.js";
import { TrustLevel } from "../../../src/scale-ecosystem/federation/trust-level.js";

// ─────────────────────────────────────────────────────────────────────────────
// FederationGateway Construction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: createFederationGateway returns instance [federation-gateway]", () => {
  const gateway = createFederationGateway();
  assert.ok(gateway instanceof FederationGateway);
});

test("federation-gateway: constructor accepts custom config [federation-gateway]", () => {
  const gateway = new FederationGateway({
    federationId: "custom-fed",
    enableAudit: false,
    maxDelegationDepth: 5,
    requireApproval: false,
  });
  assert.ok(gateway instanceof FederationGateway);
});

// ─────────────────────────────────────────────────────────────────────────────
// Organization Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: registerOrganization adds organization [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  const org = await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.example.com",
    tier: "standard",
  });

  assert.equal(org.id, "org-1");
  assert.equal(org.name, "Test Org");
  assert.equal(org.enabled, true);
  assert.ok(org.capabilities.size === 0);
});

test("federation-gateway: getOrganization returns registered org [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.example.com",
    tier: "standard",
  });

  const org = await gateway.getOrganization("org-1");
  assert.ok(org != null);
  assert.equal(org?.name, "Test Org");
});

test("federation-gateway: getOrganization returns undefined for unknown org [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  const org = await gateway.getOrganization("unknown");
  assert.equal(org, undefined);
});

test("federation-gateway: updateOrganizationCapabilities updates capabilities [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.example.com",
    tier: "standard",
  });

  await gateway.updateOrganizationCapabilities("org-1", ["cap-1", "cap-2"]);

  const org = await gateway.getOrganization("org-1");
  assert.ok(org?.capabilities.has("cap-1"));
  assert.ok(org?.capabilities.has("cap-2"));
});

test("federation-gateway: enableOrganization toggles enabled status [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.example.com",
    tier: "standard",
  });

  await gateway.enableOrganization("org-1", false);

  const org = await gateway.getOrganization("org-1");
  assert.equal(org?.enabled, false);
});

test("federation-gateway: snapshotCatalogState returns catalog snapshot [federation-gateway]", async () => {
  const gateway = new FederationGateway({ federationId: "test-fed" });
  await gateway.registerOrganization({
    id: "org-1",
    name: "Test Org",
    domain: "test.example.com",
    tier: "standard",
  });

  const snapshot = gateway.snapshotCatalogState();
  assert.equal(snapshot.federationId, "test-fed");
  assert.equal(snapshot.organizations.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Relationship Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: establishTrust creates trust relationship [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "enterprise" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);

  const trust = await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  assert.ok(trust.id != null && trust.id.length > 0);
  assert.match(trust.id, /^federation_trust_/);
  assert.equal(trust.sourceOrgId, "org-1");
  assert.equal(trust.targetOrgId, "org-2");
  assert.equal(trust.level, TrustLevel.READ);
});

test("federation-gateway: establishTrust throws for unknown org [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });

  await assert.rejects(
    async () => {
      await gateway.establishTrust({
        sourceOrgId: "org-1",
        targetOrgId: "unknown-org",
        level: TrustLevel.READ,
        capabilities: [],
        grantedBy: "admin",
      });
    },
    (err: unknown) => (err as Error).message.includes("not found")
  );
});

test("federation-gateway: getTrustRelationship returns trust by id [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });

  const established = await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: [],
    grantedBy: "admin",
  });

  const trust = await gateway.getTrustRelationship(established.id);
  assert.ok(trust != null);
  assert.equal(trust?.id, established.id);
});

test("federation-gateway: getTrustsForOrg returns all trusts for org [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-3", name: "Org 3", domain: "org3.com", tier: "standard" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1", "cap-2"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-3", ["cap-1"]);

  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });
  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-3",
    level: TrustLevel.AUDIT_ONLY,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  const trusts = await gateway.getTrustsForOrg("org-1");
  assert.equal(trusts.length, 2);
});

test("federation-gateway: revokeTrust sets expiry to now [federation-gateway]", async () => {
  const gateway = new FederationGateway();
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });

  const trust = await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: [],
    grantedBy: "admin",
  });

  await gateway.revokeTrust(trust.id, "admin");

  const revoked = await gateway.getTrustRelationship(trust.id);
  assert.ok(revoked?.expiresAt != null);
  assert.ok(revoked?.expiresAt?.getTime() <= new Date().getTime());
});

// ─────────────────────────────────────────────────────────────────────────────
// Capability Delegation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: requestDelegation returns pending when approval required [federation-gateway]", async () => {
  const gateway = new FederationGateway({ requireApproval: true });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);

  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  const result = await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["cap-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
  });

  assert.equal(result.success, true);
  assert.equal(result.errorCode, "PENDING_APPROVAL");
});

test("federation-gateway: approveDelegation creates capability grant [federation-gateway]", async () => {
  const gateway = new FederationGateway({ requireApproval: true });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);

  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  const requestResult = await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["cap-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
  });

  assert.equal(requestResult.success, true);
  const requestId = (requestResult as { error?: string }).error?.split(":")[1];

  assert.ok(requestId, "requestId should be extracted");
  assert.match(requestId!, /^federation_request_/);
  const approveResult = await gateway.approveDelegation(requestId!, "approver");
  assert.equal(approveResult.success, true);
  assert.ok(approveResult.grant != null);
  assert.match(approveResult.grant?.id ?? "", /^federation_grant_/);
});

test("federation-gateway: revokeCapabilityGrant updates grant status [federation-gateway]", async () => {
  const gateway = new FederationGateway({ requireApproval: false });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);

  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["cap-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
  });

  // Get the grant and revoke it
  const grants = await gateway.getCapabilityGrantsForOrg("org-1");
  if (grants.length > 0) {
    await gateway.revokeCapabilityGrant(grants[0]!.id, "admin");
    assert.equal(grants[0]!.status, "revoked");
  }
});

test("federation-gateway: getCapabilityGrantsForOrg returns grants [federation-gateway]", async () => {
  const gateway = new FederationGateway({ requireApproval: false });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);

  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["cap-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
  });

  const grants = await gateway.getCapabilityGrantsForOrg("org-1");
  assert.ok(grants.length > 0);
});

test("federation-gateway: checkCapabilityAccess returns boolean [federation-gateway]", async () => {
  const gateway = new FederationGateway({ requireApproval: false });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });
  await gateway.updateOrganizationCapabilities("org-1", ["cap-1"]);
  await gateway.updateOrganizationCapabilities("org-2", ["cap-1"]);

  await gateway.establishTrust({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
    grantedBy: "admin",
  });

  await gateway.requestDelegation({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    capabilities: ["cap-1"],
    requestedPermissions: ["invoke"],
    constraints: [],
    requestedBy: "user",
  });

  const hasAccess = await gateway.checkCapabilityAccess("org-2", "org-1", "cap-1", "invoke");
  assert.equal(typeof hasAccess, "boolean");
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: getAuditLog returns audit events [federation-gateway]", async () => {
  const gateway = new FederationGateway({ enableAudit: true });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });

  const auditLog = gateway.getAuditLog();
  assert.ok(auditLog.length > 0);
});

test("federation-gateway: getAuditLog filters by orgId [federation-gateway]", async () => {
  const gateway = new FederationGateway({ enableAudit: true });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "standard" });

  const auditLog = gateway.getAuditLog("org-1");
  assert.ok(auditLog.every((e) => e.sourceOrgId === "org-1"));
});

test("federation-gateway: getAuditLog respects limit [federation-gateway]", async () => {
  const gateway = new FederationGateway({ enableAudit: true });
  for (let i = 0; i < 5; i++) {
    await gateway.registerOrganization({ id: `org-${i}`, name: `Org ${i}`, domain: `org${i}.com`, tier: "standard" });
  }

  const auditLog = gateway.getAuditLog(undefined, 3);
  assert.equal(auditLog.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Federation Topology Diff Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: computeFederationTopologyDiff detects added regions [federation-gateway]", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "r1", endpoint: "https://r1.example.com", priority: 1, status: "active" }],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [
      { regionId: "r1", endpoint: "https://r1.example.com", priority: 1, status: "active" },
      { regionId: "r2", endpoint: "https://r2.example.com", priority: 2, status: "active" },
    ],
    version: "1.1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);

  assert.ok(diff.addedRegions.includes("r2"));
  assert.ok(diff.removedRegions.length === 0);
});

test("federation-gateway: computeFederationTopologyDiff detects removed regions [federation-gateway]", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [
      { regionId: "r1", endpoint: "https://r1.example.com", priority: 1, status: "active" },
      { regionId: "r2", endpoint: "https://r2.example.com", priority: 2, status: "active" },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "r1", endpoint: "https://r1.example.com", priority: 1, status: "active" }],
    version: "1.1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);

  assert.ok(diff.removedRegions.includes("r2"));
  assert.ok(diff.addedRegions.length === 0);
});

test("federation-gateway: computeFederationTopologyDiff detects modified regions [federation-gateway]", () => {
  const left: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "r1", endpoint: "https://r1.example.com", priority: 1, status: "active" }],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const right: FederationTopology = {
    federationId: "fed-1",
    regions: [{ regionId: "r1", endpoint: "https://r1-new.example.com", priority: 2, status: "standby" }],
    version: "1.1",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(left, right);

  assert.ok(diff.modifiedRegions.length === 1);
  assert.equal(diff.modifiedRegions[0]?.regionId, "r1");
});

test("federation-gateway: computeFederationTopologyDiff identifies unchanged regions [federation-gateway]", () => {
  const topology: FederationTopology = {
    federationId: "fed-1",
    regions: [
      { regionId: "r1", endpoint: "https://r1.example.com", priority: 1, status: "active" },
      { regionId: "r2", endpoint: "https://r2.example.com", priority: 2, status: "active" },
    ],
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };

  const diff = computeFederationTopologyDiff(topology, topology);

  assert.ok(diff.unchangedRegions.includes("r1"));
  assert.ok(diff.unchangedRegions.includes("r2"));
  assert.ok(diff.addedRegions.length === 0);
  assert.ok(diff.removedRegions.length === 0);
  assert.ok(diff.modifiedRegions.length === 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Federation Catalog Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-gateway: buildFederationCatalog creates catalog entry for each org [federation-gateway]", async () => {
  const gateway = new FederationGateway({ federationId: "test-fed" });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.registerOrganization({ id: "org-2", name: "Org 2", domain: "org2.com", tier: "enterprise" });

  const catalog = buildFederationCatalog(gateway);

  assert.equal(catalog.totalCount, 2);
  assert.ok(catalog.entries.length === 2);
  assert.equal(catalog.entries[0]?.federationId, "test-fed");
  assert.equal(catalog.entries[1]?.federationId, "test-fed");
});

test("federation-gateway: buildFederationCatalog filters by status [federation-gateway]", async () => {
  const gateway = new FederationGateway({ federationId: "test-fed" });
  await gateway.registerOrganization({ id: "org-1", name: "Org 1", domain: "org1.com", tier: "standard" });
  await gateway.enableOrganization("org-1", false);

  const catalog = buildFederationCatalog(gateway, { status: "inactive" });

  assert.equal(catalog.totalCount, 1);
  assert.equal(catalog.entries[0]?.status, "inactive");
});
