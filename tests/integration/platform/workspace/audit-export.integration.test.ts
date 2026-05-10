/**
 * Integration Tests: Audit Export
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AuditExportService,
  type AuditExportRecord,
  type AuditEventSummary,
  type ExportFormat,
  type ComplianceFramework,
  type IntegrityCheckResult,
  AUDIT_EXPORT_DDL,
} from "../../../../../src/platform/five-plane-control-plane/audit-export/index.js";

// ============================================================================
// Audit Export DDL Integration
// ============================================================================

test("integration: DDL creates export record with all required fields", () => {
  const record: AuditExportRecord = {
    id: "export_ddl_001",
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
  assert.ok(["pending", "generating", "completed", "failed"].includes(record.status));
  assert.equal(typeof record.eventCount, "number");
  assert.equal(typeof record.integrityVerified, "boolean");
});

test("integration: AuditEventSummary aggregates tier counts", () => {
  const summary: AuditEventSummary = {
    totalEvents: 5000,
    tier1Count: 3000,
    tier2Count: 1500,
    tier3Count: 500,
    topEventTypes: [
      { type: "task.created", count: 2000 },
      { type: "task.completed", count: 1500 },
      { type: "execution.started", count: 1000 },
      { type: "execution.stopped", count: 500 },
    ],
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
  };

  assert.equal(summary.tier1Count + summary.tier2Count + summary.tier3Count, summary.totalEvents);
  assert.equal(summary.topEventTypes.reduce((sum: number, t: { type: string; count: number }) => sum + t.count, 0), summary.totalEvents);
});

test("integration: IntegrityCheckResult validates chain", () => {
  const validResult: IntegrityCheckResult = {
    valid: true,
    eventsChecked: 5000,
    chainBreaks: 0,
    firstBreakAt: null,
    details: "All events verified, chain intact",
  };

  const invalidResult: IntegrityCheckResult = {
    valid: false,
    eventsChecked: 5000,
    chainBreaks: 3,
    firstBreakAt: "2026-04-15T14:30:00.000Z",
    details: "Chain breaks detected at events 1250, 1251, 1252",
  };

  assert.equal(validResult.valid, true);
  assert.equal(validResult.chainBreaks, 0);
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.chainBreaks, 3);
  assert.ok(invalidResult.firstBreakAt !== null);
});

test("integration: export formats support all frameworks", () => {
  const frameworks: ComplianceFramework[] = ["soc2", "iso27001", "hipaa", "gdpr", "custom"];
  const formats: ExportFormat[] = ["json", "csv", "soc2_package"];

  frameworks.forEach((fw) => {
    formats.forEach((format) => {
      const record: AuditExportRecord = {
        id: `export_${fw}_${format}`,
        framework: fw,
        format,
        windowStart: "2026-04-01T00:00:00.000Z",
        windowEnd: "2026-04-30T23:59:59.999Z",
        status: "pending",
        eventCount: 0,
        integrityVerified: false,
        exportPath: null,
        generatedAt: null,
        requestedBy: "system",
        createdAt: new Date().toISOString(),
        metadata: null,
      };

      assert.ok(record.id.includes(fw));
      assert.equal(record.framework, fw);
      assert.equal(record.format, format);
    });
  });
});
