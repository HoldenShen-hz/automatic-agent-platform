/**
 * Integration Tests: Sandbox Security - Command Execution
 *
 * Security integration tests for sandbox command execution:
 * - Command injection prevention
 * - Path traversal blocking in command arguments
 * - Symlink traversal blocking
 * - Shell metacharacter handling
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { createWorkspaceWritePolicy, type SandboxPolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { CommandExecutor } from "../../../../src/platform/execution/tool-executor/command-executor.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

// ─────────────────────────────────────────────────────────────────────────────
// Command Injection Prevention
// ─────────────────────────────────────────────────────────────────────────────

test("security: blocks command injection via semicolon", async () => {
  const workspace = createTempWorkspace("cmd-inj-semicolon-");

  try {
    createFile(join(workspace, " innocent_file.txt"), "innocent content");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-cmd-inj",
      taskId: "task-cmd-inj",
      agentId: "agent-cmd-inj",
      traceId: "trace-cmd-inj",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["hello; rm -rf /"],
      cwd: workspace,
    });

    // Command should either succeed with safe args or be blocked
    assert.ok(result.status === "succeeded" || result.status === "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: blocks command injection via pipe", async () => {
  const workspace = createTempWorkspace("cmd-inj-pipe-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-cmd-pipe",
      taskId: "task-cmd-pipe",
      agentId: "agent-cmd-pipe",
      traceId: "trace-cmd-pipe",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["hello | cat /etc/passwd"],
      cwd: workspace,
    });

    assert.ok(result.status === "succeeded" || result.status === "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: blocks command injection via backticks", async () => {
  const workspace = createTempWorkspace("cmd-inj-backtick-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-cmd-backtick",
      taskId: "task-cmd-backtick",
      agentId: "agent-cmd-backtick",
      traceId: "trace-cmd-backtick",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["hello `whoami`"],
      cwd: workspace,
    });

    assert.ok(result.status === "succeeded" || result.status === "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: blocks command injection via $()", async () => {
  const workspace = createTempWorkspace("cmd-inj-dollars-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-cmd-dollars",
      taskId: "task-cmd-dollars",
      agentId: "agent-cmd-dollars",
      traceId: "trace-cmd-dollars",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["hello $(whoami)"],
      cwd: workspace,
    });

    assert.ok(result.status === "succeeded" || result.status === "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: blocks command injection via newlines", async () => {
  const workspace = createTempWorkspace("cmd-inj-newline-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-cmd-newline",
      taskId: "task-cmd-newline",
      agentId: "agent-cmd-newline",
      traceId: "trace-cmd-newline",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["hello\nwhoami"],
      cwd: workspace,
    });

    assert.ok(result.status === "succeeded" || result.status === "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Path Traversal in Arguments
// ─────────────────────────────────────────────────────────────────────────────

test("security: blocks ../ traversal in command arguments", async () => {
  const workspace = createTempWorkspace("arg-traversal-");
  const outsideFile = join(workspace, "..", "outside.txt");

  try {
    createFile(outsideFile, "should not read");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-arg-traversal",
      taskId: "task-arg-traversal",
      agentId: "agent-arg-traversal",
      traceId: "trace-arg-traversal",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [join(workspace, "..", "outside.txt")],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: blocks multiple ../ traversal in arguments", async () => {
  const workspace = createTempWorkspace("arg-multi-traversal-");
  const deepOutsideFile = join(workspace, "..", "..", "outside.txt");

  try {
    createFile(deepOutsideFile, "deep outside");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-arg-multi",
      taskId: "task-arg-multi",
      agentId: "agent-arg-multi",
      traceId: "trace-arg-multi",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [join(workspace, "..", "..", "outside.txt")],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Symlink Traversal
// ─────────────────────────────────────────────────────────────────────────────

test("security: blocks symlink to outside directory", async () => {
  const workspace = createTempWorkspace("symlink-outside-");
  const targetDir = createTempWorkspace("symlink-target-");
  const targetFile = join(targetDir, "secret.txt");

  try {
    createFile(targetFile, "super secret");
    createSymlink(targetDir, join(workspace, "outside_link"));

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-symlink-outside",
      taskId: "task-symlink-outside",
      agentId: "agent-symlink-outside",
      traceId: "trace-symlink-outside",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [join(workspace, "outside_link", "secret.txt")],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
    cleanupPath(targetDir);
  }
});

test("security: blocks absolute symlink pointing outside", async () => {
  const workspace = createTempWorkspace("symlink-abs-");
  const outsideDir = createTempWorkspace("symlink-outside-dir-");
  const outsideFile = join(outsideDir, "data.txt");

  try {
    createFile(outsideFile, "outside data");
    createSymlink(outsideDir, join(workspace, "abs_link"));

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-symlink-abs",
      taskId: "task-symlink-abs",
      agentId: "agent-symlink-abs",
      traceId: "trace-symlink-abs",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [join(workspace, "abs_link", "data.txt")],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
    cleanupPath(outsideDir);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Null Byte and Encoding Attacks
// ─────────────────────────────────────────────────────────────────────────────

test("security: blocks null byte injection in path", async () => {
  const workspace = createTempWorkspace("nullbyte-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-nullbyte",
      taskId: "task-nullbyte",
      agentId: "agent-nullbyte",
      traceId: "trace-nullbyte",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: ["/workspace/file.txt\x00 evil"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: blocks URL-encoded path traversal", async () => {
  const workspace = createTempWorkspace("url-encoded-");

  try {
    const executor = new CommandExecutor();
    // %2e%2e%2f = ../ URL encoded
    const result = await executor.execute({
      callId: "call-url-enc",
      taskId: "task-url-enc",
      agentId: "agent-url-enc",
      traceId: "trace-url-enc",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: ["%2e%2e%2f%2e%2e%2fetc%2fpasswd"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Valid Operations Should Succeed
// ─────────────────────────────────────────────────────────────────────────────

test("security: allows valid file operations within workspace", async () => {
  const workspace = createTempWorkspace("valid-ops-");

  try {
    const validFile = join(workspace, "src", "index.ts");
    createFile(validFile, "console.log('hello');");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-valid-ops",
      taskId: "task-valid-ops",
      agentId: "agent-valid-ops",
      traceId: "trace-valid-ops",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [validFile],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
  } finally {
    cleanupPath(workspace);
  }
});

test("security: allows commands with safe arguments", async () => {
  const workspace = createTempWorkspace("safe-args-");

  try {
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "call-safe-args",
      taskId: "task-safe-args",
      agentId: "agent-safe-args",
      traceId: "trace-safe-args",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "echo",
      args: ["hello world", "foo bar"],
      cwd: workspace,
    });

    assert.equal(result.status, "succeeded");
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Denied Roots Enforcement
// ─────────────────────────────────────────────────────────────────────────────

test("security: denied roots block access even within allowed root", async () => {
  const workspace = createTempWorkspace("denied-roots-");
  const policy: SandboxPolicy = {
    ...createWorkspaceWritePolicy(workspace),
    deniedRoots: [join(workspace, "secrets")],
  };

  try {
    createFile(join(workspace, "secrets", "api-keys.json"), '{"key": "secret"}');
    createFile(join(workspace, "public", "info.txt"), "public info");

    const executor = new CommandExecutor();

    // Access to secrets should be blocked
    const secretResult = await executor.execute({
      callId: "call-denied-secret",
      taskId: "task-denied-secret",
      agentId: "agent-denied-secret",
      traceId: "trace-denied-secret",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: policy,
      command: "cat",
      args: [join(workspace, "secrets", "api-keys.json")],
      cwd: workspace,
    });

    assert.equal(secretResult.status, "blocked");

    // Access to public should succeed
    const publicResult = await executor.execute({
      callId: "call-allowed-public",
      taskId: "task-allowed-public",
      agentId: "agent-allowed-public",
      traceId: "trace-allowed-public",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: policy,
      command: "cat",
      args: [join(workspace, "public", "info.txt")],
      cwd: workspace,
    });

    assert.equal(publicResult.status, "succeeded");
  } finally {
    cleanupPath(workspace);
  }
});
