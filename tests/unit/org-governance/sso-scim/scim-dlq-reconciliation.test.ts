import test from "node:test";
import assert from "node:assert/strict";
import {
  ScimDlqReconciliationService,
  ScimDlqRecord,
  IdentityReconciliationReport,
} from "../../../../src/org-governance/sso-scim/scim-dlq-reconciliation.js";

test("ScimDlqReconciliationService.reconcile() classifies records with remaining retries as retryable", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 0, maxRetries: 3, lastError: "network timeout" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 1, maxRetries: 3, lastError: "rate limited" },
    { recordId: "dlq-3", identityId: "id-3", retryCount: 2, maxRetries: 5, lastError: "conflict" },
  ];

  const report = service.reconcile("report-001", records);

  assert.deepStrictEqual(report.retryRecordIds, ["dlq-1", "dlq-2", "dlq-3"]);
  assert.deepStrictEqual(report.exhaustedRecordIds, []);
  assert.deepStrictEqual(report.unresolvedIdentityIds, []);
});

test("ScimDlqReconciliationService.reconcile() classifies records with exhausted retries as quarantined", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 3, maxRetries: 3, lastError: "permanent failure" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 5, maxRetries: 3, lastError: "unauthorized" },
  ];

  const report = service.reconcile("report-002", records);

  assert.deepStrictEqual(report.retryRecordIds, []);
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-1", "dlq-2"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-1", "id-2"]);
});

test("ScimDlqReconciliationService.reconcile() handles mixed retry and exhausted records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 0, maxRetries: 3, lastError: "error 1" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 3, maxRetries: 3, lastError: "error 2" },
    { recordId: "dlq-3", identityId: "id-3", retryCount: 1, maxRetries: 3, lastError: "error 3" },
    { recordId: "dlq-4", identityId: "id-4", retryCount: 4, maxRetries: 3, lastError: "error 4" },
  ];

  const report = service.reconcile("report-003", records);

  assert.deepStrictEqual(report.retryRecordIds, ["dlq-1", "dlq-3"]);
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-2", "dlq-4"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-2", "id-4"]);
});

test("ScimDlqReconciliationService.reconcile() returns empty arrays for empty records", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [];

  const report = service.reconcile("report-004", records);

  assert.deepStrictEqual(report.retryRecordIds, []);
  assert.deepStrictEqual(report.exhaustedRecordIds, []);
  assert.deepStrictEqual(report.unresolvedIdentityIds, []);
});

test("ScimDlqReconciliationService.reconcile() includes correct reportId in the report", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 0, maxRetries: 3, lastError: "error" },
  ];

  const report = service.reconcile("custom-report-id", records);

  assert.strictEqual(report.reportId, "custom-report-id");
});

test("ScimDlqReconciliationService.reconcile() correctly identifies records at exactly maxRetries as exhausted", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 3, maxRetries: 3, lastError: "at limit" },
  ];

  const report = service.reconcile("report-005", records);

  assert.deepStrictEqual(report.retryRecordIds, []);
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-1"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-1"]);
});

test("ScimDlqReconciliationService.reconcile() respects quota limits by not exceeding maxRetries", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 2, maxRetries: 3, lastError: "quasi error" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 3, maxRetries: 3, lastError: "quota exhausted" },
    { recordId: "dlq-3", identityId: "id-3", retryCount: 10, maxRetries: 10, lastError: "long running" },
  ];

  const report = service.reconcile("report-006", records);

  assert.deepStrictEqual(report.retryRecordIds, ["dlq-1"]);
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-2", "dlq-3"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-2", "id-3"]);
});

test("ScimDlqReconciliationService.reconcile() emits correct events for each record classification", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-retry", identityId: "id-retry", retryCount: 1, maxRetries: 3, lastError: "temporary failure" },
    { recordId: "dlq-quarantine", identityId: "id-quarantine", retryCount: 5, maxRetries: 3, lastError: "permanent failure" },
  ];

  const report = service.reconcile("report-007", records);

  // Retryable record should be in retryRecordIds
  assert.ok(report.retryRecordIds.includes("dlq-retry"), "retryable record should be in retryRecordIds");
  assert.ok(!report.exhaustedRecordIds.includes("dlq-retry"), "retryable record should not be in exhaustedRecordIds");

  // Exhausted record should be in exhaustedRecordIds and unresolvedIdentityIds
  assert.ok(report.exhaustedRecordIds.includes("dlq-quarantine"), "exhausted record should be in exhaustedRecordIds");
  assert.ok(report.unresolvedIdentityIds.includes("id-quarantine"), "exhausted record identity should be in unresolvedIdentityIds");
  assert.ok(!report.retryRecordIds.includes("dlq-quarantine"), "exhausted record should not be in retryRecordIds");
});

test("ScimDlqReconciliationService.reconcile() processes dead letters in bulk with mixed outcomes", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 0, maxRetries: 2, lastError: "timeout" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 1, maxRetries: 2, lastError: "rate limit" },
    { recordId: "dlq-3", identityId: "id-3", retryCount: 2, maxRetries: 2, lastError: "unauthorized" },
    { recordId: "dlq-4", identityId: "id-4", retryCount: 2, maxRetries: 2, lastError: "forbidden" },
  ];

  const report = service.reconcile("report-008", records);

  // Two records should be retryable, two should be exhausted
  assert.strictEqual(report.retryRecordIds.length, 2);
  assert.strictEqual(report.exhaustedRecordIds.length, 2);
  assert.strictEqual(report.unresolvedIdentityIds.length, 2);
  assert.ok(report.retryRecordIds.includes("dlq-1"));
  assert.ok(report.retryRecordIds.includes("dlq-2"));
  assert.ok(report.exhaustedRecordIds.includes("dlq-3"));
  assert.ok(report.exhaustedRecordIds.includes("dlq-4"));
});

test("ScimDlqReconciliationService.reconcile() handles single record with partial retry budget", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-single", identityId: "id-single", retryCount: 1, maxRetries: 5, lastError: "intermittent" },
  ];

  const report = service.reconcile("report-009", records);

  assert.strictEqual(report.reportId, "report-009");
  assert.deepStrictEqual(report.retryRecordIds, ["dlq-single"]);
  assert.deepStrictEqual(report.exhaustedRecordIds, []);
  assert.deepStrictEqual(report.unresolvedIdentityIds, []);
});

test("ScimDlqReconciliationService.reconcile() handles edge case where all records are exhausted", () => {
  const service = new ScimDlqReconciliationService();
  const records: readonly ScimDlqRecord[] = [
    { recordId: "dlq-1", identityId: "id-1", retryCount: 10, maxRetries: 5, lastError: "fatal 1" },
    { recordId: "dlq-2", identityId: "id-2", retryCount: 20, maxRetries: 10, lastError: "fatal 2" },
  ];

  const report = service.reconcile("report-010", records);

  assert.deepStrictEqual(report.retryRecordIds, []);
  assert.deepStrictEqual(report.exhaustedRecordIds, ["dlq-1", "dlq-2"]);
  assert.deepStrictEqual(report.unresolvedIdentityIds, ["id-1", "id-2"]);
});
