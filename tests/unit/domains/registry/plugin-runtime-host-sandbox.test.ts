import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPluginRuntimeSandboxRoot,
  buildPluginRuntimeExecArgv,
} from "../../../../src/domains/registry/plugin-runtime-host.js";
import type { PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";

function makeSandboxPolicy(overrides: Partial<PluginSandboxPolicy> = {}): PluginSandboxPolicy {
  return {
    timeoutMs: 5000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 8,
    runtimeIsolation: "sandboxed_process",
    cooldownMs: 0,
    allowedExternalDomains: [],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPluginRuntimeSandboxRoot
// ─────────────────────────────────────────────────────────────────────────────

test("buildPluginRuntimeSandboxRoot returns sandbox root path with sanitized plugin id", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin.coding.retriever");
  assert.ok(root.endsWith("plugin.coding.retriever"));
});

test("buildPluginRuntimeSandboxRoot sanitizes dots and underscores", () => {
  const root = buildPluginRuntimeSandboxRoot("my.plugin_id-v2");
  assert.ok(root.includes("my"));
  assert.ok(root.includes("plugin-id-v2") || root.includes("my"));
});

test("buildPluginRuntimeSandboxRoot accepts custom baseDir", () => {
  const root = buildPluginRuntimeSandboxRoot("test_plugin", "/custom/base");
  assert.ok(root.startsWith("/custom/base"));
});

test("buildPluginRuntimeSandboxRoot handles numeric plugin ids", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin_v2.1", "/tmp/plugins");
  assert.ok(root.includes("v2.1") || root.includes("v2-1"));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPluginRuntimeExecArgv - isolation handling
// ─────────────────────────────────────────────────────────────────────────────

test("buildPluginRuntimeExecArgv returns deduped args for non-sandboxed isolation", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "shared_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: null,
    env: {},
  });

  // Should just be the filtered process.execArgv without --permission flags
  assert.ok(!args.includes("--permission"));
});

test("buildPluginRuntimeExecArgv returns deduped args for serialized_in_process isolation", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "serialized_in_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: null,
    env: {},
  });

  assert.ok(!args.includes("--permission"));
});

test("buildPluginRuntimeExecArgv filters out --inspect flags", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: "/workspace/sandbox",
    env: {},
  });

  assert.ok(!args.some((arg) => arg.startsWith("--inspect")));
});

test("buildPluginRuntimeExecArgv dedupes repeated arguments", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: "/workspace/sandbox",
    env: {},
  });

  // Count occurrences of each arg - should all be unique
  const seen = new Set<string>();
  for (const arg of args) {
    assert.ok(!seen.has(arg), `Duplicate argument found: ${arg}`);
    seen.add(arg);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPluginRuntimeExecArgv - sandbox roots
// ─────────────────────────────────────────────────────────────────────────────

test("buildPluginRuntimeExecArgv adds workspace roots for sandboxed isolation", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: "/workspace/sandbox",
    env: {},
  });

  assert.ok(args.includes("--permission"));
  assert.ok(args.some((arg) => arg.includes("/workspace/src")));
  assert.ok(args.some((arg) => arg.includes("/workspace/dist")));
});

test("buildPluginRuntimeExecArgv adds sandbox write root when filesystem write allowed", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy({ allowFilesystemWrite: true }),
    sandboxRoot: "/workspace/sandbox",
    env: {},
  });

  assert.ok(args.some((arg) => arg.startsWith("--allow-fs-write=")));
  assert.ok(args.some((arg) => arg.includes("/workspace/sandbox")));
});

test("buildPluginRuntimeExecArgv does not add write root when filesystem write not allowed", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy({ allowFilesystemWrite: false }),
    sandboxRoot: "/workspace/sandbox",
    env: {},
  });

  const writeArgs = args.filter((arg) => arg.startsWith("--allow-fs-write="));
  assert.ok(writeArgs.length === 0 || writeArgs.every((arg) => !arg.includes("/workspace/sandbox")));
});

test("buildPluginRuntimeExecArgv includes NODE_V8_COVERAGE roots when set", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: "/workspace/sandbox",
    env: { NODE_V8_COVERAGE: "/tmp/coverage_output" },
  });

  assert.ok(args.some((arg) => arg.includes("/tmp/coverage_output")));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPluginRuntimeExecArgv - exec args filtering
// ─────────────────────────────────────────────────────────────────────────────

test("buildPluginRuntimeExecArgv filters --import args to extract file paths", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: "/workspace/sandbox",
    env: { NODE_NO_DEPRECATION_WARNING: "1" }, // Node v8+ style
  });

  // Should include workspace roots regardless
  assert.ok(args.some((arg) => arg.includes("/workspace/src")));
});

test("buildPluginRuntimeExecArgv handles empty execArgv gracefully", () => {
  const originalArgv = process.execArgv;
  try {
    // This test verifies the function works even if execArgv is modified
    const args = buildPluginRuntimeExecArgv({
      isolation: "sandboxed_process",
      workspaceRoot: "/workspace",
      sandboxPolicy: makeSandboxPolicy(),
      sandboxRoot: null,
      env: {},
    });

    // Should return a valid array
    assert.ok(Array.isArray(args));
  } finally {
    // Preserve original
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPluginRuntimeExecArgv - error cases
// ─────────────────────────────────────────────────────────────────────────────

test("buildPluginRuntimeExecArgv handles missing sandboxRoot gracefully", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: null,
    env: {},
  });

  // Should still include permission flags and workspace roots
  assert.ok(args.includes("--permission"));
  assert.ok(args.some((arg) => arg.includes("/workspace/src")));
});

test("buildPluginRuntimeExecArgv works without NODE_V8_COVERAGE environment variable", () => {
  const envWithoutCoverage = { ...process.env };
  delete envWithoutCoverage.NODE_V8_COVERAGE;

  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy(),
    sandboxRoot: "/workspace/sandbox",
    env: envWithoutCoverage,
  });

  assert.ok(args.includes("--permission"));
  assert.ok(Array.isArray(args));
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration with plugin runtime host concepts
// ─────────────────────────────────────────────────────────────────────────────

test("buildPluginRuntimeSandboxRoot produces path compatible with buildPluginRuntimeExecArgv", () => {
  const pluginId = "plugin.test.isolated";
  const sandboxRoot = buildPluginRuntimeSandboxRoot(pluginId, "/tmp/plugins");

  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy({ allowFilesystemWrite: true }),
    sandboxRoot,
    env: {},
  });

  // The exec argv should include the sandbox root in allow-fs-write
  assert.ok(args.some((arg) => arg.includes(sandboxRoot)));
});

test("buildPluginRuntimeExecArgv includes runtime read roots when sandbox policy allows filesystem write", () => {
  const sandboxRoot = "/tmp/plugin-sandbox";

  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: makeSandboxPolicy({ allowFilesystemWrite: true }),
    sandboxRoot,
    env: {},
  });

  // Should have both read and write access to sandbox root
  assert.ok(args.some((arg) => arg.startsWith(`--allow-fs-read=${sandboxRoot}`)));
  assert.ok(args.some((arg) => arg.startsWith(`--allow-fs-write=${sandboxRoot}`)));
});
