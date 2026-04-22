import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { checkSandboxPath, createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { CodeDiagnosticsService } from "../../../../../src/platform/execution/tool-executor/code-diagnostics-service.js";
import { EditReplacementService } from "../../../../../src/platform/execution/tool-executor/edit-replacement-service.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string): {
  workspace: string;
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  service: EditReplacementService;
} {
  const workspace = createTempWorkspace(prefix);
  const db = new SqliteDatabase(join(workspace, "edit.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const diagnosticsService = new CodeDiagnosticsService({ workspaceRoot: workspace });
  const service = new EditReplacementService(db, store, diagnosticsService);
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: "task-edit",
      parentId: null,
      rootId: "task-edit",
      divisionId: "general_ops",
      title: "Edit replacement test",
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
      id: "exec-edit",
      taskId: "task-edit",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "tool_call",
      status: "executing",
      inputRef: null,
      traceId: "trace-edit",
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

function insertCompetingExecution(
  harness: ReturnType<typeof createHarness>,
  taskId: string,
  executionId: string,
  traceId: string,
): void {
  const now = nowIso();
  harness.db.transaction(() => {
    harness.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: `Competing execution ${executionId}`,
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
    harness.store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-2",
      roleId: "general_executor",
      runKind: "tool_call",
      status: "executing",
      inputRef: null,
      traceId,
      attempt: 1,
      timeoutMs: 1000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(["edit_replace", "edit_batch"]),
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
}

test("edit replacement service applies exact matches", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "demo.ts");

  try {
    createFile(filePath, "const answer = 1;\n");
    const result = await harness.service.execute({
      callId: "call-1",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const answer = 1;",
      newString: "const answer = 2;",
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    assert.equal(result.output?.startsWith("Applied edit at "), true);
    assert.equal(result.artifacts.length, 0);
    assert.equal(result.data.matchLevel, "exact");
    assert.equal(result.metadata.filePath, filePath);
    assert.equal(result.metadata.attemptCount, 1);
    assert.equal(result.metadata.diagnostics?.checkedFileCount, 1);
    assert.equal(result.metadata.diagnostics?.errorCount, 0);
    assert.equal(result.matchLevel, "exact");
    assert.equal(readFileSync(filePath, "utf8"), "const answer = 2;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service applies multiple edits atomically to the same file", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    createFile(filePath, ["const alpha = 1;", "const beta = 2;", ""].join("\n"));

    const result = await harness.service.executeBatch({
      callId: "call-batch-1",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const alpha = 1;",
          newString: "const alpha = 10;",
        },
        {
          oldString: "const beta = 2;",
          newString: "const beta = 20;",
        },
      ],
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    assert.equal(result.data.appliedEditCount, 2);
    assert.equal(result.data.rolledBack, false);
    assert.equal(result.metadata.editCount, 2);
    assert.equal(result.metadata.diagnostics?.checkedFileCount, 1);
    assert.equal(result.metadata.diagnostics?.errorCount, 0);
    assert.equal(result.edits[0]?.status, "applied");
    assert.equal(result.edits[1]?.status, "applied");
    assert.equal(readFileSync(filePath, "utf8"), ["const alpha = 10;", "const beta = 20;", ""].join("\n"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service surfaces diagnostics feedback after introducing a TypeScript error", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "diagnostics.ts");

  try {
    createFile(filePath, "const answer: string = \"ok\";\n");
    const result = await harness.service.execute({
      callId: "call-diagnostics",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const answer: string = \"ok\";",
      newString: "const answer: string = 1;",
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.output?.includes("Diagnostics:"), true);
    assert.equal(result.metadata.diagnostics?.checkedFileCount, 1);
    assert.equal((result.metadata.diagnostics?.errorCount ?? 0) >= 1, true);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service rolls back atomic multiedit when a later edit fails", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-rollback.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    createFile(filePath, ["const alpha = 1;", "const value = target;", "const value = target;", ""].join("\n"));

    const result = await harness.service.executeBatch({
      callId: "call-batch-rollback",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const alpha = 1;",
          newString: "const alpha = 2;",
        },
        {
          oldString: "const value = target;",
          newString: "const value = replacement;",
        },
      ],
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "tool.edit_multiple_candidates");
    assert.equal(result.data.rolledBack, true);
    assert.equal(result.edits[0]?.status, "applied");
    assert.equal(result.edits[1]?.status, "failed");
    assert.equal(readFileSync(filePath, "utf8"), ["const alpha = 1;", "const value = target;", "const value = target;", ""].join("\n"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service tolerates whitespace-only drift", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "whitespace.ts");

  try {
    createFile(filePath, "const total    =    value + 1;\n");
    const result = await harness.service.execute({
      callId: "call-2",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const total = value + 1;",
      newString: "const total = value + 2;",
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.matchLevel, "whitespace_normalized");
    assert.equal(readFileSync(filePath, "utf8"), "const total = value + 2;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service preserves current indentation when matching normalized blocks", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "indent.ts");

  try {
    createFile(
      filePath,
      [
        "function render() {",
        "    if (ready) {",
        "        console.log('old');",
        "    }",
        "}",
        "",
      ].join("\n"),
    );

    const result = await harness.service.execute({
      callId: "call-3",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: ["if (ready) {", "  console.log('old');", "}"].join("\n"),
      newString: ["if (ready) {", "  console.log('new');", "}"].join("\n"),
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.matchLevel, "indentation_normalized");
    const updatedLines = readFileSync(filePath, "utf8").split("\n");
    const consoleLine = updatedLines[2] ?? "";
    assert.equal(consoleLine.match(/^[ ]*/)?.[0].length, 8);
    assert.match(consoleLine, /console\.log\('new'\);/);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service applies anchored fuzzy edits with warnings", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "anchored.ts");

  try {
    createFile(
      filePath,
      [
        "function alpha() {",
        "  return { status: 'old', retries: 1 };",
        "}",
        "",
        "function beta() {",
        "  return { status: 'old', retries: 2 };",
        "}",
        "",
      ].join("\n"),
    );

    const result = await harness.service.execute({
      callId: "call-4",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "return { status: 'old', retry: 2 };",
      newString: "return { status: 'new', retries: 2 };",
      beforeAnchor: "function beta() {",
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.matchLevel, "context_anchored");
    assert.ok(result.warnings.includes("anchored_fuzzy_edit_applied"));
    assert.match(readFileSync(filePath, "utf8"), /function beta\(\) \{\n  return \{ status: 'new', retries: 2 \};/);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fails on ambiguous matches without guessing", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "ambiguous.ts");

  try {
    createFile(filePath, "const value = target;\nconst value = target;\n");
    const result = await harness.service.execute({
      callId: "call-5",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const value = target;",
      newString: "const value = replacement;",
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    assert.match(result.output ?? "", /Edit replacement failed:/);
    assert.equal(result.data.matchLevel, null);
    assert.ok(result.metadata.attemptCount >= 1);
    assert.equal(result.error?.code, "tool.edit_multiple_candidates");
    assert.equal(readFileSync(filePath, "utf8"), "const value = target;\nconst value = target;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service honors execution allowed path roots when provided by execution state", async () => {
  const harness = createHarness("aa-edit-unit-");
  const allowedDir = join(harness.workspace, "allowed");
  const blockedFile = join(harness.workspace, "blocked.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_paths_json = ? WHERE id = ?`).run(
    JSON.stringify([allowedDir]),
    "exec-edit",
  );

  try {
    createFile(join(allowedDir, "ok.ts"), "const ok = true;\n");
    createFile(blockedFile, "const blocked = true;\n");

    const result = await harness.service.execute({
      callId: "call-path-scope",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
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

test("edit replacement service blocks execution-scoped tool calls outside the allowed tool set", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "tool-denied.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["read"]),
    "exec-edit",
  );

  try {
    createFile(filePath, "const value = 1;\n");

    const result = await harness.service.execute({
      callId: "call-tool-denied",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const value = 1;",
      newString: "const value = 2;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.tool_not_allowed");
    assert.equal(readFileSync(filePath, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fail-closes when execution allowed tools contain malformed entries", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "invalid-tools.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", 1]),
    "exec-edit",
  );

  try {
    createFile(filePath, "const value = 1;\n");

    const result = await harness.service.execute({
      callId: "call-invalid-tools-json",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const value = 1;",
      newString: "const value = 2;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.execution_allowed_tools_invalid");
    assert.equal(readFileSync(filePath, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fails with lock conflict when another execution holds the lock", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "locked.ts");

  try {
    createFile(filePath, "const value = 1;\n");
    const normalizedFilePath = checkSandboxPath(
      createWorkspaceWritePolicy(harness.workspace),
      filePath,
    ).normalizedPath;

    // Insert a lock from a different owner
    const now = nowIso();
    const lockOwnerId = "other-execution-id";
    insertCompetingExecution(harness, "other-task", lockOwnerId, "trace-other-edit");
    harness.db.transaction(() => {
      harness.store.lock.insertFileLock({
        id: "existing-lock",
        taskId: "other-task",
        executionId: lockOwnerId,
        lockScope: "workspace_path",
        resourcePath: normalizedFilePath,
        lockMode: "write",
        ownerId: lockOwnerId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: now,
        updatedAt: now,
      });
    });

    const result = await harness.service.execute({
      callId: "call-lock-conflict",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const value = 1;",
      newString: "const value = 2;",
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "tool.file_lock_conflict");
    assert.match(result.output ?? "", /Write lock already held/);
    assert.equal(readFileSync(filePath, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service reports already_applied when file already contains newString", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "already.ts");

  try {
    // Create file with the newString already in place
    createFile(filePath, "const answer = 2;\n");

    const result = await harness.service.execute({
      callId: "call-already-applied",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const answer = 1;",
      newString: "const answer = 2;",
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    assert.ok(result.warnings.includes("edit_already_applied"));
    assert.ok(result.output?.includes("already applied"));
    // File content should remain unchanged
    assert.equal(readFileSync(filePath, "utf8"), "const answer = 2;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service rolls back all edits when a middle edit fails in batch", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-full-rollback.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    createFile(
      filePath,
      ["const alpha = 1;", "const beta = 2;", "const beta = 2;", "const gamma = 3;", ""].join("\n"),
    );

    const result = await harness.service.executeBatch({
      callId: "call-batch-full-rollback",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const alpha = 1;",
          newString: "const alpha = 10;",
        },
        {
          // This edit will fail because there are multiple matches.
          oldString: "const beta = 2;",
          newString: "const beta = 20;",
        },
        {
          oldString: "const gamma = 3;",
          newString: "const gamma = 30;",
        },
      ],
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    // rolledBack must be true - ALL edits including the first one are reverted
    assert.equal(result.data.rolledBack, true);
    assert.equal(result.edits[0]?.status, "applied");
    assert.equal(result.edits[1]?.status, "failed");
    // Third edit should not have been attempted
    assert.equal(result.edits.length, 2);
    // File content must be unchanged - all edits rolled back
    assert.equal(
      readFileSync(filePath, "utf8"),
      ["const alpha = 1;", "const beta = 2;", "const beta = 2;", "const gamma = 3;", ""].join("\n"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service handles empty edits array in batch", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-empty.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    createFile(filePath, "const value = 1;\n");

    const result = await harness.service.executeBatch({
      callId: "call-batch-empty",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [],
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "tool.edit_batch_empty");
    assert.match(result.output ?? "", /edits must not be empty/);
    // File content should remain unchanged
    assert.equal(readFileSync(filePath, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fail-closes when execution allowed paths contain malformed entries", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "invalid-paths.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_paths_json = ? WHERE id = ?`).run(
    JSON.stringify(["", 3]),
    "exec-edit",
  );

  try {
    createFile(filePath, "const value = 1;\n");

    const result = await harness.service.execute({
      callId: "call-invalid-paths-json",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_replace",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      oldString: "const value = 1;",
      newString: "const value = 2;",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.execution_allowed_paths_invalid");
    assert.equal(readFileSync(filePath, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service fails with lock conflict in batch mode when another execution holds the lock", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-locked.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    createFile(filePath, "const alpha = 1;\nconst beta = 2;\n");
    const normalizedFilePath = checkSandboxPath(
      createWorkspaceWritePolicy(harness.workspace),
      filePath,
    ).normalizedPath;

    // Insert a lock from a different owner before batch execution
    const now = nowIso();
    const lockOwnerId = "other-execution-for-batch";
    insertCompetingExecution(harness, "other-task-batch", lockOwnerId, "trace-other-batch");
    harness.db.transaction(() => {
      harness.store.lock.insertFileLock({
        id: "existing-batch-lock",
        taskId: "other-task-batch",
        executionId: lockOwnerId,
        lockScope: "workspace_path",
        resourcePath: normalizedFilePath,
        lockMode: "write",
        ownerId: lockOwnerId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: now,
        updatedAt: now,
      });
    });

    const result = await harness.service.executeBatch({
      callId: "call-batch-lock-conflict",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const alpha = 1;",
          newString: "const alpha = 10;",
        },
        {
          oldString: "const beta = 2;",
          newString: "const beta = 20;",
        },
      ],
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "tool.file_lock_conflict");
    assert.match(result.output ?? "", /Write lock already held/);
    // File content must remain unchanged
    assert.equal(readFileSync(filePath, "utf8"), "const alpha = 1;\nconst beta = 2;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service reports already_applied in batch mode when file already contains newString", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-already.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    // Create file where the second edit's newString is already present
    createFile(filePath, ["const alpha = 1;", "const beta = 20;", ""].join("\n"));

    const result = await harness.service.executeBatch({
      callId: "call-batch-already",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const alpha = 1;",
          newString: "const alpha = 10;",
        },
        {
          oldString: "const beta = 2;",
          newString: "const beta = 20;",
        },
      ],
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    // First edit should be applied
    assert.equal(result.edits[0]?.status, "applied");
    // Second edit should report already_applied since newString already exists
    assert.equal(result.edits[1]?.status, "already_applied");
    // File content should reflect the applied edit but not change the already-applied one
    assert.equal(readFileSync(filePath, "utf8"), ["const alpha = 10;", "const beta = 20;", ""].join("\n"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service rolls back all edits atomically when second edit fails in 3-edit batch", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-atomic-rollback.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    // Create file with unique strings for edits 1 and 3, but edit 2 has no match
    createFile(filePath, ["const alpha = 1;", "const gamma = 3;", ""].join("\n"));

    const result = await harness.service.executeBatch({
      callId: "call-batch-atomic-rollback",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [
        {
          oldString: "const alpha = 1;",
          newString: "const alpha = 10;",
        },
        {
          // This edit will fail because "const beta = 2;" does not exist in the file
          oldString: "const beta = 2;",
          newString: "const beta = 20;",
        },
        {
          oldString: "const gamma = 3;",
          newString: "const gamma = 30;",
        },
      ],
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    // rolledBack must be true - ALL edits including the first one are reverted
    assert.equal(result.data.rolledBack, true);
    // First edit was prepared before second failed
    assert.equal(result.edits[0]?.status, "applied");
    // Second edit failed during approximate matching; atomic rollback preserves the file.
    assert.equal(result.edits[1]?.status, "failed");
    assert.equal(result.edits[1]?.errorCode, "tool.edit_similarity_too_low");
    // Third edit was never attempted due to atomic rollback
    assert.equal(result.edits.length, 2);
    // File content must be completely unchanged - all edits rolled back atomically
    assert.equal(readFileSync(filePath, "utf8"), ["const alpha = 1;", "const gamma = 3;", ""].join("\n"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("edit replacement service handles empty edits array in batch gracefully", async () => {
  const harness = createHarness("aa-edit-unit-");
  const filePath = join(harness.workspace, "batch-truly-empty.ts");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["edit_replace", "edit_batch"]),
    "exec-edit",
  );

  try {
    createFile(filePath, "const value = 1;\n");

    const result = await harness.service.executeBatch({
      callId: "call-batch-truly-empty",
      taskId: "task-edit",
      executionId: "exec-edit",
      traceId: "trace-edit",
      toolName: "edit_batch",
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      filePath,
      edits: [],
    });

    assert.equal(result.status, "failed");
    assert.equal(result.success, false);
    assert.equal(result.error?.code, "tool.edit_batch_empty");
    assert.match(result.output ?? "", /edits must not be empty/);
    // No edits should be recorded
    assert.equal(result.edits.length, 0);
    // File content should remain unchanged
    assert.equal(readFileSync(filePath, "utf8"), "const value = 1;\n");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
