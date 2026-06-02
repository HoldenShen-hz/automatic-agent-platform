/**
 * Golden Test: Task Timeline Service Output
 *
 * Verifies task timeline aggregation produces consistent entry structures
 * for events, step outputs, approvals, artifacts, and dispatch decisions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TaskTimelineService } from "../../src/platform/shared/observability/task-timeline-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { nowIso } from "../../src/platform/contracts/types/ids.js";

test("golden: task timeline service builds timeline structure", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-");

  const dbPath = `${workspace}/timeline.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "timeline_task_001";
  const executionId = "timeline_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "timeline-trace" });

  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const result = service.buildTaskTimeline(taskId);

  // Verify structure
  assert.ok(result, "Timeline result should exist");
  assert.equal(result.taskId, taskId);
  assert.ok(Array.isArray(result.entries), "Entries should be array");
  assert.ok(result.inspect, "Inspect view should be attached");

  assertGolden("timeline-build-structure", {
    taskId: result.taskId,
    entryCount: result.entries.length,
    hasInspect: result.inspect !== null,
    entryKinds: [...new Set(result.entries.map((e) => e.kind))],
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline entries have valid structure", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-entries-");

  const dbPath = `${workspace}/timeline-entries.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "timeline_entries_task_001";
  const executionId = "timeline_entries_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "entries-trace" });

  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const result = service.buildTaskTimeline(taskId);

  // Each entry should have required fields
  for (const entry of result.entries) {
    assert.ok(entry.id, "Entry should have ID");
    assert.ok(entry.kind, "Entry should have kind");
    assert.ok(entry.occurredAt, "Entry should have occurredAt");
    assert.ok(entry.title, "Entry should have title");
    assert.ok(entry.summary, "Entry should have summary");
    assert.ok(entry.data, "Entry should have data");
    assert.ok(["event", "step_output", "approval", "artifact", "dispatch", "remote_log"].includes(entry.kind),
      `Entry kind should be valid, got ${entry.kind}`);
  }

  assertGolden("timeline-entries-validation", {
    totalEntries: result.entries.length,
    allHaveId: result.entries.every((e) => e.id.length > 0),
    allHaveOccurredAt: result.entries.every((e) => e.occurredAt.length > 0),
    kinds: result.entries.map((e) => e.kind),
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline entries are chronologically sorted", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-sorted-");

  const dbPath = `${workspace}/timeline-sorted.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "timeline_sorted_task_001";
  const executionId = "timeline_sorted_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "sorted-trace" });

  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const result = service.buildTaskTimeline(taskId);

  // Verify entries are sorted by occurredAt
  for (let i = 0; i < result.entries.length - 1; i++) {
    const current = new Date(result.entries[i].occurredAt).getTime();
    const next = new Date(result.entries[i + 1].occurredAt).getTime();
    assert.ok(current <= next, `Entry ${i} should have occurredAt <= entry ${i + 1}`);
  }

  assertGolden("timeline-chronological-order", {
    entryCount: result.entries.length,
    isSorted: true,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline with workflow state includes step entries", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-wf-");

  const dbPath = `${workspace}/timeline-wf.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "timeline_wf_task_001";
  const executionId = "timeline_wf_exec_001";
  const now = nowIso();

  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "wf-trace" });

  // Add workflow state
  db.transaction(() => {
    store.insertWorkflowState({
      taskId,
      divisionId: "general-ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
  });

  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const result = service.buildTaskTimeline(taskId);

  assert.ok(result.inspect.workflowState, "Should have workflow state in inspect");
  assertGolden("timeline-with-workflow", {
    taskId: result.taskId,
    hasWorkflowState: result.inspect.workflowState !== null,
    entryCount: result.entries.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline dispatch entries have correct data", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-dispatch-");

  const dbPath = `${workspace}/timeline-dispatch.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "timeline_dispatch_task_001";
  const executionId = "timeline_dispatch_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "dispatch-timeline-trace" });

  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const result = service.buildTaskTimeline(taskId);

  const dispatchEntries = result.entries.filter((e) => e.kind === "dispatch");

  // Dispatch entries should have dispatch-specific data fields
  for (const entry of dispatchEntries) {
    assert.ok(entry.data, "Dispatch entry should have data");
    assert.ok(entry.data.queueName !== undefined, "Should have queueName");
    assert.ok(entry.data.dispatchTarget !== undefined, "Should have dispatchTarget");
  }

  assertGolden("timeline-dispatch-entries", {
    dispatchCount: dispatchEntries.length,
    hasDispatchData: dispatchEntries.every((e) => e.data?.queueName !== undefined),
  });

  db.close();
  cleanupPath(workspace);
});
