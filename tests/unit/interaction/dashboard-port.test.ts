/**
 * Unit tests for dashboard-port.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  toSystemSituationPort,
  type SystemSituationPort,
  type DashboardHealthStatus,
  type DashboardProviderHealth,
  type DashboardQueueBacklog,
} from "../../../src/interaction/dashboard/contracts/dashboard-port.js";

test("toSystemSituationPort returns same health status", () => {
  const system: SystemSituationPort = {
    healthStatus: "ok",
    queueBacklog: { size: 5, degraded: false },
    findings: ["system is healthy"],
  };

  const result = toSystemSituationPort(system);

  assert.equal(result.healthStatus, "ok");
});

test("toSystemSituationPort returns same queue backlog", () => {
  const system: SystemSituationPort = {
    healthStatus: "degraded",
    queueBacklog: { size: 100, degraded: true },
    findings: [],
  };

  const result = toSystemSituationPort(system);

  assert.deepEqual(result.queueBacklog, { size: 100, degraded: true });
});

test("toSystemSituationPort returns same findings", () => {
  const system: SystemSituationPort = {
    healthStatus: "unhealthy",
    queueBacklog: { size: 1000, degraded: true },
    findings: ["high latency", "queue backlog"],
  };

  const result = toSystemSituationPort(system);

  assert.equal(result.findings.length, 2);
  assert.equal(result.findings[0], "high latency");
});

test("toSystemSituationPort creates new findings array (not same reference)", () => {
  const system: SystemSituationPort = {
    healthStatus: "ok",
    queueBacklog: { size: 0, degraded: false },
    findings: ["finding1"],
  };

  const result = toSystemSituationPort(system);

  assert.ok(result.findings !== system.findings);
  assert.deepEqual(result.findings, system.findings);
});

test("DashboardHealthStatus accepts valid values", () => {
  const statuses: DashboardHealthStatus[] = ["ok", "degraded", "overloaded", "unhealthy"];

  for (const status of statuses) {
    const system: SystemSituationPort = {
      healthStatus: status,
      queueBacklog: { size: 0, degraded: false },
      findings: [],
    };
    assert.equal(system.healthStatus, status);
  }
});

test("DashboardQueueBacklog structure", () => {
  const backlog: DashboardQueueBacklog = {
    size: 50,
    degraded: false,
  };

  assert.equal(backlog.size, 50);
  assert.equal(backlog.degraded, false);
});

test("DashboardQueueBacklog degraded is true when size is high", () => {
  const backlog: DashboardQueueBacklog = {
    size: 1000,
    degraded: true,
  };

  assert.equal(backlog.size, 1000);
  assert.equal(backlog.degraded, true);
});

test("SystemSituationPort accepts empty findings", () => {
  const system: SystemSituationPort = {
    healthStatus: "ok",
    queueBacklog: { size: 0, degraded: false },
    findings: [],
  };

  assert.equal(system.findings.length, 0);
});

test("SystemSituationPort accepts various health statuses", () => {
  const statuses: DashboardHealthStatus[] = ["ok", "degraded", "overloaded", "unhealthy"];

  for (const status of statuses) {
    const system: SystemSituationPort = {
      healthStatus: status,
      queueBacklog: { size: 0, degraded: false },
      findings: [],
    };
    assert.equal(system.healthStatus, status);
  }
});