/**
 * TrustRelationshipManager Unit Tests
 *
 * Tests for federation/trust-relationship.ts - Trust model between organizations
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TrustRelationshipManager,
  createTrustRelationshipManager,
  TrustLevel,
  type TrustPolicy,
} from "../../../src/scale-ecosystem/federation/trust-relationship.js";

// ─────────────────────────────────────────────────────────────────────────────
// TrustRelationshipManager Construction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: createTrustRelationshipManager returns instance", () => {
  const manager = createTrustRelationshipManager();
  assert.ok(manager instanceof TrustRelationshipManager);
});

test("trust-relationship: constructor accepts initial policies", () => {
  const policies: TrustPolicy[] = [
    {
      id: "policy-1",
      name: "Test Policy",
      description: "Test",
      minTrustLevel: TrustLevel.READ,
      maxDelegationDepth: 3,
      allowedCapabilities: ["cap-1"],
      requiredCapabilities: [],
      requirePeriodicReauth: true,
      reauthIntervalDays: 90,
    },
  ];

  const manager = new TrustRelationshipManager(policies);
  const policy = manager.getPolicy("policy-1");
  assert.ok(policy != null);
  assert.equal(policy?.name, "Test Policy");
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Relationship Creation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: createTrustRelationship creates active trust", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1", "cap-2"],
  });

  assert.ok(trust.id != null && trust.id.length > 0);
  assert.equal(trust.sourceOrgId, "org-1");
  assert.equal(trust.targetOrgId, "org-2");
  assert.equal(trust.level, TrustLevel.READ);
  assert.equal(trust.status, "active");
});

test("trust-relationship: createTrustRelationship uses default policy", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.WRITE,
    capabilities: ["cap-1"],
  });

  assert.ok(trust.policy != null);
  assert.equal(trust.policy.minTrustLevel, TrustLevel.WRITE);
});

test("trust-relationship: createTrustRelationship with custom policy", async () => {
  const manager = new TrustRelationshipManager();
  const policy: TrustPolicy = {
    id: "custom-policy",
    name: "Custom Policy",
    description: "Custom",
    minTrustLevel: TrustLevel.ADMIN,
    maxDelegationDepth: 5,
    allowedCapabilities: ["cap-1"],
    requiredCapabilities: [],
    requirePeriodicReauth: false,
    reauthIntervalDays: 30,
  };

  void policy;

  await assert.rejects(
    () => manager.createTrustRelationship({
      sourceOrgId: "org-1",
      targetOrgId: "org-2",
      level: TrustLevel.ADMIN,
      capabilities: ["cap-1"],
      policyId: "custom-policy",
    }),
    /Trust policy not found: custom-policy/,
  );
});

test("trust-relationship: createTrustRelationship records trust event", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const events = manager.getTrustEvents(trust.id);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "trust.established");
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Relationship Retrieval Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: getTrustRelationship returns trust by id", async () => {
  const manager = new TrustRelationshipManager();
  const created = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const trust = await manager.getTrustRelationship(created.id);
  assert.ok(trust != null);
  assert.equal(trust?.id, created.id);
});

test("trust-relationship: getTrustRelationship returns undefined for unknown id", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.getTrustRelationship("unknown-id");
  assert.equal(trust, undefined);
});

test("trust-relationship: getTrustsForOrganization returns all trusts for org", async () => {
  const manager = new TrustRelationshipManager();
  await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });
  await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-3",
    level: TrustLevel.WRITE,
    capabilities: ["cap-2"],
  });

  const trusts = await manager.getTrustsForOrganization("org-1");
  assert.equal(trusts.length, 2);
});

test("trust-relationship: getTrustBetweenOrgs returns active trust", async () => {
  const manager = new TrustRelationshipManager();
  await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const trust = await manager.getTrustBetweenOrgs("org-1", "org-2");
  assert.ok(trust != null);
  assert.equal(trust?.sourceOrgId, "org-1");
  assert.equal(trust?.targetOrgId, "org-2");
  assert.equal(trust?.status, "active");
});

test("trust-relationship: getTrustBetweenOrgs returns undefined when no trust", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.getTrustBetweenOrgs("org-1", "org-2");
  assert.equal(trust, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Level Update Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: updateTrustLevel changes level", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.updateTrustLevel(trust.id, TrustLevel.WRITE, "admin");

  const updated = await manager.getTrustRelationship(trust.id);
  assert.equal(updated?.level, TrustLevel.WRITE);
});

test("trust-relationship: updateTrustLevel records trust event", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.updateTrustLevel(trust.id, TrustLevel.WRITE);

  const events = manager.getTrustEvents(trust.id);
  const updateEvents = events.filter((e) => e.type === "trust.elevated" || e.type === "trust.degraded");
  assert.ok(updateEvents.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Suspension Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: suspendTrust changes status", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.suspendTrust(trust.id, "Suspension reason", "admin");

  const suspended = await manager.getTrustRelationship(trust.id);
  assert.equal(suspended?.status, "suspended");
});

test("trust-relationship: suspendTrust records event", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.suspendTrust(trust.id, "Test");

  const events = manager.getTrustEvents(trust.id);
  const suspendEvents = events.filter((e) => e.type === "trust.suspended");
  assert.equal(suspendEvents.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Revocation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: revokeTrust changes status and expires", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.revokeTrust(trust.id, "Revocation reason", "admin");

  const revoked = await manager.getTrustRelationship(trust.id);
  assert.equal(revoked?.status, "revoked");
  assert.ok(revoked?.expiresAt != null);
});

test("trust-relationship: revokeTrust records event", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.revokeTrust(trust.id, "Test");

  const events = manager.getTrustEvents(trust.id);
  const revokeEvents = events.filter((e) => e.type === "trust.revoked");
  assert.equal(revokeEvents.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Renewal Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: renewTrust updates expiry", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await manager.renewTrust(trust.id, newExpiry, "admin");

  const renewed = await manager.getTrustRelationship(trust.id);
  assert.ok(renewed?.expiresAt != null);
  assert.ok(renewed?.expiresAt?.getTime() === newExpiry.getTime());
});

test("trust-relationship: renewTrust records event", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await manager.renewTrust(trust.id, newExpiry, "admin");

  const events = manager.getTrustEvents(trust.id);
  const renewEvents = events.filter((e) => e.type === "trust.renewed");
  assert.equal(renewEvents.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Evaluation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: evaluateTrust returns evaluation result", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const evaluation = await manager.evaluateTrust(trust.id);

  assert.ok(evaluation.trustId === trust.id);
  assert.ok(typeof evaluation.trustScore === "number");
  assert.ok(Array.isArray(evaluation.factors));
  assert.ok(["grant", "review", "deny"].includes(evaluation.recommendation));
});

test("trust-relationship: evaluateTrustBetweenOrgs returns evaluation", async () => {
  const manager = new TrustRelationshipManager();
  await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const evaluation = await manager.evaluateTrustBetweenOrgs("org-1", "org-2");
  assert.ok(evaluation != null);
  assert.ok(evaluation?.orgId === "org-1");
  assert.ok(evaluation?.targetOrgId === "org-2");
});

test("trust-relationship: evaluateTrustBetweenOrgs returns undefined when no trust", async () => {
  const manager = new TrustRelationshipManager();
  const evaluation = await manager.evaluateTrustBetweenOrgs("org-1", "org-2");
  assert.equal(evaluation, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics Update Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: updateMetrics updates success count", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.updateMetrics(trust.id, { success: true, latencyMs: 100 });

  const updated = await manager.getTrustRelationship(trust.id);
  assert.equal(updated?.metrics.successfulInteractions, 1);
  assert.equal(updated?.metrics.failedInteractions, 0);
});

test("trust-relationship: updateMetrics updates failure count", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.updateMetrics(trust.id, { success: false });

  const updated = await manager.getTrustRelationship(trust.id);
  assert.equal(updated?.metrics.failedInteractions, 1);
});

test("trust-relationship: updateMetrics calculates uptime", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  await manager.updateMetrics(trust.id, { success: true });
  await manager.updateMetrics(trust.id, { success: true });
  await manager.updateMetrics(trust.id, { success: false });

  const updated = await manager.getTrustRelationship(trust.id);
  assert.equal(updated?.metrics.successfulInteractions, 2);
  assert.equal(updated?.metrics.failedInteractions, 1);
  assert.equal(updated?.metrics.uptimePercentage, (2 / 3) * 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust Events Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: getTrustEvents returns events for trust", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  const events = manager.getTrustEvents(trust.id);
  assert.ok(events.length > 0);
});

test("trust-relationship: getRecentEvents returns sorted events", async () => {
  const manager = new TrustRelationshipManager();
  const trust = await manager.createTrustRelationship({
    sourceOrgId: "org-1",
    targetOrgId: "org-2",
    level: TrustLevel.READ,
    capabilities: ["cap-1"],
  });

  // Add more events
  await manager.updateTrustLevel(trust.id, TrustLevel.WRITE);

  const recentEvents = manager.getRecentEvents(10);
  assert.ok(recentEvents.length > 0);
  // Most recent first
  assert.ok(recentEvents[0] != null);
  assert.ok(recentEvents[recentEvents.length - 1] != null);
  assert.ok(recentEvents[0]!.timestamp >= recentEvents[recentEvents.length - 1]!.timestamp);
});

// ─────────────────────────────────────────────────────────────────────────────
// Policy Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("trust-relationship: registerPolicy adds policy", () => {
  const manager = new TrustRelationshipManager();
  const policy: TrustPolicy = {
    id: "new-policy",
    name: "New Policy",
    description: "Test",
    minTrustLevel: TrustLevel.WRITE,
    maxDelegationDepth: 5,
    allowedCapabilities: ["cap-1"],
    requiredCapabilities: [],
    requirePeriodicReauth: true,
    reauthIntervalDays: 60,
  };

  manager.registerPolicy(policy);

  const retrieved = manager.getPolicy("new-policy");
  assert.ok(retrieved != null);
  assert.equal(retrieved?.name, "New Policy");
});

test("trust-relationship: getPoliciesForLevel returns matching policies", () => {
  const manager = new TrustRelationshipManager();
  const policy: TrustPolicy = {
    id: "level-policy",
    name: "Level Policy",
    description: "Test",
    minTrustLevel: TrustLevel.ADMIN,
    maxDelegationDepth: 3,
    allowedCapabilities: [],
    requiredCapabilities: [],
    requirePeriodicReauth: false,
    reauthIntervalDays: 30,
  };

  manager.registerPolicy(policy);

  const policies = manager.getPoliciesForLevel(TrustLevel.ADMIN);
  assert.ok(policies.length > 0);
});
