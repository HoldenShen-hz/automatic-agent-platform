import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EditReplacementService } from "../../../../src/platform/execution/tool-executor/edit-replacement-service.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

function createSecurityHarness(prefix: string): {
  workspace: string;
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  service: EditReplacementService;
} {
  const workspace = createTempWorkspace(prefix);
  const db = new SqliteDatabase(join(workspace, "edit-security.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new EditReplacementService(db, store);
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: "task-edit-security",
      parentId: null,
      rootId: "task-edit-security",
      divisionId: "general_ops",
      title: "Edit security test",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    store.insertExecution({
      id: "exec-edit-security",
      taskId: "task-edit-security",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "tool_call",
      status: "executing",
      inputRef: null,
      traceId: "trace-edit-security",
      attempt: 1,
      timeoutMs: 1000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(["edit_replace"]),
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { workspace, db, store, service };
}

test("edit replacement service blocks writes outside the workspace sandbox", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const outside = createTempWorkspace("aa-edit-outside-");

  try {
    const blockedPath = join(outside, "blocked.ts");
    createFile(blockedPath, "const blocked = true;\n");

    const result = harness.service.execute({
      callId: "security-call-1",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath: blockedPath,
      oldString: "const blocked = true;",
      newString: "const blocked = false;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.success, false);
    assert.match(result.output ?? "", /Edit replacement blocked:/);
    assert.equal(result.metadata.filePath, blockedPath);
    assert.equal(result.metadata.attemptCount, 0);
    assert.equal(result.error?.code, "sandbox.write_path_denied");
    assert.equal(readFileSync(blockedPath, "utf8"), "const blocked = true;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
    cleanupPath(outside);
  }
});

test("edit batch service blocks writes outside the workspace sandbox", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const outside = createTempWorkspace("aa-edit-batch-outside-");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit-security",
  );

  try {
    const blockedPath = join(outside, "blocked.ts");
    createFile(blockedPath, "const blocked = true;\n");

    const result = harness.service.executeBatch({
      callId: "security-batch-call-1",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath: blockedPath,
      edits: [
        {
          oldString: "const blocked = true;",
          newString: "const blocked = false;",
        },
      ],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "sandbox.write_path_denied");
    assert.equal(readFileSync(blockedPath, "utf8"), "const blocked = true;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
    cleanupPath(outside);
  }
});

test("edit replacement service blocks symlink escapes", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const outside = createTempWorkspace("aa-edit-symlink-target-");

  try {
    const actualFile = join(outside, "real.ts");
    const symlinkPath = join(harness.workspace, "linked.ts");
    createFile(actualFile, "const value = 1;\n");
    createSymlink(actualFile, symlinkPath);

    const result = harness.service.execute({
      callId: "security-call-2",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath: symlinkPath,
      oldString: "const value = 1;",
      newString: "const value = 2;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "sandbox.write_path_denied");
    assert.equal(readFileSync(actualFile, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
    cleanupPath(outside);
  }
});

test("edit replacement service rejects binary files and releases locks", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const filePath = join(harness.workspace, "binary.bin");

  try {
    createFile(filePath, "header\u0000payload");

    const result = harness.service.execute({
      callId: "security-call-3",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "header",
      newString: "updated",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.edit_binary_file_denied");
    assert.deepEqual(harness.store.listActiveFileLocksForResource(filePath, "2099-01-01T00:00:00.000Z"), []);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fails when another write lock is active", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const filePath = join(harness.workspace, "locked.ts");

  try {
    createFile(filePath, "const version = 1;\n");
    harness.store.insertFileLock({
      id: "lock-existing",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      lockScope: "workspace_path",
      resourcePath: realpathSync(filePath),
      lockMode: "write",
      ownerId: "someone-else",
      expiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });

    const result = harness.service.execute({
      callId: "security-call-4",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const version = 1;",
      newString: "const version = 2;",
    });

    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "tool.file_lock_conflict");
    assert.equal(readFileSync(filePath, "utf8"), "const version = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service blocks writes outside execution path scope even inside the sandbox", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const allowedDir = join(harness.workspace, "allowed");
  const blockedFile = join(harness.workspace, "blocked.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_paths_json = ? WHERE id = ?`).run(
    JSON.stringify([allowedDir]),
    "exec-edit-security",
  );

  try {
    createFile(join(allowedDir, "ok.ts"), "const ok = true;\n");
    createFile(blockedFile, "const blocked = true;\n");

    const result = harness.service.execute({
      callId: "security-call-5",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath: blockedFile,
      oldString: "const blocked = true;",
      newString: "const blocked = false;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.path_scope_write_denied");
    assert.equal(readFileSync(blockedFile, "utf8"), "const blocked = true;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service blocks execution-level tool permissions before sandbox-safe writes", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const filePath = join(harness.workspace, "tool-denied.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["read"]),
    "exec-edit-security",
  );

  try {
    createFile(filePath, "const blocked = true;\n");

    const result = harness.service.execute({
      callId: "security-call-6",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const blocked = true;",
      newString: "const blocked = false;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.tool_not_allowed");
    assert.equal(readFileSync(filePath, "utf8"), "const blocked = true;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit batch service blocks execution-level tool permissions before sandbox-safe writes", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const filePath = join(harness.workspace, "batch-tool-denied.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace"]),
    "exec-edit-security",
  );

  try {
    createFile(filePath, "const blocked = true;\n");

    const result = harness.service.executeBatch({
      callId: "security-batch-call-2",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const blocked = true;",
          newString: "const blocked = false;",
        },
      ],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.tool_not_allowed");
    assert.equal(readFileSync(filePath, "utf8"), "const blocked = true;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fail-closes malformed execution allowlists before sandbox-safe writes", () => {
  const harness = createSecurityHarness("aa-edit-security-");
  const filePath = join(harness.workspace, "invalid-allowlists.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ?, allowed_paths_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", 1]),
    JSON.stringify(["", 2]),
    "exec-edit-security",
  );

  try {
    createFile(filePath, "const blocked = true;\n");

    const result = harness.service.execute({
      callId: "security-call-7",
      taskId: "task-edit-security",
      executionId: "exec-edit-security",
      traceId: "trace-edit-security",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const blocked = true;",
      newString: "const blocked = false;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.execution_allowed_tools_invalid");
    assert.equal(readFileSync(filePath, "utf8"), "const blocked = true;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
