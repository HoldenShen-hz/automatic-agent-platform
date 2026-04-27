/**
 * Golden Test: Task Timeline Service Output Structure
 *
 * Verifies task timeline service produces consistent chronological
 * timeline entries for inspect and diagnostics.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { TaskTimelineService } from "../../src/platform/shared/observability/task-timeline-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: task timeline buildTaskTimeline has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-");

  const dbPath = `${workspace}/timeline.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const taskId = "timeline_task_001";
  const executionId = "timeline_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "timeline-trace" });

  const result = service.buildTaskTimeline(taskId);

  // Verify top-level structure
  assert.ok(result, "Result should exist");
  assert.ok(result.taskId === taskId, "Task ID should match");
  assert.ok(Array.isArray(result.entries), "Entries should be array");
  assert.ok(result.inspect, "Should have inspect");

  assertGolden("timeline-build-structure", {
    taskId: result.taskId,
    entryCount: result.entries.length,
    hasInspect: result.inspect !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline entries have correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-entry-");

  const dbPath = `${workspace}/timeline-entry.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const taskId = "timeline_entry_task_001";
  const executionId = "timeline_entry_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "entry-trace" });

  const result = service.buildTaskTimeline(taskId);

  // Verify entry structure for all entries
  for (const entry of result.entries) {
    assert.ok(entry.id, "Entry should have id");
    assert.ok(entry.kind, "Entry should have kind");
    assert.ok(["event", "step_output", "approval", "artifact", "dispatch", "remote_log"].includes(entry.kind), "Kind should be valid");
    assert.ok(entry.occurredAt, "Entry should have occurredAt");
    assert.ok(entry.title, "Entry should have title");
    assert.ok(entry.summary, "Entry should have summary");
    assert.ok(typeof entry.data === "object", "Entry data should be object");
  }

  assertGolden("timeline-entries-structure", {
    entryCount: result.entries.length,
    kinds: [...new Set(result.entries.map((e) => e.kind))],
    allHaveId: result.entries.every((e) => e.id.length > 0),
    allHaveOccurredAt: result.entries.every((e) => e.occurredAt.length > 0),
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline entries are sorted chronologically", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-sorted-");

  const dbPath = `${workspace}/timeline-sorted.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  // Create multiple tasks
  for (let i = 1; i <= 3; i++) {
    const taskId = `timeline_sorted_task_${String(i).padStart(3, "0")}`;
    const executionId = `timeline_sorted_exec_${String(i).padStart(3, "0")}`;
    seedTaskAndExecution(db, store, { taskId, executionId, traceId: `sorted-trace-${i}` });
  }

  const taskId = "timeline_sorted_task_001";
  const result = service.buildTaskTimeline(taskId);

  // Verify entries are sorted by occurredAt
  for (let i = 1; i < result.entries.length; i++) {
    const prev = result.entries[i - 1].occurredAt;
    const curr = result.entries[i].occurredAt;
    assert.ok(prev <= curr, `Entries should be sorted chronologically: ${prev} > ${curr}`);
  }

  assertGolden("timeline-sorted-entries", {
    entryCount: result.entries.length,
    isSorted: true,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task timeline inspect view is complete", () => {
  const workspace = createTempWorkspace("aa-golden-timeline-inspect-");

  const dbPath = `${workspace}/timeline-inspect.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const service = new TaskTimelineService(inspect);

  const taskId = "timeline_inspect_task_001";
  const executionId = "timeline_inspect_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "inspect-trace" });

  const result = service.buildTaskTimeline(taskId);
  const inspectView = result.inspect;

  // Verify inspect view has expected fields
  assert.ok(inspectView.task, "Inspect should have task");
  assert.ok(inspectView.execution !== undefined, "Inspect should have execution");
  assert.ok(inspectView.workflowState !== undefined, "Inspect should have workflowState");
  assert.ok(inspectView.session !== undefined, "Inspect should have session");
  assert.ok(inspectView.dispatchDecisions !== undefined, "Inspect should have dispatchDecisions");
  assert.ok(inspectView.recentEvents !== undefined, "Inspect should have recentEvents");
  assert.ok(inspectView.stepOutputs !== undefined, "Inspect should have stepOutputs");
  assert.ok(inspectView.artifacts !== undefined, "Inspect should have artifacts");

  assertGolden("timeline-inspect-view", {
    taskId: inspectView.task.id,
    hasExecution: inspectView.execution !== null,
    hasWorkflowState: inspectView.workflowState !== null,
    hasSession: inspectView.session !== null,
    dispatchDecisionCount: inspectView.dispatchDecisions.length,
    recentEventCount: inspectView.recentEvents.length,
    stepOutputCount: inspectView.stepOutputs.length,
    artifactCount: inspectView.artifacts.length,
  });

  db.close();
  cleanupPath(workspace);
});
