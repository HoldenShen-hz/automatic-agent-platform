import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { CommandExecutor } from "../../../../../src/platform/execution/tool-executor/command-executor.js";
import { CommandSafetyClassifier, createDefaultCommandPolicies } from "../../../../../src/platform/execution/tool-executor/command-security.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

function createCommandHarness(prefix: string): {
  workspace: string;
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  executor: CommandExecutor;
} {
  const workspace = createTempWorkspace(prefix);
  const db = new SqliteDatabase(join(workspace, "command.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const executor = new CommandExecutor({ store });
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: "task-command",
      parentId: null,
      rootId: "task-command",
      divisionId: "general_ops",
      title: "Command executor test",
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
      id: "exec-command",
      taskId: "task-command",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-command",
      roleId: "general_executor",
      runKind: "tool_call",
      status: "executing",
      inputRef: null,
      traceId: "trace-command",
      attempt: 1,
      timeoutMs: 1000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(["command_exec"]),
      allowedPathsJson: JSON.stringify([]),
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

  return { workspace, db, store, executor };
}

test("command executor blocks inline code execution", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-1",
      taskId: "task-1",
      agentId: "agent-1",
      traceId: "trace-1",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "node",
      args: ["-e", "console.log('x')"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.inline_code_denied");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor respects timeout", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-2",
      taskId: "task-2",
      agentId: "agent-2",
      traceId: "trace-2",
      toolName: "command_exec",
      timeoutMs: 50,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "sleep",
      args: ["2"],
      cwd: workspace,
    });

    assert.equal(result.status, "timed_out");
    assert.equal(result.error?.code, "tool.timeout");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor succeeds for safe command inside workspace", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-3",
      taskId: "task-3",
      agentId: "agent-3",
      traceId: "trace-3",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "pwd",
      args: [],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    assert.equal(result.metadata.command, "pwd");
    assert.equal(result.metadata.cwd, workspace);
    assert.equal(result.data.truncated, false);
    assert.equal(result.data.rawRef, null);
    assert.equal(result.output.sanitizedText.trim().startsWith("/"), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor enforces process slot saturation and recovers after slots are released", async () => {
  const workspace = createTempWorkspace("aa-command-");
  const runtimeState = CommandExecutor as unknown as {
    activeProcessCount: number;
    MAX_CONCURRENT_PROCESSES: number;
  };
  const originalCount = runtimeState.activeProcessCount;

  try {
    const executor = new CommandExecutor();

    runtimeState.activeProcessCount = runtimeState.MAX_CONCURRENT_PROCESSES;
    const blocked = await executor.execute({
      callId: "call-process-limit",
      taskId: "task-process-limit",
      agentId: "agent-process-limit",
      traceId: "trace-process-limit",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "pwd",
      args: [],
      cwd: workspace,
    });

    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.error?.code, "tool.process_limit_exceeded");

    runtimeState.activeProcessCount = 0;
    const succeeded = await executor.execute({
      callId: "call-process-limit-recovered",
      taskId: "task-process-limit-recovered",
      agentId: "agent-process-limit-recovered",
      traceId: "trace-process-limit-recovered",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "pwd",
      args: [],
      cwd: workspace,
    });

    assert.equal(succeeded.status, "succeeded");
  } finally {
    runtimeState.activeProcessCount = originalCount;
    cleanupPath(workspace);
  }
});

test("command executor falls back to tool metadata timeout when the request omits one", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-default-timeout",
      taskId: "task-default-timeout",
      agentId: "agent-default-timeout",
      traceId: "trace-default-timeout",
      toolName: "command_exec",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "pwd",
      args: [],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    assert.equal(result.error, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor blocks declared writes outside the execution path scope allowlist", async () => {
  const workspace = createTempWorkspace("aa-command-");
  const scopedDir = join(workspace, "scoped");
  const outsideScopedPath = join(workspace, "outside.txt");

  try {
    createFile(join(scopedDir, "keep.txt"), "ok\n");
    createFile(outsideScopedPath, "outside\n");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-path-scope-write",
      taskId: "task-path-scope-write",
      agentId: "agent-path-scope-write",
      traceId: "trace-path-scope-write",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      allowedPathRoots: [scopedDir],
      command: "pwd",
      args: [],
      cwd: scopedDir,
      declaredWritePaths: [outsideScopedPath],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.path_scope_write_denied");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor blocks execution-scoped tool calls outside the allowed tool set", async () => {
  const harness = createCommandHarness("aa-command-auth-");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["read"]),
    "exec-command",
  );

  try {
    const result = await harness.executor.execute({
      callId: "call-tool-denied",
      taskId: "task-command",
      executionId: "exec-command",
      agentId: "agent-command",
      traceId: "trace-command",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      command: "pwd",
      args: [],
      cwd: harness.workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.tool_not_allowed");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("command executor honors execution path roots when the request omits an explicit allowlist", async () => {
  const harness = createCommandHarness("aa-command-auth-");
  const scopedDir = join(harness.workspace, "scoped");
  const outsideScopedPath = join(harness.workspace, "outside.txt");

  harness.db.connection.prepare(`UPDATE executions SET allowed_paths_json = ? WHERE id = ?`).run(
    JSON.stringify([scopedDir]),
    "exec-command",
  );

  try {
    createFile(join(scopedDir, "keep.txt"), "ok\n");
    createFile(outsideScopedPath, "outside\n");

    const result = await harness.executor.execute({
      callId: "call-path-from-execution",
      taskId: "task-command",
      executionId: "exec-command",
      agentId: "agent-command",
      traceId: "trace-command",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      command: "pwd",
      args: [],
      cwd: scopedDir,
      declaredWritePaths: [outsideScopedPath],
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.path_scope_write_denied");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("command executor fail-closes when execution allowed tools contain malformed entries", async () => {
  const harness = createCommandHarness("aa-command-auth-");

  harness.db.connection.prepare(`UPDATE executions SET allowed_tools_json = ? WHERE id = ?`).run(
    JSON.stringify(["command_exec", 1]),
    "exec-command",
  );

  try {
    const result = await harness.executor.execute({
      callId: "call-invalid-tools-json",
      taskId: "task-command",
      executionId: "exec-command",
      agentId: "agent-command",
      traceId: "trace-command",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      command: "pwd",
      args: [],
      cwd: harness.workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.execution_allowed_tools_invalid");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("command executor fail-closes when execution allowed paths contain malformed entries", async () => {
  const harness = createCommandHarness("aa-command-auth-");

  harness.db.connection.prepare(`UPDATE executions SET allowed_paths_json = ? WHERE id = ?`).run(
    JSON.stringify(["", 7]),
    "exec-command",
  );

  try {
    const result = await harness.executor.execute({
      callId: "call-invalid-paths-json",
      taskId: "task-command",
      executionId: "exec-command",
      agentId: "agent-command",
      traceId: "trace-command",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      command: "pwd",
      args: [],
      cwd: harness.workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.execution_allowed_paths_invalid");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("command executor exposes a stable tool call envelope for blocked executions", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-envelope-blocked",
      taskId: "task-envelope-blocked",
      agentId: "agent-envelope-blocked",
      traceId: "trace-envelope-blocked",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "node",
      args: ["-e", "console.log('blocked')"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.success, false);
    assert.equal(result.durationMs, 0);
    assert.equal(result.error?.source, "security");
    assert.equal(result.metadata.artifactCount, 0);
    assert.equal(result.metadata.command, "node");
    assert.match(result.output.sanitizedText, /Command blocked by sandbox or command policy/);
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor propagates cancellation to the child process", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const controller = new AbortController();
    const execution = executor.execute(
      {
        callId: "call-4",
        taskId: "task-4",
        agentId: "agent-4",
        traceId: "trace-4",
        toolName: "command_exec",
        timeoutMs: 1000,
        sandboxPolicy: createWorkspaceWritePolicy(workspace),
        command: "sleep",
        args: ["2"],
        cwd: workspace,
      },
      controller.signal,
    );

    setTimeout(() => controller.abort(), 10);
    const result = await execution;

    assert.equal(result.status, "cancelled");
    assert.equal(result.error?.code, "tool.cancelled");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor blocks shell meta syntax in arguments", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-5",
      taskId: "task-5",
      agentId: "agent-5",
      traceId: "trace-5",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["$(whoami)"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.command_meta_syntax_denied");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor blocks invalid command arity for signed commands", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-arity",
      taskId: "task-arity",
      agentId: "agent-arity",
      traceId: "trace-arity",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "pwd",
      args: ["unexpected"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.command_arity_denied");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor blocks unknown commands before spawning a process", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-6",
      taskId: "task-6",
      agentId: "agent-6",
      traceId: "trace-6",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "nonexistent-safe-looking-command",
      args: [],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "tool.command_unknown_denied");
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor blocks interpreter flags that bypass script-file mode", async () => {
  const workspace = createTempWorkspace("aa-command-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-interpreter-flag",
      taskId: "task-interpreter-flag",
      agentId: "agent-interpreter-flag",
      traceId: "trace-interpreter-flag",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "bash",
      args: ["-lc", "pwd"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.ok(
      result.error?.code === "tool.command_interpreter_flag_denied"
      || result.error?.code === "sandbox.command_arg_path_denied",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor allows interpreter script-file mode inside the sandbox", async () => {
  const workspace = createTempWorkspace("aa-command-");
  const scriptPath = join(workspace, "script.js");

  try {
    createFile(scriptPath, "console.log('sandbox-script-ok');\n");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-script",
      taskId: "task-script",
      agentId: "agent-script",
      traceId: "trace-script",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "node",
      args: [scriptPath],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
    assert.match(result.output.sanitizedText, /sandbox-script-ok/);
  } finally {
    cleanupPath(workspace);
  }
});

test("command safety classifier keeps a cached restrictive unknown-command decision until ttl expiry", () => {
  let now = 1_000;
  const policies = createDefaultCommandPolicies();
  const classifier = new CommandSafetyClassifier({
    ttlMs: 50,
    now: () => now,
    policies,
  });

  const first = classifier.assess("custom-safe-tool", []);
  assert.equal(first.allowed, false);
  assert.equal(first.reasonCode, "tool.command_unknown_denied");

  policies.set("custom-safe-tool", { allowed: true, riskLevel: "low" });

  const second = classifier.assess("custom-safe-tool", []);
  assert.equal(second.allowed, false);
  assert.equal(second.reasonCode, "tool.command_unknown_denied");

  now += 51;

  const third = classifier.assess("custom-safe-tool", []);
  assert.equal(third.allowed, true);
  assert.equal(third.riskLevel, "low");
});

test("command executor externalizes oversized sanitized output into an artifact and keeps a truncated message", async () => {
  const workspace = createTempWorkspace("aa-command-");
  const scriptPath = join(workspace, "large-output.js");

  try {
    createFile(
      scriptPath,
      [
        "const payload = 'L'.repeat(7000);",
        "process.stdout.write(payload);",
      ].join("\n"),
    );

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-large-output",
      taskId: "task-large-output",
      agentId: "agent-large-output",
      traceId: "trace-large-output",
      toolName: "command_exec",
      timeoutMs: 5000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "node",
      args: [scriptPath],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.output.truncated, true);
    assert.equal(result.output.rawRef, result.artifacts[0]);
    assert.equal(result.artifacts.length, 1);
    assert.ok(result.output.warnings.includes("output_externalized"));
    assert.ok(existsSync(result.artifacts[0] ?? ""));

    const persistedOutput = readFileSync(result.artifacts[0]!, "utf8");
    assert.equal(persistedOutput.length, 7000);
    assert.equal(persistedOutput, "L".repeat(7000));
    assert.match(result.output.sanitizedText, /\.\.\.\[TRUNCATED\]\.\.\./);
  } finally {
    cleanupPath(workspace);
  }
});

test("command executor externalizes redacted oversized output without persisting raw secrets", async () => {
  const workspace = createTempWorkspace("aa-command-");
  const scriptPath = join(workspace, "large-secret-output.js");
  const secret = "sk-abcdefghijklmnopqrstuvwxyz123456";

  try {
    createFile(
      scriptPath,
      [
        `const secret = ${JSON.stringify(secret)};`,
        "process.stdout.write(Array.from({ length: 1000 }, () => secret).join(\"\\n\"));",
      ].join("\n"),
    );

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-large-secret-output",
      taskId: "task-large-secret-output",
      agentId: "agent-large-secret-output",
      traceId: "trace-large-secret-output",
      toolName: "command_exec",
      timeoutMs: 5000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "node",
      args: [scriptPath],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.output.truncated, true);
    assert.equal(result.artifacts.length, 1);
    assert.ok(result.output.warnings.includes("secret_redacted"));
    assert.ok(result.output.warnings.includes("output_externalized"));

    const persistedOutput = readFileSync(result.artifacts[0]!, "utf8");
    assert.doesNotMatch(persistedOutput, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(persistedOutput.length > 0, true);
    assert.doesNotMatch(result.output.sanitizedText, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    cleanupPath(workspace);
  }
});
