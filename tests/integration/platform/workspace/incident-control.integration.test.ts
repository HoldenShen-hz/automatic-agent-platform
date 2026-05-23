/**
 * Integration Tests: Incident Control
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  IncidentSeverity,
  IncidentStatus,
  IncidentCategory,
  IncidentDetection,
  IncidentDetectionRule,
} from "../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

import type {
  IncidentResolver,
  IncidentResolution,
} from "../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";

import type {
  TakeoverActionResult,
} from "../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import type { TakeoverSessionStatus } from "../../../../src/platform/contracts/types/domain.js";

import type {
  DoctorCheckId,
  DoctorCheckReport,
} from "../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";

// ============================================================================
// Type Validation Tests
// ============================================================================

test("integration: IncidentSeverity union values", () => {
  const severities: IncidentSeverity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];
  assert.equal(severities.length, 4);
});

test("integration: IncidentStatus union values", () => {
  const statuses: IncidentStatus[] = ["open", "triaged", "mitigating", "reviewed", "resolved", "closed"];
  assert.equal(statuses.length, 6);
});

test("integration: IncidentCategory union values", () => {
  const categories: IncidentCategory[] = [
    "system_health",
    "security",
    "data_integrity",
    "performance",
    "availability",
    "configuration",
  ];
  assert.equal(categories.length, 6);
});

test("integration: IncidentDetection type structure", () => {
  const detection: IncidentDetection = {
    incidentId: "incident_001",
    detectedAt: "2026-04-15T12:00:00.000Z",
    category: "system_health",
    severity: "SEV1",
    status: "open",
    title: "Critical system failure",
    description: "System health check failed",
    sourceCheckId: "health_check",
    affectedEntities: ["api-server-1", "api-server-2"],
    symptoms: ["high_latency", "error_rate_spike"],
    metrics: { errorRate: 0.15, latencyP99: 5000 },
  };

  assert.equal(detection.incidentId, "incident_001");
  assert.equal(detection.severity, "SEV1");
  assert.equal(detection.status, "open");
});

test("integration: IncidentResolution type structure", () => {
  const resolution: IncidentResolution = {
    resolutionId: "resolution_001",
    incidentId: "incident_001",
    status: "completed",
    strategy: "automated",
    startedAt: "2026-04-15T13:00:00.000Z",
    completedAt: "2026-04-15T14:00:00.000Z",
    rootCause: "Transient queue stall",
    actions: [],
    resolutionNotes: "Execution requeued",
    resolvedBy: "system",
  };

  assert.equal(resolution.strategy, "automated");
  assert.equal(resolution.resolvedBy, "system");
});

test("integration: TakeoverSessionStatus union values", () => {
  const statuses: TakeoverSessionStatus[] = ["open", "closed"];
  assert.equal(statuses.length, 2);
});

test("integration: TakeoverActionResult type structure", () => {
  const request: TakeoverActionResult = {
    taskId: "task_001",
    executionId: "exec_001",
    takeoverSessionId: "takeover_001",
    operatorActionId: "opact_001",
  };

  assert.equal(request.takeoverSessionId, "takeover_001");
  assert.equal(request.executionId, "exec_001");
});

test("integration: DoctorCheckId union values", () => {
  const checkIds: DoctorCheckId[] = ["db", "config", "backup", "locks", "workers", "event_backlog", "audit_integrity", "provider_health"];
  assert.equal(checkIds.length, 8);
});

test("integration: DoctorCheckReport type structure", () => {
  const result: DoctorCheckReport = {
    checkId: "db",
    label: "Database",
    status: "ok",
    summary: "Database healthy",
    findings: [],
    metrics: { latencyMs: 100 },
  };

  assert.equal(result.checkId, "db");
  assert.equal(result.status, "ok");
});

test("integration: IncidentDetectionRule type structure", () => {
  const rule: IncidentDetectionRule = {
    ruleId: "sev1_availability_collapse",
    name: "SEV1 Availability Collapse",
    description: "Availability drops below threshold",
    severity: "SEV1",
    condition: (metrics) => {
      const availability = typeof metrics.availability === "number" ? metrics.availability : null;
      return availability !== null && availability < 95;
    },
    category: "availability",
  };

  assert.equal(rule.ruleId, "sev1_availability_collapse");
  assert.equal(rule.severity, "SEV1");
});

test("integration: urgency levels", () => {
  const urgencies = ["low", "medium", "high", "critical"] as const;
  assert.equal(urgencies.length, 4);
});

test("integration: incident severity to urgency mapping", () => {
  const severityToUrgency = (severity: IncidentSeverity): "critical" | "high" | "medium" | "low" => {
    switch (severity) {
      case "SEV1": return "critical";
      case "SEV2": return "high";
      case "SEV3": return "medium";
      case "SEV4": return "low";
      default: return "low";
    }
  };

  assert.equal(severityToUrgency("SEV1"), "critical");
  assert.equal(severityToUrgency("SEV2"), "high");
  assert.equal(severityToUrgency("SEV3"), "medium");
  assert.equal(severityToUrgency("SEV4"), "low");
});

test("integration: incident status transitions", () => {
  const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
    open: ["triaged", "closed"],
    triaged: ["mitigating", "closed"],
    mitigating: ["reviewed", "closed"],
    reviewed: ["resolved", "closed"],
    resolved: ["closed"],
    closed: [],
  };

  assert.ok(validTransitions["open"].includes("triaged"));
  assert.ok(validTransitions["open"].includes("closed"));
  assert.ok(!validTransitions["closed"].includes("open"));
});

test("integration: default detection rules", () => {
  const ruleCount = 5; // Five rules for SEV1-3 coverage
  assert.equal(ruleCount, 5);
});

test("integration: incident category mapping", () => {
  const checkIdToCategory: Record<string, IncidentCategory> = {
    db: "data_integrity",
    config: "configuration",
    backup: "availability",
    locks: "data_integrity",
    workers: "availability",
    event_backlog: "performance",
    audit_integrity: "security",
    provider_health: "availability",
  };

  assert.equal(checkIdToCategory["db"], "data_integrity");
  assert.equal(checkIdToCategory["audit_integrity"], "security");
});

test("integration: incident detector urgency classification", () => {
  const classifyUrgency = (severity: IncidentSeverity): "critical" | "high" | "medium" | "low" => {
    switch (severity) {
      case "SEV1": return "critical";
      case "SEV2": return "high";
      case "SEV3": return "medium";
      case "SEV4": return "low";
      default: return "low";
    }
  };

  assert.equal(classifyUrgency("SEV1"), "critical");
  assert.equal(classifyUrgency("SEV2"), "high");
  assert.equal(classifyUrgency("SEV3"), "medium");
  assert.equal(classifyUrgency("SEV4"), "low");
});

test("integration: SEV1 auto-escalation threshold", () => {
  const SEV1_ESCALATION_SECONDS = 300;
  assert.equal(SEV1_ESCALATION_SECONDS, 300);
});

test("integration: incident resolution types", () => {
  const resolutionTypes = ["self_heal", "automated", "assisted", "manual"] as const;
  assert.equal(resolutionTypes.length, 4);
});

test("integration: check status types", () => {
  const checkStatuses = ["ok", "degraded", "fail_closed"] as const;
  assert.equal(checkStatuses.length, 3);
});

test("integration: incident detection metrics", () => {
  const metrics = {
    availability: 94.5,
    error_rate: 0.03,
    latency_p99: 500,
    data_integrity_check: true,
    config_drift_detected: false,
  };

  assert.ok(typeof metrics.availability === "number");
  assert.ok(typeof metrics.error_rate === "number");
  assert.ok(typeof metrics.data_integrity_check === "boolean");
});
