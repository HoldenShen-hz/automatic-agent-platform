import test from "node:test";
import assert from "node:assert/strict";
import { StalledExecutionDetector } from "../../../src/platform/five-plane-execution/recovery/stalled-execution-detector.js";
import type { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ExecutionStatus } from "../../../src/platform/contracts/types/status.js";

function makeMockStore(activeExecutions: Array<{
  executionId: string;
  taskId: string;
  agentId: string;
  status: ExecutionStatus;
  updatedAt: string;
  latestEventAt?: string | null;
  latestHeartbeatAt?: string | null;
}>) {
  return {
    operations: {
      listActiveExecutionActivity: () => activeExecutions.map(e => ({
        executionId: e.executionId,
        taskId: e.taskId,
        agentId: e.agentId,
        status: e.status,
        updatedAt: e.updatedAt,
        latestEventAt: e.latestEventAt ?? null,
        latestHeartbeatAt: e.latestHeartbeatAt ?? null,
      })),
    },
  } as unknown as AuthoritativeTaskStore;
}

test("detect returns empty when all executions are active", () => {
  const now = new Date().toISOString();
  const store = makeMockStore([
    {
      executionId: "exec_1",
      taskId: "task_1",
      agentId: "agent_a",
      status: "executing",
      updatedAt: now,
      latestHeartbeatAt: now,
    },
  ]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect({ now, staleAfterMs: 60_000, heartbeatGraceMs: 30_000 });
  assert.deepEqual(findings, []);
});

test("detect finds execution with no progress within stale threshold", () => {
  const now = "2024-01-01T12:00:00.000Z";
  const staleAfterMs = 5 * 60 * 1000; // 5 minutes
  const heartbeatGraceMs = 30_000;
  const store = makeMockStore([
    {
      executionId: "exec_stale",
      taskId: "task_1",
      agentId: "agent_a",
      status: "executing",
      updatedAt: "2024-01-01T11:50:00.000Z", // 10 minutes ago (stale)
      latestEventAt: null,
      latestHeartbeatAt: "2024-01-01T11:50:00.000Z", // also 10 min ago (> grace), so no heartbeat
    },
  ]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect({ now, staleAfterMs, heartbeatGraceMs });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.executionId, "exec_stale");
  assert.equal(findings[0]!.staleKind, "missing_heartbeat"); // heartbeat is old (> grace)
  assert.equal(findings[0]!.recommendedAction, "lease_reclaim");
});

test("detect finds execution with missing heartbeat within grace period", () => {
  const now = "2024-01-01T12:00:00.000Z";
  const staleAfterMs = 5 * 60 * 1000;
  const heartbeatGraceMs = 2 * 60 * 1000; // 2 minutes
  const store = makeMockStore([
    {
      executionId: "exec_nohb",
      taskId: "task_1",
      agentId: "agent_a",
      status: "executing",
      updatedAt: "2024-01-01T11:50:00.000Z", // 10 minutes ago (stale)
      latestEventAt: "2024-01-01T11:50:00.000Z",
      latestHeartbeatAt: "2024-01-01T11:57:00.000Z", // 3 minutes ago (> grace period)
    },
  ]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect({ now, staleAfterMs, heartbeatGraceMs });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.staleKind, "missing_heartbeat");
  assert.equal(findings[0]!.recommendedAction, "lease_reclaim");
});

test("detect uses latestEventAt when more recent than updatedAt", () => {
  const now = "2024-01-01T12:00:00.000Z";
  const staleAfterMs = 5 * 60 * 1000;
  const store = makeMockStore([
    {
      executionId: "exec_recent_event",
      taskId: "task_1",
      agentId: "agent_a",
      status: "executing",
      updatedAt: "2024-01-01T11:50:00.000Z", // stale by updatedAt
      latestEventAt: "2024-01-01T11:59:00.000Z", // but recent event at 11:59
      latestHeartbeatAt: "2024-01-01T11:59:00.000Z",
    },
  ]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect({ now, staleAfterMs, heartbeatGraceMs: 30_000 });
  assert.deepEqual(findings, []); // not stale because latestEventAt is recent
});

test("detect handles null latestHeartbeatAt as missing", () => {
  const now = "2024-01-01T12:00:00.000Z";
  const staleAfterMs = 5 * 60 * 1000;
  const heartbeatGraceMs = 30_000;
  const store = makeMockStore([
    {
      executionId: "exec_null_hb",
      taskId: "task_1",
      agentId: "agent_a",
      status: "executing",
      updatedAt: "2024-01-01T11:50:00.000Z",
      latestEventAt: "2024-01-01T11:50:00.000Z",
      latestHeartbeatAt: null,
    },
  ]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect({ now, staleAfterMs, heartbeatGraceMs });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.staleKind, "missing_heartbeat");
  assert.equal(findings[0]!.recommendedAction, "lease_reclaim");
});

test("detect returns empty array when no active executions", () => {
  const store = makeMockStore([]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect();
  assert.deepEqual(findings, []);
});

test("detect respects custom staleAfterMs", () => {
  const now = "2024-01-01T12:00:00.000Z";
  const staleAfterMs = 10 * 60 * 1000; // 10 minutes
  const store = makeMockStore([
    {
      executionId: "exec_9min",
      taskId: "task_1",
      agentId: "agent_a",
      status: "executing",
      updatedAt: "2024-01-01T11:52:00.000Z", // 8 minutes ago
      latestEventAt: "2024-01-01T11:52:00.000Z",
      latestHeartbeatAt: "2024-01-01T11:52:00.000Z",
    },
  ]);
  const detector = new StalledExecutionDetector(store);
  const findings = detector.detect({ now, staleAfterMs });
  assert.deepEqual(findings, []); // not stale with 10min threshold
});
