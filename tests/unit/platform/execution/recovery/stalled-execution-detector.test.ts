import assert from "node:assert/strict";
import test from "node:test";

import {
  StalledExecutionDetector,
  type StalledExecutionDetectionOptions,
  type StalledExecutionFinding,
} from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";

// Mock store for testing
function createMockStore(records: Array<{
  executionId: string;
  taskId: string;
  agentId: string;
  status: "created" | "prechecking" | "executing" | "blocked" | "completed" | "failed" | "cancelled";
  updatedAt: string;
  latestEventAt: string | null;
  latestHeartbeatAt: string | null;
}>) {
  return {
    operations: {
      listActiveExecutionActivity: () => records,
    },
  } as unknown as { operations: { listActiveExecutionActivity: () => typeof records } };
}

test("StalledExecutionDetector.detect returns empty array when no active executions", () => {
  const store = createMockStore([]);
  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect();

  assert.deepEqual(results, []);
});

test("StalledExecutionDetector.detect returns empty when executions are not stale", () => {
  const now = new Date().toISOString();
  const recent = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: recent,
    latestEventAt: recent,
    latestHeartbeatAt: now,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now, staleAfterMs: 5 * 60 * 1000 }); // 5 minute threshold

  assert.deepEqual(results, []);
});

test("StalledExecutionDetector.detect detects stale execution with missing heartbeat", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null, // No heartbeat
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now,
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
  assert.equal(results[0]!.staleKind, "missing_heartbeat");
  assert.equal(results[0]!.recommendedAction, "lease_reclaim");
});

test("StalledExecutionDetector.detect detects stale execution with no progress despite heartbeat", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
  const recentHeartbeat = new Date(Date.now() - 1 * 60 * 1000).toISOString(); // 1 minute ago

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: recentHeartbeat, // Has heartbeat but no progress
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now,
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
  assert.equal(results[0]!.staleKind, "no_progress");
  assert.equal(results[0]!.recommendedAction, "restart_or_escalate");
});

test("StalledExecutionDetector.detect uses maxIso to determine lastProgressAt", () => {
  const now = new Date().toISOString();
  const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const newerTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: oldTime,
    latestEventAt: newerTime, // latestEventAt is newer
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now,
    staleAfterMs: 3 * 60 * 1000, // 3 minute threshold
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  // lastProgressAt should be newerTime (maxIso picks the later time)
  assert.equal(results[0]!.lastProgressAt, newerTime);
});

test("StalledExecutionDetector.detect returns multiple findings", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([
    {
      executionId: "exec-1",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      updatedAt: staleTime,
      latestEventAt: staleTime,
      latestHeartbeatAt: null,
    },
    {
      executionId: "exec-2",
      taskId: "task-2",
      agentId: "agent-2",
      status: "prechecking",
      updatedAt: staleTime,
      latestEventAt: staleTime,
      latestHeartbeatAt: null,
    },
  ]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now, staleAfterMs: 5 * 60 * 1000 });

  assert.equal(results.length, 2);
});

test("StalledExecutionDetector.detect uses default options", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  // Call without options - should use defaults
  const results = detector.detect();

  assert.equal(results.length, 1);
  assert.equal(results[0]!.staleKind, "missing_heartbeat");
});

test("StalledExecutionDetector.isoMinusMs correctly calculates timestamps", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  // Threshold is 5 minutes
  // staleTime is 10 minutes ago
  // So staleTime < staleBefore (5 minutes ago), should be detected as stale
  const results = detector.detect({
    now,
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
});

test("StalledExecutionFinding has correct structure", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now });

  const finding = results[0]!;
  assert.ok("executionId" in finding);
  assert.ok("taskId" in finding);
  assert.ok("agentId" in finding);
  assert.ok("status" in finding);
  assert.ok("lastProgressAt" in finding);
  assert.ok("lastHeartbeatAt" in finding);
  assert.ok("staleKind" in finding);
  assert.ok("recommendedAction" in finding);
});

test("StalledExecutionDetectionOptions defaults", () => {
  const store = createMockStore([]);
  const detector = new StalledExecutionDetector(store as any);

  // Should not throw with empty options
  const results = detector.detect({});
  assert.deepEqual(results, []);
});

test("staleKind is one of the expected values", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now });

  const staleKind = results[0]!.staleKind;
  assert.ok(staleKind === "missing_heartbeat" || staleKind === "no_progress");
});

test("recommendedAction is one of the expected values", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now });

  const recommendedAction = results[0]!.recommendedAction;
  assert.ok(recommendedAction === "lease_reclaim" || recommendedAction === "restart_or_escalate");
});

test("StalledExecutionDetector.detect uses updatedAt when latestEventAt is null", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime,
    latestEventAt: null, // null latestEventAt
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now,
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  // lastProgressAt should be staleTime (updatedAt) since latestEventAt is null
  assert.equal(results[0]!.lastProgressAt, staleTime);
});

test("StalledExecutionDetector.detect handles heartbeat at exact boundary", () => {
  const now = new Date("2025-01-01T00:10:00.000Z");
  const heartbeatTime = new Date("2025-01-01T00:08:00.000Z"); // exactly 2 minutes ago (boundary)
  const staleTime = new Date("2025-01-01T00:05:00.000Z"); // 5 minutes ago

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime.toISOString(),
    latestEventAt: staleTime.toISOString(),
    latestHeartbeatAt: heartbeatTime.toISOString(),
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now: now.toISOString(),
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  // heartbeatTime is exactly at the boundary - staleBefore = now - 5min = 00:05
  // heartbeatMissingBefore = now - 2min = 00:08
  // heartbeatTime (00:08) > heartbeatMissingBefore (00:08)? No, equal, so NOT recent
  // Since heartbeat is not recent enough, this triggers missing_heartbeat
  assert.equal(results[0]!.staleKind, "missing_heartbeat");
});

test("StalledExecutionDetector.detect handles stale detection at exact threshold", () => {
  const now = new Date("2025-01-01T00:10:00.000Z");
  const staleTime = new Date("2025-01-01T00:05:00.001Z"); // just over 5 minutes ago

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime.toISOString(),
    latestEventAt: staleTime.toISOString(),
    latestHeartbeatAt: null,
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now: now.toISOString(),
    staleAfterMs: 5 * 60 * 1000, // 5 minutes
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  // staleTime (00:05:00.001) > staleBefore (00:05:00)? Yes, so NOT stale
  assert.equal(results.length, 0);
});

test("StalledExecutionDetector.detect filters out non-stale executions across multiple", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recentTime = new Date(Date.now() - 1 * 60 * 1000).toISOString();

  const store = createMockStore([
    {
      executionId: "exec-stale",
      taskId: "task-1",
      agentId: "agent-1",
      status: "executing",
      updatedAt: staleTime,
      latestEventAt: staleTime,
      latestHeartbeatAt: null,
    },
    {
      executionId: "exec-recent",
      taskId: "task-2",
      agentId: "agent-2",
      status: "executing",
      updatedAt: recentTime,
      latestEventAt: recentTime,
      latestHeartbeatAt: recentTime,
    },
    {
      executionId: "exec-stale-2",
      taskId: "task-3",
      agentId: "agent-3",
      status: "prechecking",
      updatedAt: staleTime,
      latestEventAt: staleTime,
      latestHeartbeatAt: null,
    },
  ]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now, staleAfterMs: 5 * 60 * 1000 });

  assert.equal(results.length, 2);
  assert.ok(results.some((r) => r.executionId === "exec-stale"));
  assert.ok(results.some((r) => r.executionId === "exec-stale-2"));
  assert.ok(!results.some((r) => r.executionId === "exec-recent"));
});

test("StalledExecutionDetector.detect handles all different status values", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const statuses = ["created", "prechecking", "executing", "blocked"] as const;

  const records = statuses.map((status, index) => ({
    executionId: `exec-${index}`,
    taskId: `task-${index}`,
    agentId: `agent-${index}`,
    status,
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }));

  const store = createMockStore(records);
  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({ now, staleAfterMs: 5 * 60 * 1000 });

  assert.equal(results.length, 4);
});

test("StalledExecutionFinding structure contains all required fields", () => {
  const finding: StalledExecutionFinding = {
    executionId: "exec-test",
    taskId: "task-test",
    agentId: "agent-test",
    status: "executing",
    lastProgressAt: "2025-01-01T00:00:00.000Z",
    lastHeartbeatAt: "2025-01-01T00:01:00.000Z",
    staleKind: "no_progress",
    recommendedAction: "restart_or_escalate",
  };

  assert.equal(finding.executionId, "exec-test");
  assert.equal(finding.taskId, "task-test");
  assert.equal(finding.agentId, "agent-test");
  assert.equal(finding.status, "executing");
  assert.equal(finding.lastProgressAt, "2025-01-01T00:00:00.000Z");
  assert.equal(finding.lastHeartbeatAt, "2025-01-01T00:01:00.000Z");
  assert.equal(finding.staleKind, "no_progress");
  assert.equal(finding.recommendedAction, "restart_or_escalate");
});

test("StalledExecutionDetectionOptions accepts partial options", () => {
  const store = createMockStore([]);
  const detector = new StalledExecutionDetector(store as any);

  // Each should work independently
  const results1 = detector.detect({ staleAfterMs: 1000 });
  assert.deepEqual(results1, []);

  const results2 = detector.detect({ heartbeatGraceMs: 500 });
  assert.deepEqual(results2, []);

  const results3 = detector.detect({ now: new Date().toISOString() });
  assert.deepEqual(results3, []);
});

test("isoMinusMs produces correct timestamps", () => {
  const store = createMockStore([]);
  const detector = new StalledExecutionDetector(store as any);

  // Test that the internal calculation works correctly by verifying behavior
  const now = "2025-01-01T12:00:00.000Z";
  const staleTime = "2025-01-01T11:50:00.000Z"; // 10 minutes before

  const mockRecords = [{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing" as const,
    updatedAt: staleTime,
    latestEventAt: staleTime,
    latestHeartbeatAt: null,
  }];

  const mockStore = createMockStore(mockRecords);
  const testDetector = new StalledExecutionDetector(mockStore as any);

  // With 5 minute stale threshold, staleTime (10 min ago) should be detected
  const results = testDetector.detect({ now, staleAfterMs: 5 * 60 * 1000 });

  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
});

test("StalledExecutionDetector handles heartbeat just inside grace period", () => {
  const now = new Date("2025-01-01T00:10:00.000Z");
  const heartbeatTime = new Date("2025-01-01T00:08:01.000Z"); // just inside 2 minute grace
  const staleTime = new Date("2025-01-01T00:05:00.000Z");

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime.toISOString(),
    latestEventAt: staleTime.toISOString(),
    latestHeartbeatAt: heartbeatTime.toISOString(),
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now: now.toISOString(),
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  // heartbeatTime (00:08:01) > heartbeatMissingBefore (00:08:00)? Yes, so recent
  assert.equal(results[0]!.staleKind, "no_progress");
  assert.equal(results[0]!.recommendedAction, "restart_or_escalate");
});

test("StalledExecutionDetector handles heartbeat just outside grace period", () => {
  const now = new Date("2025-01-01T00:10:00.000Z");
  const heartbeatTime = new Date("2025-01-01T00:07:59.000Z"); // just outside 2 minute grace
  const staleTime = new Date("2025-01-01T00:05:00.000Z");

  const store = createMockStore([{
    executionId: "exec-1",
    taskId: "task-1",
    agentId: "agent-1",
    status: "executing",
    updatedAt: staleTime.toISOString(),
    latestEventAt: staleTime.toISOString(),
    latestHeartbeatAt: heartbeatTime.toISOString(),
  }]);

  const detector = new StalledExecutionDetector(store as any);

  const results = detector.detect({
    now: now.toISOString(),
    staleAfterMs: 5 * 60 * 1000,
    heartbeatGraceMs: 2 * 60 * 1000,
  });

  assert.equal(results.length, 1);
  // heartbeatTime (00:07:59) > heartbeatMissingBefore (00:08:00)? No, so not recent
  assert.equal(results[0]!.staleKind, "missing_heartbeat");
  assert.equal(results[0]!.recommendedAction, "lease_reclaim");
});