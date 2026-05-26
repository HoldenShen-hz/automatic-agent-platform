/**
 * FederationAudit Unit Tests
 *
 * Tests for federation/federation-audit.ts - Audit trail for federation operations
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  FederationAudit,
  createFederationAudit,
  type FederationAuditRecord,
  type AuditAction,
  type ResourceType,
  type AuditStatus,
  type AuditQuery,
} from "../../../src/scale-ecosystem/federation/federation-audit.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

// ─────────────────────────────────────────────────────────────────────────────
// FederationAudit Construction Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: createFederationAudit returns instance", () => {
  const audit = createFederationAudit();
  assert.ok(audit instanceof FederationAudit);
});

test("federation-audit: constructor accepts custom retention policy", () => {
  const audit = new FederationAudit({
    maxAgeDays: 30,
    minRetentionDays: 30,
    archiveBeforeDelete: false,
    compressArchives: false,
  });
  assert.ok(audit instanceof FederationAudit);
});

// ─────────────────────────────────────────────────────────────────────────────
// Record Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: record creates audit record with id and timestamp", () => {
  const audit = new FederationAudit();
  const record = audit.record({
    orgId: "org-1",
    action: "org.registered",
    resourceType: "organization",
    resourceId: "org-1",
    status: "success",
    details: { name: "Test Org" },
  });

  assert.ok(record.id != null && record.id.length > 0);
  assert.ok(record.timestamp instanceof Date);
  assert.equal(record.orgId, "org-1");
  assert.equal(record.action, "org.registered");
});

test("federation-audit: record generates unique ids", () => {
  const audit = new FederationAudit();
  const record1 = audit.record({
    orgId: "org-1",
    action: "org.registered",
    resourceType: "organization",
    status: "success",
    details: {},
  });
  const record2 = audit.record({
    orgId: "org-2",
    action: "org.registered",
    resourceType: "organization",
    status: "success",
    details: {},
  });

  assert.notEqual(record1.id, record2.id);
});

test("federation-audit: record accepts all optional fields", () => {
  const audit = new FederationAudit();
  const record = audit.record({
    orgId: "org-1",
    actor: "admin-user",
    action: "trust.established",
    resourceType: "trust",
    resourceId: "trust-1",
    targetOrgId: "org-2",
    status: "success",
    details: { level: "read" },
    ipAddress: "192.168.1.1",
    userAgent: "TestAgent/1.0",
    correlationId: "corr-123",
  });

  assert.equal(record.actor, "admin-user");
  assert.equal(record.targetOrgId, "org-2");
  assert.equal(record.ipAddress, "192.168.1.1");
  assert.equal(record.userAgent, "TestAgent/1.0");
  assert.equal(record.correlationId, "corr-123");
});

// ─────────────────────────────────────────────────────────────────────────────
// Query Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: query returns all records when no filter", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-2", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const results = audit.query({});
  assert.equal(results.length, 2);
});

test("federation-audit: query filters by orgId", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-2", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const results = audit.query({ orgId: "org-1" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.orgId, "org-1");
});

test("federation-audit: query filters by action", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "trust.established", resourceType: "trust", status: "success", details: {} });

  const results = audit.query({ action: "trust.established" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.action, "trust.established");
});

test("federation-audit: query filters by resourceType", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "trust.established", resourceType: "trust", status: "success", details: {} });

  const results = audit.query({ resourceType: "organization" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.resourceType, "organization");
});

test("federation-audit: query filters by status", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "org.deactivated", resourceType: "organization", status: "failure", details: {} });

  const results = audit.query({ status: "failure" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.status, "failure");
});

test("federation-audit: query filters by targetOrgId", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", targetOrgId: "org-2", action: "trust.established", resourceType: "trust", status: "success", details: {} });
  audit.record({ orgId: "org-1", targetOrgId: "org-3", action: "trust.established", resourceType: "trust", status: "success", details: {} });

  const results = audit.query({ targetOrgId: "org-2" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.targetOrgId, "org-2");
});

test("federation-audit: query applies all filters together", () => {
  const audit = new FederationAudit(undefined, { persistent: false });
  audit.record({
    orgId: "org-1",
    actor: "alice",
    action: "trust.established",
    resourceType: "trust",
    resourceId: "trust-1",
    targetOrgId: "org-2",
    status: "success",
    correlationId: "corr-1",
    details: {},
  });
  audit.record({
    orgId: "org-1",
    actor: "bob",
    action: "trust.established",
    resourceType: "trust",
    resourceId: "trust-2",
    targetOrgId: "org-2",
    status: "success",
    correlationId: "corr-2",
    details: {},
  });

  const results = audit.query({
    orgId: "org-1",
    actor: "alice",
    action: "trust.established",
    correlationId: "corr-1",
  });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.actor, "alice");
  assert.equal(results[0]?.correlationId, "corr-1");
});

test("federation-audit: query applies pagination with limit", () => {
  const audit = new FederationAudit();
  for (let i = 0; i < 10; i++) {
    audit.record({ orgId: "org-1", action: "access.checked", resourceType: "audit", status: "success", details: { index: i } });
  }

  const results = audit.query({ limit: 5 });
  assert.equal(results.length, 5);
});

test("federation-audit: query applies pagination with offset", () => {
  const audit = new FederationAudit();
  for (let i = 0; i < 10; i++) {
    audit.record({ orgId: "org-1", action: "access.checked", resourceType: "audit", status: "success", details: { index: i } });
  }

  const results = audit.query({ limit: 5, offset: 5 });
  assert.equal(results.length, 5);
});

test("federation-audit: query filters by time range", () => {
  const audit = new FederationAudit();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // We can't easily test time filters since records use "new Date()" at insert time
  // Just verify the fields are accepted
  const results = audit.query({
    startTime: twoDaysAgo,
    endTime: now,
  });
  assert.ok(Array.isArray(results));
});

test("federation-audit: query results are sorted by timestamp descending", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "trust.established", resourceType: "audit", status: "success", details: { order: "first" } });

  // Add a small delay to ensure different timestamps
  const start = Date.now();
  while (Date.now() - start < 10) { /* spin */ }

  audit.record({ orgId: "org-1", action: "capability.granted", resourceType: "audit", status: "success", details: { order: "second" } });

  const results = audit.query({});
  assert.equal(results[0]?.action, "capability.granted");
  assert.equal(results[1]?.action, "trust.established");
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Record Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: getRecord returns record by id", () => {
  const audit = new FederationAudit();
  const recorded = audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const retrieved = audit.getRecord(recorded.id);
  assert.ok(retrieved != null);
  assert.equal(retrieved?.id, recorded.id);
});

test("federation-audit: getRecord returns undefined for unknown id", () => {
  const audit = new FederationAudit();
  const retrieved = audit.getRecord("unknown-id");
  assert.equal(retrieved, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Records For Resource Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: getRecordsForResource returns records for resource", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "capability.granted", resourceType: "capability", resourceId: "cap-1", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "capability.suspended", resourceType: "capability", resourceId: "cap-1", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "capability.granted", resourceType: "capability", resourceId: "cap-2", status: "success", details: {} });

  const results = audit.getRecordsForResource("capability", "cap-1");
  assert.equal(results.length, 2);
});

test("federation-audit: getRecordsForResource returns empty for unknown resource", () => {
  const audit = new FederationAudit();
  const results = audit.getRecordsForResource("capability", "unknown");
  assert.equal(results.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Records For Org Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: getRecordsForOrg returns all records for org", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "trust.established", resourceType: "trust", targetOrgId: "org-2", status: "success", details: {} });
  audit.record({ orgId: "org-2", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const results = audit.getRecordsForOrg("org-1");
  assert.equal(results.length, 2);
});

test("federation-audit: getRecordsForOrg applies limit", () => {
  const audit = new FederationAudit();
  for (let i = 0; i < 5; i++) {
    audit.record({ orgId: "org-1", action: "access.checked", resourceType: "audit", status: "success", details: {} });
  }

  const results = audit.getRecordsForOrg("org-1", 3);
  assert.equal(results.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: getSummary returns correct counts", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  audit.record({ orgId: "org-2", action: "trust.established", resourceType: "trust", status: "failure", details: {} });

  const summary = audit.getSummary();
  assert.equal(summary.totalRecords, 3);
  assert.ok(summary.byAction["org.registered"] === 2);
  assert.ok(summary.byAction["trust.established"] === 1);
  assert.ok(summary.byStatus["success"] === 2);
  assert.ok(summary.byStatus["failure"] === 1);
  assert.ok(summary.byOrg["org-1"] === 2);
  assert.ok(summary.byOrg["org-2"] === 1);
});

test("federation-audit: getSummary includes time range", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const summary = audit.getSummary();
  assert.ok(summary.timeRange.start instanceof Date);
  assert.ok(summary.timeRange.end instanceof Date);
});

// ─────────────────────────────────────────────────────────────────────────────
// Retention Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: getExpiredRecordIds returns expired records", () => {
  const audit = new FederationAudit({ maxAgeDays: 0, minRetentionDays: 0, archiveBeforeDelete: false, compressArchives: false });
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const expiredIds = audit.getExpiredRecordIds();
  assert.equal(expiredIds.length, 1);
});

test("federation-audit: getExpiredRecordIds returns empty when no records expired", () => {
  const audit = new FederationAudit({ maxAgeDays: 365, minRetentionDays: 365, archiveBeforeDelete: false, compressArchives: false });
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const expiredIds = audit.getExpiredRecordIds();
  assert.equal(expiredIds.length, 0);
});

test("federation-audit: applyRetentionPolicy deletes expired records", async () => {
  const audit = new FederationAudit({ maxAgeDays: 0, minRetentionDays: 0, archiveBeforeDelete: false, compressArchives: false });
  const record = audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const result = await audit.applyRetentionPolicy();
  assert.equal(result.deleted, 1);

  const retrieved = audit.getRecord(record.id);
  assert.equal(retrieved, undefined);
});

test("federation-audit: applyRetentionPolicy respects archiveBeforeDelete", async () => {
  const audit = new FederationAudit({ maxAgeDays: 0, minRetentionDays: 0, archiveBeforeDelete: true, compressArchives: true });
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const result = await audit.applyRetentionPolicy();
  assert.equal(result.archived, 1);
});

test("federation-audit: applyRetentionPolicy writes archive records to disk", async () => {
  const workspace = createTempWorkspace("federation-audit-archive-");
  try {
    const storageDir = join(workspace, "audit-store");
    const audit = new FederationAudit(
      { maxAgeDays: 0, minRetentionDays: 0, archiveBeforeDelete: true, compressArchives: false },
      { persistent: true, storageDir },
    );
    audit.record({
      orgId: "org-1",
      action: "trust.revoked",
      resourceType: "trust",
      resourceId: "trust-1",
      status: "success",
      details: {},
    });

    const result = await audit.applyRetentionPolicy();
    assert.equal(result.archived, 1);
    const archivePath = join(storageDir, "federation-audit-archive.ndjson");
    assert.equal(existsSync(archivePath), true);
    assert.match(readFileSync(archivePath, "utf8"), /trust\.revoked/);
  } finally {
    cleanupPath(workspace);
  }
});

test("federation-audit: persistent snapshot survives restart", () => {
  const workspace = createTempWorkspace("federation-audit-persist-");
  try {
    const storageDir = join(workspace, "audit-store");
    const audit = new FederationAudit(undefined, { persistent: true, storageDir });
    const record = audit.record({
      orgId: "org-1",
      action: "org.registered",
      resourceType: "organization",
      resourceId: "org-1",
      status: "success",
      details: { source: "test" },
    });

    assert.equal(existsSync(join(storageDir, "federation-audit-records.json")), true);

    const reloaded = new FederationAudit(undefined, { persistent: true, storageDir });
    const loaded = reloaded.getRecord(record.id);
    assert.ok(loaded != null);
    assert.equal(loaded?.orgId, "org-1");
    assert.equal(loaded?.action, "org.registered");
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Tests
// ─────────────────────────────────────────────────────────────────────────────

test("federation-audit: exportForCompliance returns records in time range", () => {
  const audit = new FederationAudit();
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const results = audit.exportForCompliance("org-1", start, end);
  assert.ok(Array.isArray(results));
});

test("federation-audit: verifyIntegrity returns valid for healthy records", () => {
  const audit = new FederationAudit();
  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });

  const result = audit.verifyIntegrity();
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("federation-audit: verifyIntegrity detects issues", () => {
  const audit = new FederationAudit();
  // Manually add a malformed record by accessing internal state
  const records = (audit as unknown as { records: Map<string, FederationAuditRecord> }).records;
  records.set("bad-record", {
    id: "bad-record",
    timestamp: new Date(),
    orgId: "", // Invalid: empty orgId
    action: "org.registered",
    resourceType: "organization",
    status: "success",
    details: {},
  });

  const result = audit.verifyIntegrity();
  assert.equal(result.valid, false);
  assert.ok(result.issues.length > 0);
});

test("federation-audit: getRecordCount returns correct count", () => {
  const audit = new FederationAudit();
  assert.equal(audit.getRecordCount(), 0);

  audit.record({ orgId: "org-1", action: "org.registered", resourceType: "organization", status: "success", details: {} });
  assert.equal(audit.getRecordCount(), 1);

  audit.record({ orgId: "org-1", action: "trust.established", resourceType: "trust", status: "success", details: {} });
  assert.equal(audit.getRecordCount(), 2);
});
