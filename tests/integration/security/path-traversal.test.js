/**
 * Security Tests: Path Traversal Attack Prevention
 *
 * Tests that verify the system blocks path traversal attacks including:
 * - ../ directory traversal
 * - Symlink-based sandbox escapes
 * - Null-byte injection
 * - URL-encoded traversal sequences
 * - Encoded path separators
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { CommandExecutor } from "../../../src/platform/execution/tool-executor/command-executor.js";
import { cleanupPath, createTempWorkspace, createSymlink } from "../../../helpers/fs.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";
function createReadOnlySandboxPolicy(workspace) {
    return {
        policyId: "test-readonly-sandbox",
        mode: "read_only",
        allowedRoots: [workspace],
        deniedRoots: ["/etc", "/var", "/root"],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "allow",
    };
}
function createWorkspaceWriteSandboxPolicy(workspace) {
    return {
        policyId: "test-workspace-sandbox",
        mode: "workspace_write",
        allowedRoots: [workspace],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "allow",
    };
}
test("command-executor blocks path traversal via ../ in command arguments", async () => {
    const workspace = createTempWorkspace("aa-security-traversal-");
    const executor = new CommandExecutor();
    try {
        // Create a file inside workspace
        const innerDir = join(workspace, "allowed");
        const targetFile = join(innerDir, "safe.txt");
        // Build attack path: workspace/allowed/../../../etc/passwd
        const attackPath = join(innerDir, "..", "..", "..", "etc", "passwd");
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [attackPath],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        assert.equal(result.status, "blocked", "Path traversal should be blocked");
        assert.ok(result.error?.code.includes("denied") || result.error?.code.includes("scope"), "Should have denial error code");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks path traversal with encoded ../ (%2e%2e)", async () => {
    const workspace = createTempWorkspace("aa-security-encoded-");
    const executor = new CommandExecutor();
    try {
        // URL-encoded traversal sequence
        const encodedTraversal = "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd";
        const normalizedPath = decodeURIComponent(encodedTraversal);
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [normalizedPath],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        assert.equal(result.status, "blocked", "Encoded path traversal should be blocked");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks null-byte injection in path arguments", async () => {
    const workspace = createTempWorkspace("aa-security-nullbyte-");
    const executor = new CommandExecutor();
    try {
        // Null-byte injection attack: file.txt\0 followed by malicious path
        const nullBytePath = `safe.txt\x00/etc/passwd`;
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [nullBytePath],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        assert.equal(result.status, "blocked", "Null-byte injection should be blocked");
        assert.ok(result.error?.code === "sandbox.command_arg_path_denied", "Should have null-byte denial code");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks symlink-based sandbox escape", async () => {
    const workspace = createTempWorkspace("aa-security-symlink-");
    const executor = new CommandExecutor();
    try {
        // Create a symlink inside workspace pointing outside
        const innerDir = join(workspace, "links");
        const escapeTarget = "/etc";
        const symlinkPath = join(innerDir, "escape");
        // Create symlink (this is within workspace but points outside)
        createSymlink(escapeTarget, symlinkPath);
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [symlinkPath],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        // Symlink should be blocked when symlinkPolicy is "deny"
        assert.equal(result.status, "blocked", "Symlink escape should be blocked");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks realpath evasion via nested symlinks", async () => {
    const workspace = createTempWorkspace("aa-security-nested-symlink-");
    const executor = new CommandExecutor();
    try {
        // Create nested symlinks that eventually point outside sandbox
        const layer1 = join(workspace, "level1");
        const layer2 = join(layer1, "level2");
        const finalTarget = join(workspace, "final");
        // level1 -> workspace (escape attempt)
        createSymlink(workspace, join(layer1, "back_to_root"));
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [`${join(layer1, "back_to_root")}/../etc/passwd`],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        assert.equal(result.status, "blocked", "Nested symlink evasion should be blocked");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks path with double-encoded traversal", async () => {
    const workspace = createTempWorkspace("aa-security-double-encoded-");
    const executor = new CommandExecutor();
    try {
        // Double-encoded: %252e%252e%252f = ../
        const doubleEncoded = "%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd";
        const decodedOnce = decodeURIComponent(doubleEncoded);
        const decodedTwice = decodeURIComponent(decodedOnce);
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [decodedTwice],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        assert.equal(result.status, "blocked", "Double-encoded traversal should be blocked");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks path traversal using backslash (Windows-style)", async () => {
    const workspace = createTempWorkspace("aa-security-backslash-");
    const executor = new CommandExecutor();
    try {
        // Windows-style path separators
        const attackPath = "..\\..\\..\\etc\\passwd";
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [attackPath],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        assert.equal(result.status, "blocked", "Backslash traversal should be blocked");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor blocks traversal with unicode normalization attack", async () => {
    const workspace = createTempWorkspace("aa-security-unicode-");
    const executor = new CommandExecutor();
    try {
        // Unicode fullwidth solidus (U+FF0F) looks like / but is different character
        const unicodeTraversal = "．．∕．．∕etc∕passwd";
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [unicodeTraversal],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        // Unicode normalization should catch this
        assert.equal(result.status, "blocked", "Unicode traversal should be blocked");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("command-executor allows safe paths within sandbox boundary", async () => {
    const workspace = createTempWorkspace("aa-security-safe-");
    const executor = new CommandExecutor();
    try {
        // Create a legitimate file within workspace
        const safeFile = join(workspace, "safe.txt");
        const request = {
            callId: newId("call"),
            taskId: newId("task"),
            traceId: newId("trace"),
            executionId: null,
            toolName: "bash",
            command: "cat",
            args: [safeFile],
            cwd: workspace,
            timeoutMs: 5000,
            sandboxPolicy: createWorkspaceWriteSandboxPolicy(workspace),
            allowedTools: ["cat"],
            allowedPathRoots: [workspace],
        };
        const result = await executor.execute(request);
        // Safe path should NOT be blocked (may fail for other reasons like file doesn't exist,
        // but NOT blocked due to security)
        // Note: If file doesn't exist, status would be "failed", not "blocked"
        if (result.status === "blocked") {
            assert.fail("Safe path within sandbox should not be blocked");
        }
    }
    finally {
        cleanupPath(workspace);
    }
});
test("sandbox policy denies access to explicitly denied roots", async () => {
    const workspace = createTempWorkspace("aa-security-denied-");
    try {
        const policy = {
            policyId: "test-deny-roots",
            mode: "read_only",
            allowedRoots: [workspace],
            deniedRoots: ["/etc/passwd"],
            realpathEnforced: true,
            symlinkPolicy: "deny",
            processRuleMode: "allow",
        };
        const { checkSandboxPath } = await import("../../../src/platform/control-plane/iam/sandbox-policy.js");
        const result = checkSandboxPath(policy, "/etc/passwd");
        assert.equal(result.allowed, false, "Explicitly denied path should be blocked");
        assert.ok(result.reasonCode?.includes("denied"), "Should have denial reason code");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=path-traversal.test.js.map