import assert from "node:assert/strict";
import test from "node:test";

import type {
  DiagnosticSnapshot,
  DebugDump,
  DiagnosticWarningCategory,
  DiagnosticWarningSeverity,
  DiagnosticWarningEscalation,
  DiagnosticWarningSummaryEntry,
  DiagnosticWarningSummary,
  MinimalReproBundle,
  IncidentTimelineSource,
  IncidentTimelineEntry,
  IncidentTimelineReport,
  RemoteTimelineReport,
} from "../../../../../src/platform/shared/observability/diagnostics-support.js";
import {
  previewText,
  safeParseRecord,
  countIncidentEntries,
  resolveDurationMs,
  warningSeverityRank,
} from "../../../../../src/platform/shared/observability/diagnostics-support.js";

test("DiagnosticWarningCategory type accepts valid values", () => {
  const categories: DiagnosticWarningCategory[] = [
    "health",
    "runtime",
    "approval",
    "takeover",
    "provider",
    "dispatch",
    "remote_authority",
    "other",
  ];
  assert.equal(categories.length, 8);
});

test("DiagnosticWarningSeverity type accepts valid values", () => {
  const severities: DiagnosticWarningSeverity[] = ["info", "warning", "critical"];
  assert.equal(severities.length, 3);
});

test("DiagnosticWarningEscalation type accepts valid values", () => {
  const escalations: DiagnosticWarningEscalation[] = ["none", "task", "operator"];
  assert.equal(escalations.length, 3);
});

test("DiagnosticWarningSummaryEntry structure is correct", () => {
  const entry: DiagnosticWarningSummaryEntry = {
    code: "health:unhealthy",
    category: "health",
    severity: "critical",
    escalation: "operator",
    count: 5,
    suppressedCount: 2,
  };
  assert.equal(entry.code, "health:unhealthy");
  assert.equal(entry.category, "health");
  assert.equal(entry.severity, "critical");
  assert.equal(entry.escalation, "operator");
  assert.equal(entry.count, 5);
  assert.equal(entry.suppressedCount, 2);
});

test("DiagnosticWarningSummary structure is correct", () => {
  const summary: DiagnosticWarningSummary = {
    totalEvents: 10,
    totalUniqueWarnings: 3,
    suppressedDuplicateCount: 7,
    highestSeverity: "critical",
    escalationTargets: ["operator", "task"],
    entries: [],
  };
  assert.equal(summary.totalEvents, 10);
  assert.equal(summary.totalUniqueWarnings, 3);
  assert.equal(summary.suppressedDuplicateCount, 7);
  assert.equal(summary.highestSeverity, "critical");
  assert.deepEqual(summary.escalationTargets, ["operator", "task"]);
});

test("IncidentTimelineSource type accepts valid values", () => {
  const sources: IncidentTimelineSource[] = [
    "event",
    "dispatch",
    "step_output",
    "approval",
    "artifact",
    "log",
    "remote_log",
    "message",
    "compaction",
  ];
  assert.equal(sources.length, 9);
});

test("IncidentTimelineEntry structure is correct", () => {
  const entry: IncidentTimelineEntry = {
    id: "entry_123",
    source: "event",
    occurredAt: "2026-04-14T00:00:00.000Z",
    title: "worker:claim_rejected",
    summary: "Worker rejected claim request",
    severity: "warning",
    data: { reasonCode: "remote_session_expired" },
  };
  assert.equal(entry.id, "entry_123");
  assert.equal(entry.source, "event");
  assert.equal(entry.title, "worker:claim_rejected");
  assert.equal(entry.severity, "warning");
});

test("IncidentTimelineEntry allows optional trace fields", () => {
  const entry: IncidentTimelineEntry = {
    id: "entry_123",
    source: "log",
    occurredAt: "2026-04-14T00:00:00.000Z",
    title: "log:error",
    summary: "Error occurred",
    severity: "critical",
    traceId: "trace_abc",
    spanId: "span_xyz",
    parentSpanId: "parent_span",
    correlationId: "corr_123",
    data: {},
  };
  assert.equal(entry.traceId, "trace_abc");
  assert.equal(entry.spanId, "span_xyz");
  assert.equal(entry.parentSpanId, "parent_span");
  assert.equal(entry.correlationId, "corr_123");
});

test("IncidentTimelineReport structure is correct", () => {
  const report: IncidentTimelineReport = {
    taskId: "task_123",
    traceSummary: {
      traceId: "trace_abc",
      correlationId: "corr_xyz",
      spanIds: ["span_1", "span_2"],
    },
    window: {
      startedAt: "2026-04-14T00:00:00.000Z",
      endedAt: "2026-04-14T01:00:00.000Z",
      durationMs: 3600000,
    },
    summary: {
      totalEntries: 25,
      eventCount: 5,
      dispatchCount: 3,
      stepOutputCount: 10,
      approvalCount: 1,
      artifactCount: 2,
      logCount: 3,
      remoteLogCount: 1,
      messageCount: 0,
      compactionCount: 0,
      highestSeverity: "warning",
    },
    warnings: {
      totalEvents: 3,
      totalUniqueWarnings: 2,
      suppressedDuplicateCount: 1,
      highestSeverity: "warning",
      escalationTargets: ["task"],
      entries: [],
    },
    candidateRootCauses: ["Provider timeout", "Worker congestion"],
    entries: [],
  };
  assert.equal(report.taskId, "task_123");
  assert.equal(report.window.durationMs, 3600000);
  assert.equal(report.summary.totalEntries, 25);
});

test("RemoteTimelineReport structure is correct", () => {
  const report: RemoteTimelineReport = {
    taskId: "task_123",
    traceSummary: {
      traceId: "trace_abc",
      correlationId: null,
      spanIds: [],
    },
    totalEntries: 15,
    totalRemoteLogs: 10,
    latestRemoteLogAt: "2026-04-14T00:45:00.000Z",
    remoteWorkerIds: ["worker_1", "worker_2"],
    entries: [],
  };
  assert.equal(report.taskId, "task_123");
  assert.equal(report.totalEntries, 15);
  assert.equal(report.totalRemoteLogs, 10);
  assert.deepEqual(report.remoteWorkerIds, ["worker_1", "worker_2"]);
});

test("previewText truncates long content", () => {
  const longText = "This is a very long piece of text that should be truncated because it exceeds the maximum length limit";
  const result = previewText(longText, 30);
  assert.equal(result.length, 30);
  assert.ok(!result.includes("should be truncated"));
});

test("previewText normalizes whitespace", () => {
  const textWithSpaces = "This   has    irregular    whitespace";
  const result = previewText(textWithSpaces, 100);
  assert.ok(!result.includes("  ")); // No double spaces
});

test("previewText uses default maxLength of 120", () => {
  const longText = "a".repeat(200);
  const result = previewText(longText);
  assert.equal(result.length, 120);
});

test("previewText returns empty string for empty input", () => {
  const result = previewText("", 50);
  assert.equal(result, "");
});

test("safeParseRecord parses valid JSON", () => {
  const result = safeParseRecord('{"key": "value", "num": 42}');
  assert.ok(result !== null);
  assert.equal(result!["key"], "value");
  assert.equal(result!["num"], 42);
});

test("safeParseRecord returns null for null input", () => {
  const result = safeParseRecord(null);
  assert.equal(result, null);
});

test("safeParseRecord returns null for invalid JSON", () => {
  const result = safeParseRecord("not valid json");
  assert.equal(result, null);
});

test("safeParseRecord returns null for array JSON", () => {
  const result = safeParseRecord("[1, 2, 3]");
  assert.equal(result, null);
});

test("safeParseRecord returns null for primitive JSON", () => {
  const result = safeParseRecord('"just a string"');
  assert.equal(result, null);
});

test("safeParseRecord handles empty string", () => {
  const result = safeParseRecord("");
  assert.equal(result, null);
});

test("countIncidentEntries filters by source", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "event", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
    { id: "2", source: "event", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
    { id: "3", source: "dispatch", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
    { id: "4", source: "log", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
  ];
  assert.equal(countIncidentEntries(entries, "event"), 2);
  assert.equal(countIncidentEntries(entries, "dispatch"), 1);
  assert.equal(countIncidentEntries(entries, "log"), 1);
  assert.equal(countIncidentEntries(entries, "compaction"), 0);
});

test("resolveDurationMs calculates correct duration", () => {
  const result = resolveDurationMs("2026-04-14T00:00:00.000Z", "2026-04-14T01:00:00.000Z");
  assert.equal(result, 3600000); // 1 hour in ms
});

test("resolveDurationMs returns null for null inputs", () => {
  assert.equal(resolveDurationMs(null, "2026-04-14T01:00:00.000Z"), null);
  assert.equal(resolveDurationMs("2026-04-14T00:00:00.000Z", null), null);
  assert.equal(resolveDurationMs(null, null), null);
});

test("resolveDurationMs returns null for invalid date strings", () => {
  assert.equal(resolveDurationMs("not-a-date", "2026-04-14T01:00:00.000Z"), null);
  assert.equal(resolveDurationMs("2026-04-14T00:00:00.000Z", "also-not-a-date"), null);
});

test("resolveDurationMs returns zero for negative duration", () => {
  const result = resolveDurationMs("2026-04-14T01:00:00.000Z", "2026-04-14T00:00:00.000Z");
  assert.equal(result, 0);
});

test("warningSeverityRank returns correct ranks", () => {
  assert.equal(warningSeverityRank("critical"), 3);
  assert.equal(warningSeverityRank("warning"), 2);
  assert.equal(warningSeverityRank("info"), 1);
});

test("MinimalReproBundle structure is correct", () => {
  const bundle: MinimalReproBundle = {
    taskId: "task_123",
    sensitivityWarning: "Contains potentially sensitive data",
    taskInputJson: '{"task": "data"}',
    workflowState: null,
    taskResult: null,
    relevantMessages: [],
    toolUsage: [],
    sanitizedArtifacts: [],
    fileLocks: [],
    configSubset: {
      configVersion: "1.0.0",
      promptBundleVersion: "1.0.0",
      enabledExtensions: [],
    },
    providerStatus: {
      health: "healthy",
      successRate: 0.95,
      recentCalls: 100,
    },
    dispatchDecisions: [],
  };
  assert.equal(bundle.taskId, "task_123");
  assert.equal(bundle.sensitivityWarning, "Contains potentially sensitive data");
  assert.equal(bundle.configSubset.configVersion, "1.0.0");
});
