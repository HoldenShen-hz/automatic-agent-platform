import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  ExportFormat,
  ExportStatus,
  ComplianceFramework,
  AuditExportRecord,
  AuditEventSummary,
  IntegrityCheckResult,
  Soc2EvidencePackage,
} from "../../../../../src/platform/control-plane/audit-export/index.js";

test("ExportFormat type accepts valid values", () => {
  const formats: ExportFormat[] = ["json", "csv", "soc2_package"];
  assert.equal(formats.length, 3);
});

test("ExportStatus type accepts valid values", () => {
  const statuses: ExportStatus[] = ["pending", "generating", "completed", "failed"];
  assert.equal(statuses.length, 4);
});

test("ComplianceFramework type accepts valid values", () => {
  const frameworks: ComplianceFramework[] = ["soc2", "iso27001", "hipaa", "gdpr", "custom"];
  assert.equal(frameworks.length, 5);
});

test("AuditExportRecord structure is correct", () => {
  const record: AuditExportRecord = {
    id: "export_1",
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-13T00:00:00.000Z",
    windowEnd: "2026-04-14T00:00:00.000Z",
    status: "completed",
    eventCount: 100,
    integrityVerified: true,
    exportPath: "/exports/audit_2026.json",
    generatedAt: "2026-04-14T00:01:00.000Z",
    requestedBy: "user:admin",
    createdAt: "2026-04-14T00:00:00.000Z",
    metadata: null,
  };
  assert.equal(record.id, "export_1");
  assert.equal(record.format, "json");
  assert.equal(record.status, "completed");
  assert.equal(record.eventCount, 100);
});

test("AuditEventSummary structure is correct", () => {
  const summary: AuditEventSummary = {
    totalEvents: 500,
    tier1Count: 300,
    tier2Count: 150,
    tier3Count: 50,
    topEventTypes: [
      { type: "task_created", count: 200 },
      { type: "task_completed", count: 300 },
    ],
    windowStart: "2026-04-13T00:00:00.000Z",
    windowEnd: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(summary.totalEvents, 500);
  assert.equal(summary.tier1Count, 300);
  assert.equal(summary.topEventTypes.length, 2);
});

test("IntegrityCheckResult structure is correct", () => {
  const result: IntegrityCheckResult = {
    valid: true,
    eventsChecked: 1000,
    chainBreaks: 0,
    firstBreakAt: null,
    details: "All events verified",
  };
  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 1000);
  assert.equal(result.chainBreaks, 0);
});

test("IntegrityCheckResult with chain breaks", () => {
  const result: IntegrityCheckResult = {
    valid: false,
    eventsChecked: 500,
    chainBreaks: 3,
    firstBreakAt: "2026-04-14T00:30:00.000Z",
    details: "Chain integrity violation detected",
  };
  assert.equal(result.valid, false);
  assert.equal(result.chainBreaks, 3);
});

test("Soc2EvidencePackage structure is correct", () => {
  const summary: AuditEventSummary = {
    totalEvents: 100,
    tier1Count: 80,
    tier2Count: 15,
    tier3Count: 5,
    topEventTypes: [],
    windowStart: "2026-01-01T00:00:00.000Z",
    windowEnd: "2026-03-31T23:59:59.000Z",
  };
  const integrityCheck: IntegrityCheckResult = {
    valid: true,
    eventsChecked: 100,
    chainBreaks: 0,
    firstBreakAt: null,
    details: "OK",
  };
  const pkg: Soc2EvidencePackage = {
    exportId: "soc2_pkg_1",
    framework: "soc2",
    generatedAt: "2026-04-14T00:00:00.000Z",
    window: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-03-31T23:59:59.000Z",
    },
    summary,
    integrityCheck,
    events: [],
    controlMappings: [],
  };
  assert.equal(pkg.exportId, "soc2_pkg_1");
  assert.equal(pkg.framework, "soc2");
  assert.equal(pkg.summary.totalEvents, 100);
  assert.equal(pkg.integrityCheck.valid, true);
});
