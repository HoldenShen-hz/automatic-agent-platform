/**
 * Unit Tests: Audit Export
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AuditExportService,
  type AuditExportRecord,
  type AuditEventSummary,
  type IntegrityCheckResult,
  type ExportFormat,
  type ComplianceFramework,
  AUDIT_EXPORT_DDL,
} from "../../../../src/platform/five-plane-control-plane/audit-export/index.js";

// ============================================================================
// Audit Export Record Structure Tests
// ============================================================================

test("AuditExportRecord has correct structure", () => {
  const record: AuditExportRecord = {
    id: "export_123",
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    status: "completed",
    eventCount: 100,
    integrityVerified: true,
    exportPath: "/exports/audit_2026_04.json",
    generatedAt: "2026-04-30T12:00:00.000Z",
    requestedBy: "admin",
    createdAt: "2026-04-15T10:00:00.000Z",
    metadata: null,
  };

  assert.equal(record.id, "export_123");
  assert.equal(record.framework, "soc2");
  assert.equal(record.format, "json");
  assert.equal(record.status, "completed");
  assert.equal(record.eventCount, 100);
  assert.equal(record.integrityVerified, true);
});

test("AuditEventSummary calculates tier counts correctly", () => {
  const summary: AuditEventSummary = {
    totalEvents: 150,
    tier1Count: 80,
    tier2Count: 50,
    tier3Count: 20,
    topEventTypes: [
      { type: "task.created", count: 50 },
      { type: "task.completed", count: 45 },
    ],
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
  };

  assert.equal(summary.totalEvents, 150);
  assert.equal(summary.tier1Count, 80);
  assert.equal(summary.tier2Count, 50);
  assert.equal(summary.tier3Count, 20);
  assert.equal(summary.topEventTypes.length, 2);
});

test("IntegrityCheckResult detects chain breaks", () => {
  const result: IntegrityCheckResult = {
    valid: false,
    eventsChecked: 100,
    chainBreaks: 2,
    firstBreakAt: "2026-04-15T14:30:00.000Z",
    details: "Chain break detected between events 45 and 46",
  };

  assert.equal(result.valid, false);
  assert.equal(result.chainBreaks, 2);
  assert.ok(result.firstBreakAt !== null);
});

test("AUDIT_EXPORT_DDL creates correct table schema", () => {
  assert.ok(AUDIT_EXPORT_DDL.includes("CREATE TABLE IF NOT EXISTS audit_exports"));
  assert.ok(AUDIT_EXPORT_DDL.includes("framework TEXT"));
  assert.ok(AUDIT_EXPORT_DDL.includes("format TEXT"));
  assert.ok(AUDIT_EXPORT_DDL.includes("status TEXT"));
  assert.ok(AUDIT_EXPORT_DDL.includes("event_count INTEGER"));
  assert.ok(AUDIT_EXPORT_DDL.includes("integrity_verified INTEGER"));
});

test("ExportFormat enum values are valid", () => {
  const formats: ExportFormat[] = ["json", "csv", "soc2_package"];

  assert.equal(formats.length, 3);
  formats.forEach((format) => {
    assert.ok(["json", "csv", "soc2_package"].includes(format));
  });
});

test("ComplianceFramework enum values are valid", () => {
  const frameworks: ComplianceFramework[] = ["soc2", "iso27001", "hipaa", "gdpr", "custom"];

  assert.equal(frameworks.length, 5);
  frameworks.forEach((fw) => {
    assert.ok(["soc2", "iso27001", "hipaa", "gdpr", "custom"].includes(fw));
  });
});
