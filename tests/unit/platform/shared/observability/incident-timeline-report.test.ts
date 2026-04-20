import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIncidentTimelineMarkdown,
  type IncidentTimelineReport,
} from "../../../../../src/platform/shared/observability/diagnostics-service.js";

test("buildIncidentTimelineMarkdown renders counts, root causes, warnings, and timeline entries", () => {
  const report: IncidentTimelineReport = {
    taskId: "task-incident-unit",
    traceSummary: {
      traceId: "trace-incident-unit",
      correlationId: "task-incident-unit",
      spanIds: ["span-1"],
    },
    window: {
      startedAt: "2026-04-06T10:00:00.000Z",
      endedAt: "2026-04-06T10:00:05.000Z",
      durationMs: 5_000,
    },
    summary: {
      totalEntries: 3,
      eventCount: 1,
      dispatchCount: 0,
      stepOutputCount: 0,
      approvalCount: 0,
      artifactCount: 0,
      logCount: 1,
      remoteLogCount: 1,
      messageCount: 1,
      compactionCount: 0,
      highestSeverity: "critical",
    },
    warnings: {
      totalEvents: 2,
      totalUniqueWarnings: 1,
      suppressedDuplicateCount: 1,
      highestSeverity: "critical",
      escalationTargets: ["operator"],
      entries: [
        {
          code: "remote_authority:remote_session_resume_offset_missing",
          category: "remote_authority",
          severity: "critical",
          escalation: "operator",
          count: 2,
          suppressedCount: 1,
        },
      ],
    },
    candidateRootCauses: [
      "Remote worker session authority failed; inspect resume offset, reconnect state, and fencing ownership.",
    ],
    entries: [
      {
        id: "evt-incident-unit",
        source: "event",
        occurredAt: "2026-04-06T10:00:00.000Z",
        title: "worker:heartbeat_rejected",
        summary: "Worker heartbeat rejected by remote_session_resume_offset_missing",
        severity: "critical",
        status: "rejected",
        traceId: "trace-incident-unit",
        spanId: "span-1",
        parentSpanId: null,
        correlationId: "task-incident-unit",
        data: {},
      },
      {
        id: "log-incident-unit",
        source: "log",
        occurredAt: "2026-04-06T10:00:03.000Z",
        title: "log:error",
        summary: "lease fencing mismatch observed",
        severity: "critical",
        traceId: "trace-incident-unit",
        spanId: null,
        parentSpanId: null,
        correlationId: "task-incident-unit",
        data: {},
      },
      {
        id: "msg-incident-unit",
        source: "message",
        occurredAt: "2026-04-06T10:00:05.000Z",
        title: "message:tool_result",
        summary: "system tool_result message: last retry failed",
        severity: "info",
        correlationId: "task-incident-unit",
        data: {},
      },
    ],
  };

  const markdown = buildIncidentTimelineMarkdown(report);

  assert.match(markdown, /# Incident Timeline: task-incident-unit/);
  assert.match(markdown, /Highest severity: critical/);
  assert.match(markdown, /events: 1/);
  assert.match(markdown, /logs: 1/);
  assert.match(markdown, /messages: 1/);
  assert.match(markdown, /Remote worker session authority failed/);
  assert.match(markdown, /remote_authority:remote_session_resume_offset_missing/);
  assert.match(markdown, /\[event\] \[critical\] worker:heartbeat_rejected/);
  assert.match(markdown, /\[log\] \[critical\] log:error/);
});

test("buildIncidentTimelineMarkdown renders info severity entries", () => {
  const report: IncidentTimelineReport = {
    taskId: "task-info",
    traceSummary: {
      traceId: "trace-info",
      correlationId: "task-info",
      spanIds: [],
    },
    window: {
      startedAt: "2026-04-06T10:00:00.000Z",
      endedAt: "2026-04-06T10:00:01.000Z",
      durationMs: 1_000,
    },
    summary: {
      totalEntries: 1,
      eventCount: 0,
      dispatchCount: 0,
      stepOutputCount: 0,
      approvalCount: 0,
      artifactCount: 0,
      logCount: 0,
      remoteLogCount: 0,
      messageCount: 1,
      compactionCount: 0,
      highestSeverity: "info",
    },
    warnings: {
      totalEvents: 0,
      totalUniqueWarnings: 0,
      suppressedDuplicateCount: 0,
      highestSeverity: "info",
      escalationTargets: [],
      entries: [],
    },
    candidateRootCauses: [],
    entries: [
      {
        id: "msg-info",
        source: "message",
        occurredAt: "2026-04-06T10:00:01.000Z",
        title: "message:tool_result",
        summary: "tool completed successfully",
        severity: "info",
        correlationId: "task-info",
        data: {},
      },
    ],
  };

  const markdown = buildIncidentTimelineMarkdown(report);

  assert.match(markdown, /# Incident Timeline: task-info/);
  assert.match(markdown, /Highest severity: info/);
  assert.match(markdown, /\[message\] \[info\] message:tool_result/);
});

test("buildIncidentTimelineMarkdown renders dispatch entries", () => {
  const report: IncidentTimelineReport = {
    taskId: "task-dispatch",
    traceSummary: {
      traceId: "trace-dispatch",
      correlationId: "task-dispatch",
      spanIds: [],
    },
    window: {
      startedAt: "2026-04-06T10:00:00.000Z",
      endedAt: "2026-04-06T10:00:01.000Z",
      durationMs: 1_000,
    },
    summary: {
      totalEntries: 1,
      eventCount: 0,
      dispatchCount: 1,
      stepOutputCount: 0,
      approvalCount: 0,
      artifactCount: 0,
      logCount: 0,
      remoteLogCount: 0,
      messageCount: 0,
      compactionCount: 0,
      highestSeverity: "warning",
    },
    warnings: {
      totalEvents: 0,
      totalUniqueWarnings: 0,
      suppressedDuplicateCount: 0,
      highestSeverity: "warning",
      escalationTargets: [],
      entries: [],
    },
    candidateRootCauses: [],
    entries: [
      {
        id: "dispatch-1",
        source: "dispatch",
        occurredAt: "2026-04-06T10:00:01.000Z",
        title: "dispatch:dispatched",
        summary: "Task dispatched to worker",
        severity: "warning",
        traceId: "trace-dispatch",
        spanId: null,
        parentSpanId: null,
        correlationId: "task-dispatch",
        data: { workerId: "worker-1" },
      },
    ],
  };

  const markdown = buildIncidentTimelineMarkdown(report);

  assert.match(markdown, /dispatches: 1/);
  assert.match(markdown, /\[dispatch\] \[warning\] dispatch:dispatched/);
});
