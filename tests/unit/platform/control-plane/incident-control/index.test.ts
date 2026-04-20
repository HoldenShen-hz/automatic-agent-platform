import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for ops module
import type {
  DoctorCheckId,
  DoctorCheckStatus,
  DoctorCheckReport,
  DoctorSelfCheckSummary,
} from "../../../../../src/platform/control-plane/incident-control/index.js";

test("DoctorCheckId type accepts valid values", () => {
  const ids: DoctorCheckId[] = [
    "db",
    "config",
    "backup",
    "locks",
    "workers",
    "event_backlog",
    "audit_integrity",
    "provider_health",
  ];
  assert.equal(ids.length, 8);
});

test("DoctorCheckStatus type accepts valid values", () => {
  const statuses: DoctorCheckStatus[] = ["ok", "degraded", "fail_closed"];
  assert.equal(statuses.length, 3);
});

test("DoctorCheckReport structure is correct", () => {
  const report: DoctorCheckReport = {
    checkId: "db",
    label: "Database Health",
    status: "ok",
    summary: "Database is healthy",
    findings: [],
    metrics: { query_time_ms: 10, connections: 5 },
  };
  assert.equal(report.checkId, "db");
  assert.equal(report.status, "ok");
  assert.equal(report.summary, "Database is healthy");
  assert.deepEqual(report.metrics, { query_time_ms: 10, connections: 5 });
});

test("DoctorCheckReport with findings", () => {
  const report: DoctorCheckReport = {
    checkId: "workers",
    label: "Worker Health",
    status: "degraded",
    summary: "Some workers are slow",
    findings: ["worker_3 latency > 5s", "worker_5 queue depth > 1000"],
    metrics: { avg_latency_ms: 3000 },
  };
  assert.equal(report.status, "degraded");
  assert.equal(report.findings.length, 2);
});

test("DoctorSelfCheckSummary structure is correct", () => {
  const summary: DoctorSelfCheckSummary = {
    totalChecks: 8,
    okChecks: 6,
    degradedChecks: 1,
    failClosedChecks: 1,
    failingCheckIds: ["workers", "locks"],
  };
  assert.equal(summary.totalChecks, 8);
  assert.equal(summary.okChecks, 6);
  assert.equal(summary.failClosedChecks, 1);
  assert.deepEqual(summary.failingCheckIds, ["workers", "locks"]);
});

test("DoctorSelfCheckSummary with all passing checks", () => {
  const summary: DoctorSelfCheckSummary = {
    totalChecks: 8,
    okChecks: 8,
    degradedChecks: 0,
    failClosedChecks: 0,
    failingCheckIds: [],
  };
  assert.equal(summary.okChecks, 8);
  assert.equal(summary.failClosedChecks, 0);
  assert.deepEqual(summary.failingCheckIds, []);
});
