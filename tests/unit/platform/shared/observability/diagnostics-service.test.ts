import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosticWarningSummary, selectRemoteTimelineEntries } from "../../../../../src/platform/shared/observability/diagnostics-service.js";

test("buildDiagnosticWarningSummary aggregates duplicate warnings and preserves escalation metadata", () => {
  const summary = buildDiagnosticWarningSummary([
    "remote_authority:remote_session_resume_offset_missing",
    "remote_authority:remote_session_resume_offset_missing",
    "dispatch:blocked",
  ]);

  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.totalUniqueWarnings, 2);
  assert.equal(summary.suppressedDuplicateCount, 1);
  assert.equal(summary.highestSeverity, "critical");
  assert.deepEqual(summary.escalationTargets, ["operator", "task"]);
  assert.deepEqual(summary.entries, [
    {
      code: "remote_authority:remote_session_resume_offset_missing",
      category: "remote_authority",
      severity: "critical",
      escalation: "operator",
      count: 2,
      suppressedCount: 1,
    },
    {
      code: "dispatch:blocked",
      category: "dispatch",
      severity: "warning",
      escalation: "task",
      count: 1,
      suppressedCount: 0,
    },
  ]);
});

test("buildDiagnosticWarningSummary returns an empty info summary when no warnings are present", () => {
  const summary = buildDiagnosticWarningSummary([]);

  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.totalUniqueWarnings, 0);
  assert.equal(summary.suppressedDuplicateCount, 0);
  assert.equal(summary.highestSeverity, "info");
  assert.deepEqual(summary.escalationTargets, []);
  assert.deepEqual(summary.entries, []);
});

test("selectRemoteTimelineEntries keeps remote logs and remote-routing events while excluding unrelated local artifacts", () => {
  const entries = selectRemoteTimelineEntries([
    {
      id: "remote-log",
      source: "remote_log",
      occurredAt: "2026-04-06T12:00:00.000Z",
      title: "remote_log:error",
      summary: "remote worker crashed",
      severity: "critical",
      correlationId: "task-remote",
      data: {
        workerId: "worker-remote-1",
        level: "error",
      },
    },
    {
      id: "dispatch-remote",
      source: "dispatch",
      occurredAt: "2026-04-06T12:00:01.000Z",
      title: "dispatch:dispatched",
      summary: "Dispatch routed to worker-remote-1 (remote)",
      severity: "info",
      status: "dispatched",
      correlationId: "task-remote",
      data: {
        dispatchTarget: "prefer_remote",
        selectedWorkerId: "worker-remote-1",
        selectedWorkerPlacement: "remote",
        remoteAvailability: "healthy",
      },
    },
    {
      id: "artifact-local",
      source: "artifact",
      occurredAt: "2026-04-06T12:00:02.000Z",
      title: "artifact:report",
      summary: "local artifact",
      severity: "info",
      correlationId: "task-remote",
      data: {},
    },
  ]);

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.id), ["remote-log", "dispatch-remote"]);
});
