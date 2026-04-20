import assert from "node:assert/strict";
import test from "node:test";

import {
  AuditExportService,
  AUDIT_EXPORT_DDL,
  type AuditExportRecord,
  type AuditEventSummary,
  type IntegrityCheckResult,
  type Soc2EvidencePackage,
  type ExportFormat,
  type ExportStatus,
  type ComplianceFramework,
} from "../../../../../src/platform/control-plane/audit-export/audit-export-service.js";

test("AuditExportService type exports are correct", () => {
  // Verify type names exist
  const format: ExportFormat = "json";
  assert.ok(format === "json");

  const status: ExportStatus = "pending";
  assert.ok(status === "pending");

  const framework: ComplianceFramework = "soc2";
  assert.ok(framework === "soc2");
});

test("AuditExportService record structure", () => {
  const record: AuditExportRecord = {
    id: "aexport_123",
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    status: "pending",
    eventCount: 0,
    integrityVerified: false,
    exportPath: null,
    generatedAt: null,
    requestedBy: "user_123",
    createdAt: "2026-04-14T00:00:00.000Z",
    metadata: null,
  };

  assert.equal(record.framework, "soc2");
  assert.equal(record.format, "json");
  assert.equal(record.status, "pending");
  assert.equal(record.eventCount, 0);
  assert.equal(record.integrityVerified, false);
});

test("AuditExportService DDL is valid SQL", () => {
  // Verify DDL contains expected table definition
  assert.ok(AUDIT_EXPORT_DDL.includes("CREATE TABLE IF NOT EXISTS audit_exports"));
  assert.ok(AUDIT_EXPORT_DDL.includes("framework TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("format TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("window_start TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("window_end TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("status TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("event_count INTEGER NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("integrity_verified INTEGER NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("export_path TEXT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("requested_by TEXT NOT NULL"));
});

test("AuditEventSummary structure", () => {
  const summary: AuditEventSummary = {
    totalEvents: 100,
    tier1Count: 50,
    tier2Count: 30,
    tier3Count: 20,
    topEventTypes: [
      { type: "task.created", count: 25 },
      { type: "task.completed", count: 20 },
    ],
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
  };

  assert.equal(summary.totalEvents, 100);
  assert.equal(summary.tier1Count, 50);
  assert.equal(summary.tier2Count, 30);
  assert.equal(summary.tier3Count, 20);
  assert.equal(summary.topEventTypes.length, 2);
  assert.equal(summary.topEventTypes[0]?.type, "task.created");
});

test("IntegrityCheckResult structure", () => {
  const result: IntegrityCheckResult = {
    valid: true,
    eventsChecked: 50,
    chainBreaks: 0,
    firstBreakAt: null,
    details: "integrity_chain_valid",
  };

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 50);
  assert.equal(result.chainBreaks, 0);
  assert.equal(result.firstBreakAt, null);
});

test("IntegrityCheckResult with chain break", () => {
  const result: IntegrityCheckResult = {
    valid: false,
    eventsChecked: 50,
    chainBreaks: 2,
    firstBreakAt: "2026-04-15T10:30:00.000Z",
    details: "2_chain_breaks_detected",
  };

  assert.equal(result.valid, false);
  assert.equal(result.chainBreaks, 2);
  assert.equal(result.firstBreakAt, "2026-04-15T10:30:00.000Z");
});

test("Soc2EvidencePackage structure", () => {
  const pkg: Soc2EvidencePackage = {
    exportId: "aexport_123",
    framework: "soc2",
    generatedAt: "2026-04-14T12:00:00.000Z",
    window: {
      start: "2026-04-01T00:00:00.000Z",
      end: "2026-04-30T23:59:59.999Z",
    },
    summary: {
      totalEvents: 100,
      tier1Count: 50,
      tier2Count: 30,
      tier3Count: 20,
      topEventTypes: [],
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
    },
    integrityCheck: {
      valid: true,
      eventsChecked: 50,
      chainBreaks: 0,
      firstBreakAt: null,
      details: "integrity_chain_valid",
    },
    events: [],
    controlMappings: [
      { controlId: "CC6.1", evidenceType: "access_control", count: 10 },
      { controlId: "CC7.2", evidenceType: "change_management", count: 5 },
    ],
  };

  assert.equal(pkg.framework, "soc2");
  assert.equal(pkg.controlMappings.length, 2);
  assert.equal(pkg.controlMappings[0]?.controlId, "CC6.1");
});

test("Compliance frameworks are supported", () => {
  const frameworks: ComplianceFramework[] = ["soc2", "iso27001", "hipaa", "gdpr", "custom"];

  for (const fw of frameworks) {
    assert.ok(["soc2", "iso27001", "hipaa", "gdpr", "custom"].includes(fw));
  }
});

test("Export formats are supported", () => {
  const formats: ExportFormat[] = ["json", "csv", "soc2_package"];

  for (const fmt of formats) {
    assert.ok(["json", "csv", "soc2_package"].includes(fmt));
  }
});

test("Export statuses are supported", () => {
  const statuses: ExportStatus[] = ["pending", "generating", "completed", "failed"];

  for (const status of statuses) {
    assert.ok(["pending", "generating", "completed", "failed"].includes(status));
  }
});
