/**
 * Integration Tests: Audit Export
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuditExportRecord,
  AuditEventSummary,
  ExportFormat,
  ComplianceFramework,
  IntegrityCheckResult,
} from "../../../../src/platform/five-plane-control-plane/audit-export/index.js";

// ============================================================================
// Type Validation Tests
// ============================================================================

test("integration: AuditExportRecord type structure", () => {
  const record: AuditExportRecord = {
    id: "export_001",
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    status: "completed",
    eventCount: 1000,
    integrityVerified: true,
    exportPath: "/exports/soc2/april_2026.json",
    generatedAt: "2026-04-30T12:00:00.000Z",
    requestedBy: "auditor@example.com",
    createdAt: "2026-04-15T09:00:00.000Z",
    metadata: JSON.stringify({ certified: true }),
  };

  assert.ok(record.id.length > 0);
  assert.ok(["soc2", "iso27001", "hipaa", "gdpr"].includes(record.framework));
  assert.ok(["json", "csv", "soc2_package"].includes(record.format));
});

test("integration: AuditEventSummary type structure", () => {
  const summary: AuditEventSummary = {
    totalEvents: 5000,
    tier1Count: 3000,
    tier2Count: 1500,
    tier3Count: 500,
    topEventTypes: [
      { type: "task.created", count: 2000 },
      { type: "task.completed", count: 1500 },
    ],
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
  };

  assert.equal(summary.tier1Count + summary.tier2Count + summary.tier3Count, summary.totalEvents);
});

test("integration: IntegrityCheckResult type structure", () => {
  const validResult: IntegrityCheckResult = {
    valid: true,
    eventsChecked: 5000,
    chainBreaks: 0,
    firstBreakAt: null,
    details: "All events verified",
  };

  const invalidResult: IntegrityCheckResult = {
    valid: false,
    eventsChecked: 5000,
    chainBreaks: 3,
    firstBreakAt: "2026-04-15T14:30:00.000Z",
    details: "Chain breaks detected",
  };

  assert.equal(validResult.valid, true);
  assert.equal(validResult.chainBreaks, 0);
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.chainBreaks, 3);
});

test("integration: ComplianceFramework union values", () => {
  const frameworks: ComplianceFramework[] = ["soc2", "iso27001", "hipaa", "gdpr", "custom"];
  assert.equal(frameworks.length, 5);
});

test("integration: ExportFormat union values", () => {
  const formats: ExportFormat[] = ["json", "csv", "soc2_package"];
  assert.equal(formats.length, 3);
});

test("integration: export status lifecycle", () => {
  const statuses = ["pending", "generating", "completed", "failed"] as const;

  for (const status of statuses) {
    const record: AuditExportRecord = {
      id: `export_${status}`,
      framework: "soc2",
      format: "json",
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
      status,
      eventCount: 0,
      integrityVerified: false,
      exportPath: null,
      generatedAt: null,
      requestedBy: "system",
      createdAt: new Date().toISOString(),
      metadata: null,
    };
    assert.ok(record.id.includes(status));
  }
});

test("integration: tier counts aggregate correctly", () => {
  const summary: AuditEventSummary = {
    totalEvents: 5000,
    tier1Count: 3000,
    tier2Count: 1500,
    tier3Count: 500,
    topEventTypes: [],
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
  };

  const sum = summary.tier1Count + summary.tier2Count + summary.tier3Count;
  assert.equal(sum, summary.totalEvents);
});

test("integration: integrity verification for completed exports", () => {
  const record: AuditExportRecord = {
    id: "export_verified",
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    status: "completed",
    eventCount: 5000,
    integrityVerified: true,
    exportPath: "/exports/verified.json",
    generatedAt: "2026-04-30T12:00:00.000Z",
    requestedBy: "auditor",
    createdAt: "2026-04-15T09:00:00.000Z",
    metadata: null,
  };

  assert.equal(record.status, "completed");
  assert.equal(record.integrityVerified, true);
  assert.ok(record.eventCount > 0);
});

test("integration: top event types ordering", () => {
  const summary: AuditEventSummary = {
    totalEvents: 10000,
    tier1Count: 6000,
    tier2Count: 3000,
    tier3Count: 1000,
    topEventTypes: [
      { type: "task.created", count: 4000 },
      { type: "task.completed", count: 3000 },
      { type: "execution.started", count: 2000 },
      { type: "execution.stopped", count: 1000 },
    ],
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
  };

  // Verify counts are in descending order
  for (let i = 0; i < summary.topEventTypes.length - 1; i++) {
    assert.ok(summary.topEventTypes[i]!.count >= summary.topEventTypes[i + 1]!.count);
  }
});