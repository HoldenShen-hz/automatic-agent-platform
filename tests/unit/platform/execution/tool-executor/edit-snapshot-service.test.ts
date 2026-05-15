import assert from "node:assert/strict";
import test from "node:test";

import {
  EditSnapshotService,
  EditSnapshotManager,
} from "../../../../../src/platform/five-plane-execution/tool-executor/edit-snapshot-service.js";

test("EditSnapshotService records edits", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old content",
    newContent: "new content",
  });

  const history = service.getHistory("step-1");
  assert.equal(history.length, 1);
  assert.equal(history[0]!.previousContent, "old content");
  assert.equal(history[0]!.newContent, "new content");
});

test("EditSnapshotService records multiple edits per step", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file1.ts",
    previousContent: "",
    newContent: "content 1",
  });

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file2.ts",
    previousContent: "",
    newContent: "content 2",
  });

  const history = service.getHistory("step-1");
  assert.equal(history.length, 2);
});

test("EditSnapshotService.getPreviousContent returns correct content", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old content",
    newContent: "new content",
  });

  const previous = service.getPreviousContent("step-1", "/path/to/file.ts");
  assert.equal(previous, "old content");
});

test("EditSnapshotService.getPreviousContent returns null for non-existent step", () => {
  const service = new EditSnapshotService("session-1");

  const previous = service.getPreviousContent("non-existent", "/path/to/file.ts");
  assert.equal(previous, null);
});

test("EditSnapshotService.undo moves edit to redo stack", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old content",
    newContent: "new content",
  });

  const undone = service.undo("step-1");
  assert.ok(undone);
  assert.equal(undone.previousContent, "old content");

  const state = service.getState("step-1");
  assert.equal(state.canUndo, false);
  assert.equal(state.canRedo, true);
});

test("EditSnapshotService.redo restores edit from redo stack", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old content",
    newContent: "new content",
  });

  service.undo("step-1");
  const redone = service.redo("step-1");

  assert.ok(redone);
  assert.equal(redone.newContent, "new content");

  const state = service.getState("step-1");
  assert.equal(state.canUndo, true);
  assert.equal(state.canRedo, false);
});

test("EditSnapshotService.undo returns null when nothing to undo", () => {
  const service = new EditSnapshotService("session-1");

  const undone = service.undo("step-1");
  assert.equal(undone, null);
});

test("EditSnapshotService.redo returns null when nothing to redo", () => {
  const service = new EditSnapshotService("session-1");

  const redone = service.redo("step-1");
  assert.equal(redone, null);
});

test("EditSnapshotService.clearHistory removes all history for a step", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old",
    newContent: "new",
  });

  service.clearHistory("step-1");

  const state = service.getState("step-1");
  assert.equal(state.canUndo, false);
  assert.equal(state.canRedo, false);
});

test("EditSnapshotService.clearAll removes all history", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file1.ts",
    previousContent: "old",
    newContent: "new",
  });

  service.recordEdit({
    stepId: "step-2",
    filePath: "/path/to/file2.ts",
    previousContent: "old",
    newContent: "new",
  });

  service.clearAll();

  const state1 = service.getState("step-1");
  const state2 = service.getState("step-2");
  assert.equal(state1.canUndo, false);
  assert.equal(state2.canUndo, false);
});

test("EditSnapshotService.getUndoContent returns content that would be restored", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old content",
    newContent: "new content",
  });

  const undoContent = service.getUndoContent("step-1", "/path/to/file.ts");
  assert.equal(undoContent, "old content");
});

test("EditSnapshotService.getRedoContent returns content that would be restored", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "old content",
    newContent: "new content",
  });

  service.undo("step-1");

  const redoContent = service.getRedoContent("step-1", "/path/to/file.ts");
  assert.equal(redoContent, "new content");
});

test("EditSnapshotManager.getService creates new service for new session", () => {
  const manager = new EditSnapshotManager();

  const service1 = manager.getService("session-1");
  const service2 = manager.getService("session-2");

  assert.notEqual(service1, service2);
  assert.equal(service1.getSessionId(), "session-1");
  assert.equal(service2.getSessionId(), "session-2");
});

test("EditSnapshotManager.getService returns same service for same session", () => {
  const manager = new EditSnapshotManager();

  const service1 = manager.getService("session-1");
  const service2 = manager.getService("session-1");

  assert.equal(service1, service2);
});

test("EditSnapshotManager.removeService removes service", () => {
  const manager = new EditSnapshotManager();

  manager.getService("session-1");
  manager.removeService("session-1");

  // Getting a new service should create a fresh one
  const service = manager.getService("session-1");
  const state = service.getState("step-1");
  assert.equal(state.canUndo, false);
});

test("EditSnapshotService records multiple edits to same file in step", () => {
  const service = new EditSnapshotService("session-1");

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "v1",
    newContent: "v2",
  });

  service.recordEdit({
    stepId: "step-1",
    filePath: "/path/to/file.ts",
    previousContent: "v2",
    newContent: "v3",
  });

  // Should get the immediate previous content (v2), not the original (v1)
  const previous = service.getPreviousContent("step-1", "/path/to/file.ts");
  assert.equal(previous, "v2");

  // Undo should restore v2, not v1
  const undone = service.undo("step-1");
  assert.equal(undone!.previousContent, "v2");
  assert.equal(undone!.newContent, "v3");
});
