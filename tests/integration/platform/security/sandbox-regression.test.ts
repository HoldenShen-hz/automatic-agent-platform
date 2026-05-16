/**
 * Sandbox Regression Tests
 *
 * Security regression tests for sandbox path validation:
 * - Symlink traversal via relative path
 * - Symlink traversal via absolute path
 * - Config-root escape attempt
 * - Double-encoded path traversal (%2e%2e%2f)
 * - Null-byte injection in path
 *
 * These tests ensure the sandbox correctly blocks path traversal attacks
 * and injection attempts that could escape the workspace boundary.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
} from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { CommandExecutor } from "../../../../src/platform/five-plane-execution/tool-executor/command-executor.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

test("workspace-write sandbox explicitly denies sensitive system roots", async () => {
  const workspace = createTempWorkspace("aa-sandbox-denied-roots-");

  try {
    const policy = createWorkspaceWritePolicy(workspace);
    assert.deepEqual(policy.deniedRoots, ["/etc", "/proc", "/sys"]);

    for (const deniedPath of ["/etc/hosts", "/proc/self/status", "/sys/kernel"]) {
      const check = checkSandboxPath(policy, deniedPath);
      assert.equal(check.allowed, false);
      assert.equal(check.reasonCode, "sandbox.path_in_denied_root");
    }

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "sandbox-call-denied-root",
      taskId: "sandbox-task-denied-root",
      agentId: "agent-denied-root",
      traceId: "trace-denied-root",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: policy,
      command: "cat",
      args: ["/etc/hosts"],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.ok(
      result.error?.code === "sandbox.command_arg_path_denied" ||
      result.error?.code === "tool.path_scope_command_arg_denied",
      `Expected denied-root block code but got ${result.error?.code}`,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("sandbox rejects symlink traversal via relative path", async () => {
  // Create a symlink from workspace to an outside directory,
  // then try to traverse through it using relative ../ path
  const workspace = createTempWorkspace("aa-sandbox-symlink-rel-");
  const targetOutside = createTempWorkspace("aa-sandbox-target-");
  const targetFile = join(targetOutside, "secret.txt");

  try {
    createFile(targetFile, "sensitive data\n");
    // Create symlink: workspace/link_to_target -> targetOutside
    const linkInWorkspace = join(workspace, "link_to_target");
    createSymlink(targetOutside, linkInWorkspace);

    // Try to access target via relative path through symlink
    const symlinkArg = join(linkInWorkspace, "secret.txt");
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "sandbox-call-symlink-rel",
      taskId: "sandbox-task-symlink-rel",
      agentId: "agent-symlink-rel",
      traceId: "trace-symlink-rel",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [symlinkArg],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(
      result.error?.code,
      "sandbox.command_arg_path_denied",
      `Expected sandbox.command_arg_path_denied but got ${result.error?.code}`,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(targetOutside);
  }
});

test("sandbox rejects symlink traversal via absolute path", async () => {
  // Create a symlink where the target is accessed via absolute path,
  // ensuring the sandbox validates absolute paths that resolve outside workspace
  const workspace = createTempWorkspace("aa-sandbox-symlink-abs-");
  const targetOutside = createTempWorkspace("aa-sandbox-target-abs-");
  const targetFile = join(targetOutside, "etc_passwd");

  try {
    createFile(targetFile, "root:x:0:0:root:/root:/bin/bash\n");
    // Create symlink: workspace/absolute_link -> /tmp/... (absolute path outside workspace)
    const absoluteSymlink = join(workspace, "absolute_link");
    createSymlink(targetOutside, absoluteSymlink);

    // Try to access via the absolute path of the symlink target
    const absoluteTargetPath = join(absoluteSymlink, "etc_passwd");
    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "sandbox-call-symlink-abs",
      taskId: "sandbox-task-symlink-abs",
      agentId: "agent-symlink-abs",
      traceId: "trace-symlink-abs",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [absoluteTargetPath],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.equal(
      result.error?.code,
      "sandbox.command_arg_path_denied",
      `Expected sandbox.command_arg_path_denied but got ${result.error?.code}`,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(targetOutside);
  }
});

test("sandbox rejects config-root escape attempt", async () => {
  // Simulate escaping from a config-root directory to access script outside workspace
  const workspace = createTempWorkspace("aa-sandbox-config-");
  const configRoot = join(workspace, "config");
  const scriptOutside = join(workspace, "..", "outside_script.sh");

  try {
    createFile(join(configRoot, "config.json"), "{}");
    createFile(scriptOutside, "#!/bin/bash\necho pwned\n");

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "sandbox-call-config-escape",
      taskId: "sandbox-task-config-escape",
      agentId: "agent-config-escape",
      traceId: "trace-config-escape",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "bash",
      args: [scriptOutside],
      cwd: configRoot,
    });

    assert.equal(result.status, "blocked");
    assert.equal(
      result.error?.code,
      "sandbox.command_arg_path_denied",
      `Expected sandbox.command_arg_path_denied but got ${result.error?.code}`,
    );
  } finally {
    cleanupPath(workspace);
    // Don't delete workspace's parent - it's a system directory on macOS
  }
});

test("sandbox rejects double-encoded path traversal (%2e%2e%2f)", async () => {
  // Test that double-encoded path traversal sequences are rejected
  // %2e = . and %2f = /, so %2e%2e%2f = ../
  const workspace = createTempWorkspace("aa-sandbox-double-enc-");
  const outside = createTempWorkspace("aa-sandbox-outside-");
  const targetFile = join(outside, "passwd");

  try {
    createFile(targetFile, "sensitive\n");
    // Build a double-encoded path that would traverse outside workspace
    const outsideBasename = outside.replace(/^.*\//, "");
    const doubleEncoded = `..%2f..%2f${outsideBasename}%2fpasswd`;

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "sandbox-call-double-enc",
      taskId: "sandbox-task-double-enc",
      agentId: "agent-double-enc",
      traceId: "trace-double-enc",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [doubleEncoded],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.ok(
      result.error?.code === "tool.command_meta_syntax_denied" ||
      result.error?.code === "sandbox.command_arg_path_denied" ||
      result.error?.code === "tool.path_scope_command_arg_denied",
      `Expected tool.command_meta_syntax_denied, sandbox.command_arg_path_denied or tool.path_scope_command_arg_denied but got ${result.error?.code}`,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("sandbox rejects null-byte injection in path", async () => {
  // Test that null-byte injection in path arguments is rejected
  // Null bytes can be used to truncate paths in some C-level operations
  const workspace = createTempWorkspace("aa-sandbox-nullbyte-");
  const outside = createTempWorkspace("aa-sandbox-outside-null-");
  const targetFile = join(outside, "passwd");

  try {
    createFile(targetFile, "sensitive\n");
    // Null-byte injection: somefile\x00.txt could bypass path checks
    const nullBytePath = "somefile\x00.txt";

    const executor = new CommandExecutor();
    const result = await executor.execute({
      callId: "sandbox-call-nullbyte",
      taskId: "sandbox-task-nullbyte",
      agentId: "agent-nullbyte",
      traceId: "trace-nullbyte",
      toolName: "command_exec",
      timeoutMs: 1000,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      command: "cat",
      args: [nullBytePath],
      cwd: workspace,
    });

    assert.equal(result.status, "blocked");
    assert.ok(
      result.error?.code === "tool.command_meta_syntax_denied" ||
      result.error?.code === "sandbox.command_arg_path_denied" ||
      result.error?.code === "tool.path_scope_command_arg_denied",
      `Expected tool.command_meta_syntax_denied, sandbox.command_arg_path_denied or tool.path_scope_command_arg_denied but got ${result.error?.code}`,
    );
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
