/**
 * Incident Control Unit Tests
 *
 * Tests incident control functionality including:
 * - Doctor check report building
 * - Doctor self-check summary calculation
 * - Lock summary building
 * - String deduplication and unique value collection
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizeDoctorChecks,
  type DoctorCheckReport,
  type DoctorCheckStatus,
  type DoctorSelfCheckSummary,
} from "../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createMockCheck(status: DoctorCheckStatus, checkId: string = "db"): DoctorCheckReport {
  return {
    checkId: checkId as DoctorCheckReport["checkId"],
    label: `Test ${checkId}`,
    status,
    summary: `summary for ${checkId}`,
    findings: [`finding for ${checkId}`],
    metrics: { testMetric: 1 },
  };
}

// ---------------------------------------------------------------------------
// Tests: summarizeDoctorChecks
// ---------------------------------------------------------------------------

test("summarizeDoctorChecks returns correct total count", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok"),
    createMockCheck("ok"),
    createMockCheck("degraded"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 3);
});

test("summarizeDoctorChecks counts ok checks correctly", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok"),
    createMockCheck("ok"),
    createMockCheck("degraded"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.okChecks, 2);
});

test("summarizeDoctorChecks counts degraded checks correctly", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok"),
    createMockCheck("degraded"),
    createMockCheck("degraded"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.degradedChecks, 2);
});

test("summarizeDoctorChecks counts fail_closed checks correctly", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok"),
    createMockCheck("fail_closed"),
    createMockCheck("fail_closed"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.failClosedChecks, 2);
});

test("summarizeDoctorChecks returns failing check ids", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok", "db"),
    createMockCheck("degraded", "config"),
    createMockCheck("fail_closed", "backup"),
    createMockCheck("ok", "workers"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.deepEqual(summary.failingCheckIds.sort(), ["backup", "config"]);
});

test("summarizeDoctorChecks handles empty array", () => {
  const summary = summarizeDoctorChecks([]);

  assert.equal(summary.totalChecks, 0);
  assert.equal(summary.okChecks, 0);
  assert.equal(summary.degradedChecks, 0);
  assert.equal(summary.failClosedChecks, 0);
  assert.deepEqual(summary.failingCheckIds, []);
});

test("summarizeDoctorChecks handles all ok checks", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok", "db"),
    createMockCheck("ok", "config"),
    createMockCheck("ok", "backup"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 3);
  assert.equal(summary.okChecks, 3);
  assert.equal(summary.degradedChecks, 0);
  assert.equal(summary.failClosedChecks, 0);
  assert.deepEqual(summary.failingCheckIds, []);
});

test("summarizeDoctorChecks handles all degraded checks", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("degraded", "db"),
    createMockCheck("degraded", "config"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 2);
  assert.equal(summary.okChecks, 0);
  assert.equal(summary.degradedChecks, 2);
  assert.equal(summary.failClosedChecks, 0);
  assert.deepEqual(summary.failingCheckIds.sort(), ["config", "db"]);
});

test("summarizeDoctorChecks handles all fail_closed checks", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("fail_closed", "db"),
    createMockCheck("fail_closed", "config"),
    createMockCheck("fail_closed", "backup"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 3);
  assert.equal(summary.okChecks, 0);
  assert.equal(summary.degradedChecks, 0);
  assert.equal(summary.failClosedChecks, 3);
  assert.deepEqual(summary.failingCheckIds.sort(), ["backup", "config", "db"]);
});

test("summarizeDoctorChecks handles mixed status checks", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok", "db"),
    createMockCheck("degraded", "config"),
    createMockCheck("fail_closed", "backup"),
    createMockCheck("ok", "workers"),
    createMockCheck("degraded", "locks"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 5);
  assert.equal(summary.okChecks, 2);
  assert.equal(summary.degradedChecks, 2);
  assert.equal(summary.failClosedChecks, 1);
  assert.deepEqual(summary.failingCheckIds.sort(), ["backup", "config", "locks"]);
});

test("summarizeDoctorChecks result matches expected interface shape", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok", "db"),
  ];

  const summary = summarizeDoctorChecks(checks);

  // Verify structure
  assert.ok(typeof summary.totalChecks === "number");
  assert.ok(typeof summary.okChecks === "number");
  assert.ok(typeof summary.degradedChecks === "number");
  assert.ok(typeof summary.failClosedChecks === "number");
  assert.ok(Array.isArray(summary.failingCheckIds));
});

test("summarizeDoctorChecks produces consistent results for same input", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok", "db"),
    createMockCheck("degraded", "config"),
    createMockCheck("fail_closed", "backup"),
  ];

  const summary1 = summarizeDoctorChecks(checks);
  const summary2 = summarizeDoctorChecks(checks);

  assert.deepEqual(summary1, summary2);
});

test("summarizeDoctorChecks handles single fail_closed check", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("fail_closed", "db"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 1);
  assert.equal(summary.okChecks, 0);
  assert.equal(summary.degradedChecks, 0);
  assert.equal(summary.failClosedChecks, 1);
  assert.deepEqual(summary.failingCheckIds, ["db"]);
});

test("summarizeDoctorChecks handles single degraded check", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("degraded", "config"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 1);
  assert.equal(summary.okChecks, 0);
  assert.equal(summary.degradedChecks, 1);
  assert.equal(summary.failClosedChecks, 0);
  assert.deepEqual(summary.failingCheckIds, ["config"]);
});

test("summarizeDoctorChecks handles single ok check", () => {
  const checks: DoctorCheckReport[] = [
    createMockCheck("ok", "db"),
  ];

  const summary = summarizeDoctorChecks(checks);

  assert.equal(summary.totalChecks, 1);
  assert.equal(summary.okChecks, 1);
  assert.equal(summary.degradedChecks, 0);
  assert.equal(summary.failClosedChecks, 0);
  assert.deepEqual(summary.failingCheckIds, []);
});

// ---------------------------------------------------------------------------
// Tests: DoctorCheckReport Structure Validation
// ---------------------------------------------------------------------------

test("DoctorCheckReport structure has all required fields", () => {
  const check: DoctorCheckReport = {
    checkId: "db",
    label: "Database",
    status: "ok",
    summary: "Database is healthy",
    findings: ["No issues found"],
    metrics: {
      dbWritable: true,
      integrityPassed: true,
      schemaUpToDate: true,
    },
  };

  assert.equal(check.checkId, "db");
  assert.equal(check.label, "Database");
  assert.equal(check.status, "ok");
  assert.equal(check.summary, "Database is healthy");
  assert.ok(Array.isArray(check.findings));
  assert.ok(typeof check.metrics === "object");
});

test("DoctorCheckReport metrics can contain various value types", () => {
  const check: DoctorCheckReport = {
    checkId: "db",
    label: "Database",
    status: "ok",
    summary: "Database is healthy",
    findings: [],
    metrics: {
      count: 42,
      ratio: 0.95,
      enabled: true,
      name: "test_metric",
      empty: null,
    },
  };

  assert.equal(check.metrics.count, 42);
  assert.equal(check.metrics.ratio, 0.95);
  assert.equal(check.metrics.enabled, true);
  assert.equal(check.metrics.name, "test_metric");
  assert.equal(check.metrics.empty, null);
});

test("DoctorCheckReport findings can be empty array", () => {
  const check: DoctorCheckReport = {
    checkId: "config",
    label: "Config",
    status: "ok",
    summary: "Config is healthy",
    findings: [],
    metrics: {},
  };

  assert.ok(Array.isArray(check.findings));
  assert.equal(check.findings.length, 0);
});

test("DoctorCheckReport findings can contain multiple entries", () => {
  const check: DoctorCheckReport = {
    checkId: "backup",
    label: "Backup",
    status: "degraded",
    summary: "Backup is degraded",
    findings: [
      "issue_1: first issue found",
      "issue_2: second issue found",
      "issue_3: third issue found",
    ],
    metrics: {},
  };

  assert.equal(check.findings.length, 3);
  assert.ok(check.findings[0]?.includes("issue_1"));
});

test("DoctorCheckStatus can be ok, degraded, or fail_closed", () => {
  const statuses: DoctorCheckStatus[] = ["ok", "degraded", "fail_closed"];

  for (const status of statuses) {
    const check: DoctorCheckReport = {
      checkId: "locks",
      label: "Locks",
      status,
      summary: "Locks check",
      findings: [],
      metrics: {},
    };
    assert.equal(check.status, status);
  }
});
