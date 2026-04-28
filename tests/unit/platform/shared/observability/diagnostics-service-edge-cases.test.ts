import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiagnosticWarningSummary,
  selectRemoteTimelineEntries,
  type DiagnosticWarningSummaryEntry,
  type IncidentTimelineEntry,
} from "../../../../../src/platform/shared/observability/diagnostics-service.js";

test("buildDiagnosticWarningSummary handles single warning code", () => {
  const summary = buildDiagnosticWarningSummary(["dispatch:blocked"]);

  assert.equal(summary.totalEvents, 1);
  assert.equal(summary.totalUniqueWarnings, 1);
  assert.equal(summary.suppressedDuplicateCount, 0);
  assert.equal(summary.highestSeverity, "warning");
  assert.deepEqual(summary.escalationTargets, ["task"]);
  assert.equal(summary.entries.length, 1);
});

test("buildDiagnosticWarningSummary counts duplicates correctly", () => {
  const summary = buildDiagnosticWarningSummary([
    "dispatch:blocked",
    "dispatch:blocked",
    "dispatch:blocked",
    "dispatch:blocked",
  ]);

  assert.equal(summary.totalEvents, 4);
  assert.equal(summary.totalUniqueWarnings, 1);
  assert.equal(summary.suppressedDuplicateCount, 3);
  assert.equal(summary.entries[0]!.count, 4);
  assert.equal(summary.entries[0]!.suppressedCount, 3);
});

test("buildDiagnosticWarningSummary handles mixed severity warnings", () => {
  const summary = buildDiagnosticWarningSummary([
    "remote_authority:remote_session_resume_offset_missing", // critical
    "dispatch:blocked", // warning
  ]);

  assert.equal(summary.highestSeverity, "critical");
  assert.ok(summary.escalationTargets.includes("operator"));
  assert.ok(summary.escalationTargets.includes("task"));
});

test("buildDiagnosticWarningSummary handles empty array", () => {
  const summary = buildDiagnosticWarningSummary([]);

  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.totalUniqueWarnings, 0);
  assert.equal(summary.suppressedDuplicateCount, 0);
  assert.equal(summary.highestSeverity, "info");
  assert.deepEqual(summary.escalationTargets, []);
  assert.deepEqual(summary.entries, []);
});

test("buildDiagnosticWarningSummary handles warning codes without colon", () => {
  const summary = buildDiagnosticWarningSummary(["generic_warning"]);

  assert.equal(summary.totalEvents, 1);
  assert.equal(summary.entries[0]!.category, "runtime");
});

test("buildDiagnosticWarningSummary correctly parses three-part codes", () => {
  const summary = buildDiagnosticWarningSummary(["source:category:detail"]);

  assert.equal(summary.entries[0]!.code, "source:category:detail");
  assert.equal(summary.entries[0]!.category, "category");
});

test("selectRemoteTimelineEntries filters remote logs correctly", () => {
  const entries: IncidentTimelineEntry[] = [
    {
      id: "remote-log-1",
      source: "remote_log",
      occurredAt: "2026-04-26T10:00:00.000Z",
      title: "remote_log:error",
      summary: "Remote worker error",
      severity: "critical",
      correlationId: "task-1",
      data: { workerId: "worker-1" },
    },
    {
      id: "local-log-1",
      source: "log",
      occurredAt: "2026-04-26T10:01:00.000Z",
      title: "local_log:info",
      summary: "Local log",
      severity: "info",
      correlationId: "task-1",
      data: {},
    },
  ];

  const result = selectRemoteTimelineEntries(entries);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "remote-log-1");
});

test("selectRemoteTimelineEntries handles empty array", () => {
  const result = selectRemoteTimelineEntries([]);
  assert.deepEqual(result, []);
});

test("selectRemoteTimelineEntries includes remote-routing events", () => {
  const entries: IncidentTimelineEntry[] = [
    {
      id: "dispatch-remote",
      source: "dispatch",
      occurredAt: "2026-04-26T10:00:00.000Z",
      title: "dispatch:dispatched",
      summary: "Dispatch to remote",
      severity: "info",
      correlationId: "task-1",
      data: {
        dispatchTarget: "prefer_remote",
        selectedWorkerId: "worker-remote",
        selectedWorkerPlacement: "remote",
        remoteAvailability: "healthy",
      },
    },
  ];

  const result = selectRemoteTimelineEntries(entries);

  assert.equal(result.length, 1);
});

test("selectRemoteTimelineEntries excludes local dispatch events", () => {
  const entries: IncidentTimelineEntry[] = [
    {
      id: "dispatch-local",
      source: "dispatch",
      occurredAt: "2026-04-26T10:00:00.000Z",
      title: "dispatch:dispatched",
      summary: "Dispatch to local",
      severity: "info",
      correlationId: "task-1",
      data: {
        dispatchTarget: "any",
        selectedWorkerId: "worker-local",
        selectedWorkerPlacement: "local",
        remoteAvailability: null,
      },
    },
  ];

  const result = selectRemoteTimelineEntries(entries);

  assert.equal(result.length, 0);
});

test("buildDiagnosticWarningSummary calculates escalation targets correctly", () => {
  const summary = buildDiagnosticWarningSummary([
    "remote_authority:remote_session_resume_offset_missing",
  ]);

  // remote_authority -> operator escalation
  assert.ok(summary.escalationTargets.includes("operator"));
});

test("buildDiagnosticWarningSummary with dispatch:blocked adds task escalation", () => {
  const summary = buildDiagnosticWarningSummary(["dispatch:blocked"]);

  // dispatch:blocked has task escalation
  assert.ok(summary.escalationTargets.includes("task"));
});

test("selectRemoteTimelineEntries handles entries with missing data fields", () => {
  const entries: IncidentTimelineEntry[] = [
    {
      id: "remote-log-incomplete",
      source: "remote_log",
      occurredAt: "2026-04-26T10:00:00.000Z",
      title: "remote_log:warn",
      summary: "Incomplete remote log",
      severity: "warning",
      correlationId: "task-1",
      data: {},
    },
  ];

  const result = selectRemoteTimelineEntries(entries);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "remote-log-incomplete");
});

test("selectRemoteTimelineEntries handles mixed remote/local sources", () => {
  const entries: IncidentTimelineEntry[] = [
    {
      id: "remote-log-1",
      source: "remote_log",
      occurredAt: "2026-04-26T10:00:00.000Z",
      title: "remote_log:info",
      summary: "Remote 1",
      severity: "info",
      correlationId: "task-1",
      data: { workerId: "worker-1" },
    },
    {
      id: "dispatch-remote",
      source: "dispatch",
      occurredAt: "2026-04-26T10:01:00.000Z",
      title: "dispatch:dispatched",
      summary: "Remote dispatch",
      severity: "info",
      correlationId: "task-1",
      data: {
        dispatchTarget: "prefer_remote",
        selectedWorkerId: "worker-remote",
        selectedWorkerPlacement: "remote",
      },
    },
    {
      id: "local-artifact",
      source: "artifact",
      occurredAt: "2026-04-26T10:02:00.000Z",
      title: "artifact:report",
      summary: "Local artifact",
      severity: "info",
      correlationId: "task-1",
      data: {},
    },
    {
      id: "dispatch-local",
      source: "dispatch",
      occurredAt: "2026-04-26T10:03:00.000Z",
      title: "dispatch:blocked",
      summary: "Local blocked",
      severity: "warning",
      correlationId: "task-1",
      data: { reasonCode: "no_worker" },
    },
  ];

  const result = selectRemoteTimelineEntries(entries);

  // Should include remote-log-1 and dispatch-remote, exclude local-artifact and dispatch-local
  assert.equal(result.length, 2);
  assert.ok(result.some((e) => e.id === "remote-log-1"));
  assert.ok(result.some((e) => e.id === "dispatch-remote"));
});

test("buildDiagnosticWarningSummary severity order is correct", () => {
  const summaryEmergency = buildDiagnosticWarningSummary(["provider:outage"]);
  const summaryCritical = buildDiagnosticWarningSummary(["remote_authority:remote_session_resume_offset_missing"]);
  const summaryWarning = buildDiagnosticWarningSummary(["dispatch:blocked"]);
  const summaryInfo = buildDiagnosticWarningSummary([]);

  // Severity order: info < warning < critical < emergency
  const severityOrder: Record<string, number> = {
    info: 0,
    warning: 1,
    critical: 2,
    emergency: 3,
  };

  assert.ok(severityOrder[summaryEmergency.highestSeverity]! >= severityOrder[summaryCritical.highestSeverity]!);
  assert.ok(severityOrder[summaryCritical.highestSeverity]! >= severityOrder[summaryWarning.highestSeverity]!);
  assert.ok(severityOrder[summaryWarning.highestSeverity]! >= severityOrder[summaryInfo.highestSeverity]!);
});

test("DiagnosticWarningSummaryEntry structure is correct", () => {
  const entry: DiagnosticWarningSummaryEntry = {
    code: "test:code",
    category: "runtime",
    severity: "warning",
    escalation: "task",
    count: 5,
    suppressedCount: 2,
  };

  assert.equal(entry.code, "test:code");
  assert.equal(entry.category, "runtime");
  assert.equal(entry.severity, "warning");
  assert.equal(entry.escalation, "task");
  assert.equal(entry.count, 5);
  assert.equal(entry.suppressedCount, 2);
});

test("selectRemoteTimelineEntries returns entries sorted by occurredAt", () => {
  const entries: IncidentTimelineEntry[] = [
    {
      id: "later",
      source: "remote_log",
      occurredAt: "2026-04-26T12:00:00.000Z",
      title: "remote_log:info",
      summary: "Later entry",
      severity: "info",
      correlationId: "task-1",
      data: { workerId: "worker-1" },
    },
    {
      id: "earlier",
      source: "remote_log",
      occurredAt: "2026-04-26T08:00:00.000Z",
      title: "remote_log:info",
      summary: "Earlier entry",
      severity: "info",
      correlationId: "task-1",
      data: { workerId: "worker-1" },
    },
  ];

  const result = selectRemoteTimelineEntries(entries);

  // Should be sorted by occurredAt
  assert.equal(result[0]!.id, "earlier");
  assert.equal(result[1]!.id, "later");
});
