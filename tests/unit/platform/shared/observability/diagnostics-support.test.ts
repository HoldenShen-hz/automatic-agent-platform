import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIncidentTimelineMarkdown,
  extractRemoteAuthorityViolations,
  toIncidentTimelineEntry,
  countIncidentEntries,
  resolveDurationMs,
  inferTimelineSeverity,
  previewText,
  safeParseRecord,
  buildDiagnosticWarningSummary,
  classifyDiagnosticWarning,
  resolveHighestWarningSeverity,
  warningSeverityRank,
  selectRemoteTimelineEntries,
  extractRemoteWorkerIds,
  buildTraceSummary,
  type IncidentTimelineReport,
  type IncidentTimelineEntry,
  type DiagnosticWarningSummaryEntry,
} from "../../../../../src/platform/shared/observability/diagnostics-support.js";
import type { TaskTimelineEntry } from "../../../../../src/platform/shared/observability/task-timeline-service.js";

test("previewText collapses whitespace and truncates", () => {
  assert.equal(previewText("hello   world", 50), "hello world");
  assert.equal(previewText("a\n\nb\t\tc", 50), "a b c");
  assert.equal(previewText("hello world", 5), "hello");
});

test("previewText returns empty string for empty input", () => {
  assert.equal(previewText("", 50), "");
});

test("previewText handles maxLength defaults", () => {
  const long = "a".repeat(200);
  assert.equal(previewText(long).length, 120);
});

test("safeParseRecord parses valid JSON", () => {
  const result = safeParseRecord('{"key":"value"}');
  assert.deepEqual(result, { key: "value" });
});

test("safeParseRecord returns null for invalid JSON", () => {
  assert.equal(safeParseRecord("not json"), null);
});

test("safeParseRecord returns null for null input", () => {
  assert.equal(safeParseRecord(null), null);
});

test("safeParseRecord returns null for arrays", () => {
  assert.equal(safeParseRecord("[1,2,3]"), null);
});

test("safeParseRecord returns null for primitives", () => {
  assert.equal(safeParseRecord('"string"'), null);
  assert.equal(safeParseRecord("123"), null);
});

test("resolveDurationMs calculates duration", () => {
  assert.equal(resolveDurationMs("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z"), 1000);
  assert.equal(resolveDurationMs("2026-01-01T00:00:00.000Z", "2026-01-01T00:01:00.000Z"), 60000);
});

test("resolveDurationMs returns null for null inputs", () => {
  assert.equal(resolveDurationMs(null, "2026-01-01T00:00:00.000Z"), null);
  assert.equal(resolveDurationMs("2026-01-01T00:00:00.000Z", null), null);
});

test("resolveDurationMs returns null for invalid dates", () => {
  assert.equal(resolveDurationMs("invalid", "2026-01-01T00:00:00.000Z"), null);
  assert.equal(resolveDurationMs("2026-01-01T00:00:00.000Z", "invalid"), null);
});

test("resolveDurationMs returns zero for negative duration", () => {
  assert.equal(resolveDurationMs("2026-01-01T00:00:01.000Z", "2026-01-01T00:00:00.000Z"), 0);
});

test("warningSeverityRank returns correct ranks", () => {
  assert.equal(warningSeverityRank("critical"), 3);
  assert.equal(warningSeverityRank("warning"), 2);
  assert.equal(warningSeverityRank("info"), 1);
});

test("resolveHighestWarningSeverity finds highest severity", () => {
  const entries: DiagnosticWarningSummaryEntry[] = [
    { code: "a", category: "other", severity: "info", escalation: "none", count: 1, suppressedCount: 0 },
    { code: "b", category: "other", severity: "warning", escalation: "none", count: 1, suppressedCount: 0 },
  ];
  assert.equal(resolveHighestWarningSeverity(entries), "warning");
});

test("resolveHighestWarningSeverity returns info for empty array", () => {
  assert.equal(resolveHighestWarningSeverity([]), "info");
});

test("resolveHighestWarningSeverity prefers critical over warning", () => {
  const entries: DiagnosticWarningSummaryEntry[] = [
    { code: "a", category: "other", severity: "warning", escalation: "none", count: 1, suppressedCount: 0 },
    { code: "b", category: "other", severity: "critical", escalation: "none", count: 1, suppressedCount: 0 },
  ];
  assert.equal(resolveHighestWarningSeverity(entries), "critical");
});

test("classifyDiagnosticWarning classifies health warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("health:unhealthy"), {
    category: "health", severity: "critical", escalation: "operator"
  });
  assert.deepEqual(classifyDiagnosticWarning("health:overloaded"), {
    category: "health", severity: "critical", escalation: "operator"
  });
  assert.deepEqual(classifyDiagnosticWarning("health:degraded"), {
    category: "health", severity: "warning", escalation: "task"
  });
});

test("classifyDiagnosticWarning classifies provider warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("provider:failed"), {
    category: "provider", severity: "critical", escalation: "operator"
  });
  assert.deepEqual(classifyDiagnosticWarning("provider:timeout"), {
    category: "provider", severity: "warning", escalation: "task"
  });
});

test("classifyDiagnosticWarning classifies remote_authority warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("remote_authority:violation"), {
    category: "remote_authority", severity: "critical", escalation: "operator"
  });
});

test("classifyDiagnosticWarning classifies dispatch warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("dispatch:blocked"), {
    category: "dispatch", severity: "warning", escalation: "task"
  });
  assert.deepEqual(classifyDiagnosticWarning("dispatch:requeued"), {
    category: "dispatch", severity: "info", escalation: "none"
  });
});

test("classifyDiagnosticWarning classifies approval warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("approval_pending"), {
    category: "approval", severity: "warning", escalation: "operator"
  });
});

test("classifyDiagnosticWarning classifies takeover warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("takeover_open"), {
    category: "takeover", severity: "warning", escalation: "operator"
  });
});

test("classifyDiagnosticWarning classifies runtime warnings", () => {
  assert.deepEqual(classifyDiagnosticWarning("active_execution:pending"), {
    category: "runtime", severity: "info", escalation: "none"
  });
  assert.deepEqual(classifyDiagnosticWarning("degradation:memory"), {
    category: "runtime", severity: "warning", escalation: "task"
  });
});

test("classifyDiagnosticWarning defaults unknown codes", () => {
  assert.deepEqual(classifyDiagnosticWarning("unknown:code"), {
    category: "other", severity: "warning", escalation: "task"
  });
});

test("buildDiagnosticWarningSummary aggregates warnings", () => {
  const warnings = ["health:unhealthy", "health:unhealthy", "provider:failed"];
  const result = buildDiagnosticWarningSummary(warnings);

  assert.equal(result.totalEvents, 3);
  assert.equal(result.totalUniqueWarnings, 2);
  assert.equal(result.suppressedDuplicateCount, 1);
  assert.equal(result.highestSeverity, "critical");
});

test("buildDiagnosticWarningSummary tracks duplicate suppression", () => {
  const warnings = ["a", "a", "a", "b"];
  const result = buildDiagnosticWarningSummary(warnings);

  assert.equal(result.totalEvents, 4);
  assert.equal(result.totalUniqueWarnings, 2);
  assert.equal(result.suppressedDuplicateCount, 2);
});

test("buildDiagnosticWarningSummary includes escalation targets", () => {
  const warnings = ["health:unhealthy", "dispatch:blocked", "info"];
  const result = buildDiagnosticWarningSummary(warnings);

  assert.ok(result.escalationTargets.includes("operator"));
  assert.ok(result.escalationTargets.includes("task"));
  assert.ok(!result.escalationTargets.includes("none"));
});

test("countIncidentEntries filters by source", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "event", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
    { id: "2", source: "event", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
    { id: "3", source: "dispatch", occurredAt: "", title: "", summary: "", severity: "info", data: {} },
  ];
  assert.equal(countIncidentEntries(entries, "event"), 2);
  assert.equal(countIncidentEntries(entries, "dispatch"), 1);
  assert.equal(countIncidentEntries(entries, "log"), 0);
});

test("inferTimelineSeverity returns warning for blocked dispatch", () => {
  const entry = { kind: "dispatch" as const, title: "", summary: "", status: "blocked", data: {}, occurredAt: "", id: "" };
  assert.equal(inferTimelineSeverity(entry), "warning");
});

test("inferTimelineSeverity returns critical for remote_log error", () => {
  const entry = { kind: "remote_log" as const, title: "", summary: "", data: { level: "error" }, occurredAt: "", id: "" };
  assert.equal(inferTimelineSeverity(entry), "critical");
});

test("inferTimelineSeverity returns warning for remote_log warn", () => {
  const entry = { kind: "remote_log" as const, title: "", summary: "", data: { level: "warn" }, occurredAt: "", id: "" };
  assert.equal(inferTimelineSeverity(entry), "warning");
});

test("inferTimelineSeverity returns info for remote_log info", () => {
  const entry = { kind: "remote_log" as const, title: "", summary: "", data: { level: "info" }, occurredAt: "", id: "" };
  assert.equal(inferTimelineSeverity(entry), "info");
});

test("inferTimelineSeverity returns critical for remote_authority rejection", () => {
  const entry = {
    kind: "event" as const,
    title: "worker:claim_rejected",
    summary: "",
    data: { reasonCode: "remote_session_expired" },
    occurredAt: "",
    id: ""
  };
  assert.equal(inferTimelineSeverity(entry), "critical");
});

test("inferTimelineSeverity returns warning for non-remote rejection", () => {
  const entry = {
    kind: "event" as const,
    title: "worker:claim_rejected",
    summary: "",
    data: { reasonCode: "other_reason" },
    occurredAt: "",
    id: ""
  };
  assert.equal(inferTimelineSeverity(entry), "warning");
});

test("inferTimelineSeverity returns warning for requested approval", () => {
  const entry = { kind: "approval" as const, title: "", summary: "", status: "requested", data: {}, occurredAt: "", id: "" };
  assert.equal(inferTimelineSeverity(entry), "warning");
});

test("inferTimelineSeverity returns info by default", () => {
  const entry = { kind: "event" as const, title: "other", summary: "", data: {}, occurredAt: "", id: "" };
  assert.equal(inferTimelineSeverity(entry), "info");
});

test("selectRemoteTimelineEntries filters remote logs", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "remote_log", title: "", summary: "", severity: "info", occurredAt: "", data: {} },
    { id: "2", source: "event", title: "worker:heartbeat", summary: "", severity: "info", occurredAt: "", data: {} },
    { id: "3", source: "message", title: "", summary: "", severity: "info", occurredAt: "", data: {} },
  ];
  const result = selectRemoteTimelineEntries(entries);
  assert.equal(result.length, 2); // remote_log + event with worker prefix
});

test("selectRemoteTimelineEntries includes prefer_remote dispatch", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "dispatch", title: "", summary: "", severity: "info", occurredAt: "", data: { dispatchTarget: "prefer_remote" } },
  ];
  const result = selectRemoteTimelineEntries(entries);
  assert.equal(result.length, 1);
});

test("selectRemoteTimelineEntries includes require_remote dispatch", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "dispatch", title: "", summary: "", severity: "info", occurredAt: "", data: { dispatchTarget: "require_remote" } },
  ];
  const result = selectRemoteTimelineEntries(entries);
  assert.equal(result.length, 1);
});

test("selectRemoteTimelineEntries includes remote placement dispatch", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "dispatch", title: "", summary: "", severity: "info", occurredAt: "", data: { selectedWorkerPlacement: "remote" } },
  ];
  const result = selectRemoteTimelineEntries(entries);
  assert.equal(result.length, 1);
});

test("extractRemoteWorkerIds extracts workerId", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "log", title: "", summary: "", severity: "info", occurredAt: "", data: { workerId: "worker-1" } },
  ];
  const result = extractRemoteWorkerIds(entries);
  assert.deepEqual(result, ["worker-1"]);
});

test("extractRemoteWorkerIds extracts selectedWorkerId with remote placement", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "dispatch", title: "", summary: "", severity: "info", occurredAt: "", data: { selectedWorkerId: "worker-2", selectedWorkerPlacement: "remote" } },
  ];
  const result = extractRemoteWorkerIds(entries);
  assert.deepEqual(result, ["worker-2"]);
});

test("extractRemoteWorkerIds extracts remoteAcceptedWorkerIds", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "dispatch", title: "", summary: "", severity: "info", occurredAt: "", data: { remoteAcceptedWorkerIds: ["worker-3", "worker-4"] } },
  ];
  const result = extractRemoteWorkerIds(entries);
  assert.deepEqual(result, ["worker-3", "worker-4"]);
});

test("extractRemoteWorkerIds extracts remoteRejectedWorkerIds", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "dispatch", title: "", summary: "", severity: "info", occurredAt: "", data: { remoteRejectedWorkerIds: ["worker-5"] } },
  ];
  const result = extractRemoteWorkerIds(entries);
  assert.deepEqual(result, ["worker-5"]);
});

test("extractRemoteWorkerIds deduplicates and sorts", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "log", title: "", summary: "", severity: "info", occurredAt: "", data: { workerId: "worker-b" } },
    { id: "2", source: "log", title: "", summary: "", severity: "info", occurredAt: "", data: { workerId: "worker-a" } },
    { id: "3", source: "log", title: "", summary: "", severity: "info", occurredAt: "", data: { workerId: "worker-b" } },
  ];
  const result = extractRemoteWorkerIds(entries);
  assert.deepEqual(result, ["worker-a", "worker-b"]);
});

test("extractRemoteWorkerIds ignores empty strings", () => {
  const entries: IncidentTimelineEntry[] = [
    { id: "1", source: "log", title: "", summary: "", severity: "info", occurredAt: "", data: { workerId: "" } },
  ];
  const result = extractRemoteWorkerIds(entries);
  assert.deepEqual(result, []);
});

test("extractRemoteAuthorityViolations extracts violations", () => {
  const events = [
    { id: "1", eventType: "worker:claim_rejected", payloadJson: '{"reasonCode":"remote_session_expired"}', traceId: null, taskId: null },
    { id: "2", eventType: "worker:heartbeat_rejected", payloadJson: '{"reasonCode":"remote_session_invalid"}', traceId: null, taskId: null },
    { id: "3", eventType: "worker:writeback_rejected", payloadJson: '{"reasonCode":"remote_session_timeout"}', traceId: null, taskId: null },
  ];
  const result = extractRemoteAuthorityViolations(events as any);
  assert.equal(result.length, 3);
  assert.ok(result.every(v => v.startsWith("remote_session_")));
});

test("extractRemoteAuthorityViolations ignores other events", () => {
  const events = [
    { id: "1", eventType: "task:created", payloadJson: '{"reasonCode":"remote_session_expired"}', traceId: null, taskId: null },
    { id: "2", eventType: "worker:claim_rejected", payloadJson: '{"reasonCode":"local_error"}', traceId: null, taskId: null },
  ];
  const result = extractRemoteAuthorityViolations(events as any);
  assert.equal(result.length, 0);
});

test("extractRemoteAuthorityViolations handles invalid JSON", () => {
  const events = [
    { id: "1", eventType: "worker:claim_rejected", payloadJson: "not json", traceId: null, taskId: null },
  ];
  const result = extractRemoteAuthorityViolations(events as any);
  assert.equal(result.length, 0);
});

test("buildTraceSummary extracts first trace", () => {
  const entries: TaskTimelineEntry[] = [
    { id: "1", kind: "event", title: "", summary: "", data: {}, occurredAt: "" },
    { id: "2", kind: "event", title: "", summary: "", data: {}, occurredAt: "", traceId: "trace-1" },
  ];
  const result = buildTraceSummary(entries, null, null);
  assert.equal(result.traceId, "trace-1");
});

test("buildTraceSummary uses fallback", () => {
  const entries: TaskTimelineEntry[] = [
    { id: "1", kind: "event", title: "", summary: "", data: {}, occurredAt: "" },
  ];
  const result = buildTraceSummary(entries, "fallback-trace", "fallback-correlation");
  assert.equal(result.traceId, "fallback-trace");
  assert.equal(result.correlationId, "fallback-correlation");
});

test("buildTraceSummary collects spanIds", () => {
  const entries: TaskTimelineEntry[] = [
    { id: "1", kind: "event", title: "", summary: "", data: {}, occurredAt: "", spanId: "span-1" },
    { id: "2", kind: "event", title: "", summary: "", data: {}, occurredAt: "", spanId: "span-2" },
    { id: "3", kind: "event", title: "", summary: "", data: {}, occurredAt: "" },
  ];
  const result = buildTraceSummary(entries, null, null);
  assert.deepEqual(result.spanIds, ["span-1", "span-2"]);
});

test("toIncidentTimelineEntry converts entry", () => {
  const entry = {
    id: "entry-1",
    kind: "dispatch" as const,
    occurredAt: "2026-01-01T00:00:00.000Z",
    title: "task:dispatched",
    summary: "Task was dispatched",
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: "parent-1",
    correlationId: "corr-1",
    status: "ok",
    data: { key: "value" },
  };
  const result = toIncidentTimelineEntry(entry);
  assert.equal(result.id, "entry-1");
  assert.equal(result.source, "dispatch");
  assert.equal(result.traceId, "trace-1");
  assert.equal(result.status, "ok");
  assert.deepEqual(result.data, { key: "value" });
});

test("buildIncidentTimelineMarkdown generates markdown", () => {
  const report: IncidentTimelineReport = {
    taskId: "task_123",
    traceSummary: { traceId: "trace-abc", correlationId: null, spanIds: [] },
    window: { startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T01:00:00.000Z", durationMs: 3600000 },
    summary: {
      totalEntries: 2, eventCount: 1, dispatchCount: 1, stepOutputCount: 0,
      approvalCount: 0, artifactCount: 0, logCount: 0, remoteLogCount: 0,
      messageCount: 0, compactionCount: 0, highestSeverity: "critical"
    },
    warnings: {
      totalEvents: 1, totalUniqueWarnings: 1, suppressedDuplicateCount: 0,
      highestSeverity: "critical", escalationTargets: ["operator"],
      entries: [{ code: "health:unhealthy", category: "health", severity: "critical", escalation: "operator", count: 1, suppressedCount: 0 }]
    },
    candidateRootCauses: ["Provider failed"],
    entries: [
      { id: "1", source: "event", occurredAt: "2026-01-01T00:00:00.000Z", title: "task:created", summary: "Task created", severity: "info", data: {} }
    ],
  };
  const result = buildIncidentTimelineMarkdown(report);
  assert.ok(result.includes("# Incident Timeline: task_123"));
  assert.ok(result.includes("trace-abc"));
  assert.ok(result.includes("Provider failed"));
  assert.ok(result.includes("health:unhealthy"));
});
