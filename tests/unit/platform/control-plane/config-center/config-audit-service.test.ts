/**
 * Unit tests for ConfigAuditService
 *
 * Tests cover:
 * - Recording create, update, delete, rollback actions
 * - Approval/rejection workflow
 * - Querying with various filters
 * - Pagination support
 * - Statistics generation
 * - Entry pruning
 */

import assert from "node:assert/strict";
import test from "node:test";
import { sha256, stableStringify } from "../../../../../src/platform/five-plane-control-plane/config-center/config-governance-support.js";
import {
  ConfigAuditService,
  type ConfigAuditAction,
  type ConfigAuditEntry,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-audit-service.js";

// Helper to create deterministic content hash
function contentHash(content: Record<string, unknown>): string {
  return sha256(stableStringify(content));
}

test("recordCreate generates audit entry with correct structure", () => {
  const service = new ConfigAuditService();
  const content = { timeout: 30000, retries: 3 };

  const entry = service.recordCreate(
    "platform.runtime.config",
    "platform",
    null,
    content,
    "user-123",
    "Initial configuration",
  );

  assert.ok(entry.auditId.startsWith("caud_"), "auditId should start with caud_");
  assert.equal(entry.configPath, "platform.runtime.config");
  assert.equal(entry.layer, "platform");
  assert.equal(entry.sourceId, null);
  assert.equal(entry.action, "create");
  assert.equal(entry.actor, "user-123");
  assert.equal(entry.beforeHash, null);
  assert.equal(entry.afterHash, contentHash(content));
  assert.equal(entry.reason, "Initial configuration");
  assert.equal(entry.approvalRequired, false);
  assert.equal(entry.approvalStatus, null);
  assert.equal(entry.approvedBy, null);
  assert.equal(entry.approvedAt, null);
  assert.equal(entry.versionId, null);
  assert.equal(entry.previousVersionId, null);
  assert.ok(entry.timestamp.length > 0);
});

test("recordCreate with approvalRequired sets pending status", () => {
  const service = new ConfigAuditService();
  const content = { critical: true };

  const entry = service.recordCreate(
    "platform.protected.config",
    "platform",
    null,
    content,
    "user-123",
    "Protected config",
    { approvalRequired: true },
  );

  assert.equal(entry.approvalRequired, true);
  assert.equal(entry.approvalStatus, "pending");
});

test("recordCreate with versionId stores version", () => {
  const service = new ConfigAuditService();

  const entry = service.recordCreate(
    "platform.versioned.config",
    "platform",
    null,
    { value: 1 },
    "user",
    null,
    { versionId: "v1.0.0" },
  );

  assert.equal(entry.versionId, "v1.0.0");
});

test("recordUpdate computes diff and stores hashes", () => {
  const service = new ConfigAuditService();
  const before = { timeout: 30000, retries: 3 };
  const after = { timeout: 60000, retries: 3 };

  const entry = service.recordUpdate(
    "tenant-1.runtime.timeout",
    "tenant",
    "tenant-1",
    before,
    after,
    "admin-001",
    "Increase timeout",
  );

  assert.equal(entry.action, "update");
  assert.equal(entry.configPath, "tenant-1.runtime.timeout");
  assert.equal(entry.layer, "tenant");
  assert.equal(entry.sourceId, "tenant-1");
  assert.equal(entry.actor, "admin-001");
  assert.equal(entry.beforeHash, contentHash(before));
  assert.equal(entry.afterHash, contentHash(after));
  assert.ok(entry.changes.length > 0, "should have computed changes");
  assert.ok(entry.changes.some((c) => c.path === "timeout"), "should detect timeout change");
});

test("recordUpdate with approvalRequired sets pending status", () => {
  const service = new ConfigAuditService();

  const entry = service.recordUpdate(
    "platform.protected",
    "platform",
    null,
    { old: 1 },
    { new: 2 },
    "user",
    null,
    { approvalRequired: true },
  );

  assert.equal(entry.approvalStatus, "pending");
});

test("recordDelete stores before hash with no after hash", () => {
  const service = new ConfigAuditService();
  const before = { deprecated: true, value: 123 };

  const entry = service.recordDelete(
    "platform.legacy.setting",
    "platform",
    null,
    before,
    "system",
    "Remove deprecated config",
  );

  assert.equal(entry.action, "delete");
  assert.equal(entry.beforeHash, contentHash(before));
  assert.equal(entry.afterHash, null);
  assert.equal(entry.reason, "Remove deprecated config");
});

test("recordRollback generates entry with target version metadata", () => {
  const service = new ConfigAuditService();
  const before = { version: 2, timeout: 60000 };
  const after = { version: 1, timeout: 30000 };

  const entry = service.recordRollback(
    "tenant-1.config.feature",
    "tenant",
    "tenant-1",
    before,
    after,
    "v1-stable",
    "admin-001",
    null,
  );

  assert.equal(entry.action, "rollback");
  assert.equal(entry.metadata?.targetVersionId, "v1-stable");
  assert.ok(entry.reason?.includes("v1-stable"), "reason should include target version");
  assert.ok(entry.changes.length > 0, "should compute diff between versions");
});

test("recordApproval updates entry with approval details", () => {
  const service = new ConfigAuditService();
  const createEntry = service.recordCreate(
    "platform.protected",
    "platform",
    null,
    { value: 1 },
    "user-123",
    "Test config",
    { approvalRequired: true },
  );

  const approved = service.recordApproval(createEntry.auditId, "approver-001", "Looks good");

  assert.ok(approved !== null, "should return updated entry");
  assert.equal(approved!.approvalStatus, "approved");
  assert.equal(approved!.approvedBy, "approver-001");
  assert.equal(approved!.approvedAt !== null, true);
});

test("recordApproval returns null for non-existent auditId", () => {
  const service = new ConfigAuditService();

  const result = service.recordApproval("non-existent-id", "approver", null);

  assert.equal(result, null);
});

test("recordRejection updates entry with rejection details", () => {
  const service = new ConfigAuditService();
  const createEntry = service.recordCreate(
    "platform.protected",
    "platform",
    null,
    { value: 1 },
    "user-123",
    "Test config",
    { approvalRequired: true },
  );

  const rejected = service.recordRejection(createEntry.auditId, "security-team", "Security concern");

  assert.ok(rejected !== null);
  assert.equal(rejected!.approvalStatus, "rejected");
  assert.equal(rejected!.approvedBy, "security-team");
});

test("recordRejection returns null for non-existent auditId", () => {
  const service = new ConfigAuditService();

  const result = service.recordRejection("non-existent-id", "rejector", null);

  assert.equal(result, null);
});

test("getEntry retrieves specific audit entry", () => {
  const service = new ConfigAuditService();
  const created = service.recordCreate("platform.test", "platform", null, {}, "user", null);

  const retrieved = service.getEntry(created.auditId);

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.auditId, created.auditId);
});

test("getEntry returns null for non-existent id", () => {
  const service = new ConfigAuditService();

  const result = service.getEntry("non-existent");

  assert.equal(result, null);
});

test("getEntriesForConfig returns entries for specific config path", () => {
  const service = new ConfigAuditService();

  service.recordCreate("platform.timeout", "platform", null, { val: 1 }, "user", null);
  service.recordUpdate("platform.timeout", "platform", null, { val: 1 }, { val: 2 }, "user", null);
  service.recordCreate("platform.retries", "platform", null, { val: 3 }, "user", null);

  const entries = service.getEntriesForConfig("platform.timeout", "platform", null);

  assert.equal(entries.length, 2);
  assert.ok(entries.every((e) => e.configPath === "platform.timeout"));
});

test("getEntriesForConfig filters by sourceId", () => {
  const service = new ConfigAuditService();

  service.recordCreate("config", "tenant", "tenant-1", {}, "user", null);
  service.recordCreate("config", "tenant", "tenant-2", {}, "user", null);
  service.recordCreate("config", "tenant", null, {}, "user", null);

  const tenant1Entries = service.getEntriesForConfig("config", "tenant", "tenant-1");
  const noSourceEntries = service.getEntriesForConfig("config", "tenant", null);

  assert.equal(tenant1Entries.length, 1);
  assert.equal(noSourceEntries.length, 1);
});

test("query filters by exact configPath", () => {
  const service = new ConfigAuditService();

  service.recordCreate("platform.config1", "platform", null, {}, "user", null);
  service.recordCreate("platform.config2", "platform", null, {}, "user", null);

  const result = service.query({ configPath: "platform.config1" });

  assert.equal(result.totalCount, 1);
  assert.equal(result.entries[0]!.configPath, "platform.config1");
});

test("query filters by configPath prefix wildcard", () => {
  const service = new ConfigAuditService();

  service.recordCreate("platform.timeout", "platform", null, {}, "user", null);
  service.recordCreate("platform.retries", "platform", null, {}, "user", null);
  service.recordCreate("tenant.timeout", "tenant", "t1", {}, "user", null);

  const result = service.query({ configPath: "platform.*" });

  assert.equal(result.totalCount, 2);
  assert.ok(result.entries.every((e) => e.configPath.startsWith("platform.")));
});

test("query filters by layer", () => {
  const service = new ConfigAuditService();

  service.recordCreate("c1", "platform", null, {}, "user", null);
  service.recordCreate("c2", "tenant", "t1", {}, "user", null);
  service.recordCreate("c3", "tenant", "t2", {}, "user", null);

  const result = service.query({ layer: "tenant" });

  assert.equal(result.totalCount, 2);
  assert.ok(result.entries.every((e) => e.layer === "tenant"));
});

test("query filters by sourceId", () => {
  const service = new ConfigAuditService();

  service.recordCreate("config", "tenant", "tenant-1", {}, "user", null);
  service.recordCreate("config", "tenant", "tenant-2", {}, "user", null);

  const result = service.query({ sourceId: "tenant-1" });

  assert.equal(result.totalCount, 1);
  assert.equal(result.entries[0]!.sourceId, "tenant-1");
});

test("query filters by actor", () => {
  const service = new ConfigAuditService();

  service.recordCreate("c1", "p", null, {}, "alice", null);
  service.recordCreate("c2", "p", null, {}, "bob", null);
  service.recordCreate("c3", "p", null, {}, "alice", null);

  const result = service.query({ actor: "alice" });

  assert.equal(result.totalCount, 2);
});

test("query filters by action type", () => {
  const service = new ConfigAuditService();

  service.recordCreate("c1", "p", null, {}, "user", null);
  service.recordUpdate("c2", "p", null, {}, {}, "user", null);
  service.recordDelete("c3", "p", null, {}, "user", null);

  const createResult = service.query({ action: "create" as ConfigAuditAction });
  const deleteResult = service.query({ action: "delete" as ConfigAuditAction });

  assert.equal(createResult.totalCount, 1);
  assert.equal(deleteResult.totalCount, 1);
});

test("query filters by approvalStatus", () => {
  const service = new ConfigAuditService();

  const pending1 = service.recordCreate("c1", "p", null, {}, "u", null, { approvalRequired: true });
  const pending2 = service.recordCreate("c2", "p", null, {}, "u", null, { approvalRequired: true });
  service.recordCreate("c3", "p", null, {}, "u", null, { approvalRequired: false });

  service.recordApproval(pending1.auditId, "approver", null);

  const pendingResult = service.query({ approvalStatus: "pending" });
  const approvedResult = service.query({ approvalStatus: "approved" });

  assert.equal(pendingResult.totalCount, 1);
  assert.equal(approvedResult.totalCount, 1);
});

test("query filters by time range", () => {
  const service = new ConfigAuditService();

  service.recordCreate("config", "platform", null, {}, "user", null);

  const past = new Date(Date.now() - 10000).toISOString();
  const future = new Date(Date.now() + 10000).toISOString();
  const farFuture = new Date(Date.now() + 20000).toISOString();

  const currentResult = service.query({ startTime: past, endTime: future });
  const farFutureResult = service.query({ startTime: future, endTime: farFuture });

  assert.equal(currentResult.totalCount, 1);
  assert.equal(farFutureResult.totalCount, 0);
});

test("query sorts by timestamp descending", () => {
  const service = new ConfigAuditService();

  service.recordCreate("c1", "p", null, {}, "user", null);
  service.recordCreate("c2", "p", null, {}, "user", null);
  service.recordCreate("c3", "p", null, {}, "user", null);

  const result = service.query({});

  for (let i = 0; i < result.entries.length - 1; i++) {
    assert.ok(
      result.entries[i]!.timestamp >= result.entries[i + 1]!.timestamp,
      "entries should be sorted descending by timestamp",
    );
  }
});

test("query pagination returns correct slices", () => {
  const service = new ConfigAuditService();

  for (let i = 0; i < 10; i++) {
    service.recordCreate(`config.${i}`, "platform", null, { index: i }, "user", null);
  }

  const page1 = service.query({ limit: 3, offset: 0 });
  const page2 = service.query({ limit: 3, offset: 3 });
  const page4 = service.query({ limit: 3, offset: 9 });

  assert.equal(page1.entries.length, 3);
  assert.equal(page2.entries.length, 3);
  assert.equal(page4.entries.length, 1);
  assert.equal(page1.totalCount, 10);
  assert.equal(page2.hasMore, true);
  assert.equal(page4.hasMore, false);
});

test("getPendingApprovals returns only pending entries", () => {
  const service = new ConfigAuditService();

  service.recordCreate("c1", "p", null, {}, "u", null, { approvalRequired: false });
  const pending1 = service.recordCreate("c2", "p", null, {}, "u", null, { approvalRequired: true });
  const pending2 = service.recordCreate("c3", "p", null, {}, "u", null, { approvalRequired: true });

  service.recordApproval(pending1.auditId, "approver", null);

  const pending = service.getPendingApprovals();

  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.auditId, pending2.auditId);
});

test("getPendingApprovals filters by layer when provided", () => {
  const service = new ConfigAuditService();

  service.recordCreate("c1", "platform", null, {}, "u", null, { approvalRequired: true });
  service.recordCreate("c2", "tenant", "t1", {}, "u", null, { approvalRequired: true });

  const platformPending = service.getPendingApprovals("platform");
  const tenantPending = service.getPendingApprovals("tenant");

  assert.equal(platformPending.length, 1);
  assert.equal(tenantPending.length, 1);
  assert.equal(platformPending[0]!.layer, "platform");
  assert.equal(tenantPending[0]!.layer, "tenant");
});

test("getStats returns correct counts", () => {
  const service = new ConfigAuditService();

  service.recordCreate("config", "platform", null, {}, "user", null);
  service.recordUpdate("config", "platform", null, {}, {}, "user", null);
  service.recordUpdate("config", "platform", null, {}, {}, "user", null);
  service.recordDelete("config", "platform", null, {}, "user", null);

  const stats = service.getStats("config", "platform", null);

  assert.equal(stats.totalEntries, 4);
  assert.equal(stats.createCount, 1);
  assert.equal(stats.updateCount, 2);
  assert.equal(stats.deleteCount, 1);
  assert.equal(stats.rollbackCount, 0);
});

test("getStats tracks pending approvals", () => {
  const service = new ConfigAuditService();

  const pending1 = service.recordCreate("config", "platform", null, {}, "u", null, { approvalRequired: true });
  service.recordCreate("config", "platform", null, {}, "u", null, { approvalRequired: true });
  service.recordApproval(pending1.auditId, "approver", null);

  const stats = service.getStats("config", "platform", null);

  assert.equal(stats.pendingApprovalCount, 1);
});

test("getStats returns null timestamps when no entries", () => {
  const service = new ConfigAuditService();

  const stats = service.getStats("nonexistent", "platform", null);

  assert.equal(stats.firstEntryAt, null);
  assert.equal(stats.lastEntryAt, null);
  assert.equal(stats.totalEntries, 0);
});

test("getStats records first and last entry timestamps", () => {
  const service = new ConfigAuditService();

  service.recordCreate("config", "platform", null, {}, "user", null);
  service.recordCreate("config", "platform", null, {}, "user", null);

  const stats = service.getStats("config", "platform", null);

  assert.ok(stats.firstEntryAt !== null);
  assert.ok(stats.lastEntryAt !== null);
});
