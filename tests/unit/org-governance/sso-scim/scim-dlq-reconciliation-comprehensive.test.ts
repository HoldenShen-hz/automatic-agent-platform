/**
 * Comprehensive Tests: SCIM DLQ Reconciliation Service
 *
 * Tests edge cases, boundary conditions, and all functionality
 * of the ScimDlqReconciliationService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ScimDlqReconciliationService,
  ScimDlqRecord,
  IdentityReconciliationReport,
} from "../../../../src/org-governance/sso-scim/scim-dlq-reconciliation.js";

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases and Boundary Conditions
// ─────────────────────────────────────────────────────────────────────────────

test("ScimDlqReconciliationService.reconcile() with retryCount exactly at boundary", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-boundary", identityId: "id-1", retryCount: 3, maxRetries: 3, lastError: "boundary" },
  ];

  const report = service.reconcile("report-boundary", records);

  // At exactly maxRetries, should be classified as exhausted
  assert.deepStrictEqual(report.retryRecordIds, []);
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-boundary"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-1"]);
});

test("ScimDlqReconciliationService.reconcile() with retryCount one below boundary", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-below", identityId: "id-1", retryCount: 2, maxRetries: 3, lastError: "below" },
  ];

  const report = service.reconcile("report-below", records);

  // One below boundary, should be retryable
  assert.deepStrictEqual(report.retryRecordIds, ["dlq-below"]);
  assert.deepStrictEqual(report.exhaustedRecordIds, []);
});

test("ScimDlqReconciliationService.reconcile() with maxRetries of 0", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-zero", identityId: "id-1", retryCount: 0, maxRetries: 0, lastError: "zero" },
  ];

  const report = service.reconcile("report-zero", records);

  // retryCount (0) >= maxRetries (0) means immediately exhausted
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-zero"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-1"]);
});

test("ScimDlqReconciliationService.reconcile() with very high retry count", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-high", identityId: "id-1", retryCount: 9999, maxRetries: 3, lastError: "high" },
  ];

  const report = service.reconcile("report-high", records);

  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-high"]);
});

test("ScimDlqReconciliationService.reconcile() handles large number of records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = Array.from({ length: 1000 }, (_, i) => ({
    recordId: `dlq-${i}`,
    identityId: `id-${i}`,
    retryCount: i % 5, // Some exhausted at 5, some retryable
    maxRetries: 5,
    lastError: `error-${i}`,
  }));

  const report = service.reconcile("report-large", records);

  // Records with i % 5 == 0 are at exactly 5 retries (exhausted)
  // That's every 5th record from 0 to 995 = 200 records
  assert.equal(report.retryRecordIds.length, 800);
  assert.equal(report.exhaustedRecordIds.length, 200);
});

test("ScimDlqReconciliationService.reconcile() handles single record", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-single", identityId: "id-single", retryCount: 1, maxRetries: 3, lastError: "single" },
  ];

  const report = service.reconcile("report-single", records);

  assert.equal(report.reportId, "report-single");
  assert.deepStrictEqual(report.retryRecordIds, ["dlq-single"]);
  assert.deepStrictEqual(report.exhaustedRecordIds, []);
  assert.deepStrictEqual(report.unresolvedIdentityIds, []);
});

test("ScimDlqReconciliationService.reconcile() preserves recordId order in output", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-c", identityId: "id-c", retryCount: 0, maxRetries: 3, lastError: "c" },
    { recordId: "dlq-a", identityId: "id-a", retryCount: 0, maxRetries: 3, lastError: "a" },
    { recordId: "dlq-b", identityId: "id-b", retryCount: 0, maxRetries: 3, lastError: "b" },
  ];

  const report = service.reconcile("report-order", records);

  assert.deepStrictEqual(report.retryRecordIds, ["dlq-c", "dlq-a", "dlq-b"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Identity ID Mapping Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScimDlqReconciliationService.reconcile() maps exhausted records to identityIds", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "user-alice", retryCount: 5, maxRetries: 3, lastError: "err" },
    { recordId: "dlq-2", identityId: "user-bob", retryCount: 3, maxRetries: 3, lastError: "err" },
    { recordId: "dlq-3", identityId: "user-charlie", retryCount: 1, maxRetries: 3, lastError: "err" },
  ];

  const report = service.reconcile("report-identity", records);

  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-1", "dlq-2"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["user-alice", "user-bob"]);
  // Charlie should NOT be in unresolved (still retryable)
  assert.ok(!report.unresolvedIdentityIds.includes("user-charlie"));
});

test("ScimDlqReconciliationService.reconcile() handles same identityId in multiple records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "user-same", retryCount: 5, maxRetries: 3, lastError: "err1" },
    { recordId: "dlq-2", identityId: "user-same", retryCount: 3, maxRetries: 3, lastError: "err2" },
  ];

  const report = service.reconcile("report-same-identity", records);

  // Both should be exhausted and identityId should appear twice in unresolvedIdentityIds
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-1", "dlq-2"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["user-same", "user-same"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// lastError Preservation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScimDlqReconciliationService handles empty lastError", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-empty", identityId: "id-1", retryCount: 5, maxRetries: 3, lastError: "" },
  ];

  const report = service.reconcile("report-empty", records);

  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-empty"]);
});

test("ScimDlqReconciliationService handles special characters in lastError", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-special", identityId: "id-1", retryCount: 5, maxRetries: 3, lastError: "Error: <script>alert('xss')</script>" },
  ];

  const report = service.reconcile("report-special", records);

  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-special"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Mixed Retry/Exhausted Records
// ─────────────────────────────────────────────────────────────────────────────

test("ScimDlqReconciliationService.reconcile() correctly classifies mixed records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "retry-0", identityId: "id-a", retryCount: 0, maxRetries: 3, lastError: "e" },
    { recordId: "retry-1", identityId: "id-b", retryCount: 1, maxRetries: 3, lastError: "e" },
    { recordId: "retry-2", identityId: "id-c", retryCount: 2, maxRetries: 3, lastError: "e" },
    { recordId: "exhaust-3", identityId: "id-d", retryCount: 3, maxRetries: 3, lastError: "e" },
    { recordId: "exhaust-5", identityId: "id-e", retryCount: 5, maxRetries: 3, lastError: "e" },
  ];

  const report = service.reconcile("report-mixed", records);

  assert.deepStrictEqual(report.retryRecordIds.sort(), ["retry-0", "retry-1", "retry-2"]);
  assert.deepStrictEqual(report.exhaustedRecordIds.sort(), ["exhaust-3", "exhaust-5"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds.sort(), ["id-d", "id-e"]);
});

test("ScimDlqReconciliationService.reconcile() handles all retryable records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 0, maxRetries: 5, lastError: "e" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 1, maxRetries: 5, lastError: "e" },
    { recordId: "dlq-3", identityId: "id-3", retryCount: 2, maxRetries: 5, lastError: "e" },
  ];

  const report = service.reconcile("report-all-retry", records);

  assert.equal(report.retryRecordIds.length, 3);
  assert.equal(report.exhaustedRecordIds.length, 0);
  assert.equal(report.unresolvedIdentityIds.length, 0);
});

test("ScimDlqReconciliationService.reconcile() handles all exhausted records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 5, maxRetries: 3, lastError: "e" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 10, maxRetries: 3, lastError: "e" },
  ];

  const report = service.reconcile("report-all-exhaust", records);

  assert.equal(report.retryRecordIds.length, 0);
  assert.equal(report.exhaustedRecordIds.length, 2);
  assert.equal(report.unresolvedIdentityIds.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// reportId Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScimDlqReconciliationService.reconcile() preserves custom reportId", () => {
  const service = new ScimDlqReconciliationService();

  const customReportId = "custom-report-2026-05-01";
  const report = service.reconcile(customReportId, []);

  assert.equal(report.reportId, customReportId);
});

test("ScimDlqReconciliationService.reconcile() handles empty string reportId", () => {
  const service = new ScimDlqReconciliationService();

  const report = service.reconcile("", []);

  assert.equal(report.reportId, "");
});

test("ScimDlqReconciliationService.reconcile() handles unicode in reportId", () => {
  const service = new ScimDlqReconciliationService();

  const report = service.reconcile("报告- идентификатор", []);

  assert.equal(report.reportId, "报告- идентификатор");
});

// ─────────────────────────────────────────────────────────────────────────────
// ScimDlqRecord Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScimDlqRecord interface can be constructed with minimal fields", () => {
  const record: ScimDlqRecord = {
    recordId: "rec-123",
    identityId: "user-456",
    retryCount: 0,
    maxRetries: 3,
    lastError: "Error message",
  };

  assert.equal(record.recordId, "rec-123");
  assert.equal(record.identityId, "user-456");
});

test("ScimDlqRecord interface allows optional fields", () => {
  const record: ScimDlqRecord = {
    recordId: "rec-optional",
    identityId: "user-optional",
    retryCount: 1,
    maxRetries: 3,
    lastError: "Error with optional",
    retryCount: 1,
    nextRetryAt: "2026-05-01T12:00:00.000Z",
    lastRetryAt: "2026-05-01T10:00:00.000Z",
  };

  assert.ok(record.nextRetryAt !== undefined);
  assert.ok(record.lastRetryAt !== undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// IdentityReconciliationReport Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IdentityReconciliationReport interface can be constructed", () => {
  const report: IdentityReconciliationReport = {
    reportId: "report-123",
    retryRecordIds: ["dlq-1", "dlq-2"],
    exhaustedRecordIds: ["dlq-3"],
    unresolvedIdentityIds: ["user-1", "user-2"],
  };

  assert.equal(report.reportId, "report-123");
  assert.equal(report.retryRecordIds.length, 2);
  assert.equal(report.exhaustedRecordIds.length, 1);
  assert.equal(report.unresolvedIdentityIds.length, 2);
});

test("IdentityReconciliationReport allows empty arrays", () => {
  const report: IdentityReconciliationReport = {
    reportId: "empty-report",
    retryRecordIds: [],
    exhaustedRecordIds: [],
    unresolvedIdentityIds: [],
  };

  assert.deepEqual(report.retryRecordIds, []);
  assert.deepEqual(report.exhaustedRecordIds, []);
  assert.deepEqual(report.unresolvedIdentityIds, []);
});