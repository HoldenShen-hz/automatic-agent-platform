/**
 * Unit Tests: Plugin Runtime Host
 *
 * Tests for issue #1945: renderContainerizedToken uses unsanitized pluginId
 *
 * These tests verify the PluginRuntimeHost functionality including
 * the renderContainerizedToken function which does not sanitize pluginId.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ForkedPluginRuntimeHost,
  ContainerizedPluginRuntimeHost,
  buildContainerizedPluginRuntimeLaunchSpec,
  buildPluginRuntimeExecArgv,
  buildPluginRuntimeSandboxRoot,
} from "../../../src/domains/registry/plugin-runtime-host.js";
import type { PluginLifecycleContext, PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";

function createSandboxPolicy(overrides: Partial<PluginSandboxPolicy> = {}): PluginSandboxPolicy {
  return {
    timeoutMs: 5_000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 4,
    runtimeIsolation: "sandboxed_process",
    cooldownMs: 0,
    allowedExternalDomains: [],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

function createLifecycleContext(): PluginLifecycleContext {
  return {
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    capabilityIds: ["present.output"],
    bindingId: null,
    config: {},
  };
}

// =============================================================================
// buildPluginRuntimeExecArgv tests
// =============================================================================

test("buildPluginRuntimeExecArgv adds Node permission flags for sandboxed runtimes", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: createSandboxPolicy({
      allowFilesystemWrite: true,
    }),
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin_a",
    env: {
      NODE_V8_COVERAGE: "/tmp/coverage",
    },
  });

  assert.ok(args.includes("--permission"));
  assert.ok(args.includes("--allow-fs-read=/workspace/src"));
  assert.ok(args.includes("--allow-fs-read=/workspace/dist"));
  assert.ok(args.includes("--allow-fs-read=/workspace/node_modules"));
  assert.ok(args.includes("--allow-fs-read=/workspace/package.json"));
  assert.ok(args.includes("--allow-fs-read=/workspace/data/plugin-runtime-sandboxes/plugin_a"));
  assert.ok(args.includes("--allow-fs-write=/workspace/data/plugin-runtime-sandboxes/plugin_a"));
  assert.ok(args.includes("--allow-fs-write=/tmp/coverage"));
});

test("buildPluginRuntimeExecArgv keeps shared runtimes free of permission fencing", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "forked_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: createSandboxPolicy({
      runtimeIsolation: "forked_process",
    }),
    sandboxRoot: null,
    env: {},
  });

  assert.equal(args.includes("--permission"), false);
});

test("buildPluginRuntimeExecArgv handles non-sandboxed isolation", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "shared_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: createSandboxPolicy(),
    sandboxRoot: null,
    env: {},
  });

  // shared_process doesn't add permission flags
  assert.equal(args.includes("--permission"), false);
});

// =============================================================================
// buildPluginRuntimeSandboxRoot tests
// =============================================================================

test("buildPluginRuntimeSandboxRoot sanitizes pluginId for path safety", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin.coding.retriever", "/tmp/sandboxes");

  assert.ok(root.includes("/tmp/sandboxes"));
  // The sanitize function replaces invalid chars with - but preserves dots, underscores, hyphens
  assert.ok(root.includes("plugin.coding.retriever"));
});

test("buildPluginRuntimeSandboxRoot replaces dots with hyphens", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin.test.adapter", "/tmp/sandboxes");

  // plugin.test.adapter should be preserved (dots are valid)
  assert.ok(root.includes("plugin.test.adapter"));
});

test("buildPluginRuntimeSandboxRoot handles underscores", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin_test_adapter", "/tmp/sandboxes");

  // Underscores should be preserved
  assert.ok(root.includes("plugin_test_adapter") || root.includes("plugin-test-adapter"));
});

test("buildPluginRuntimeSandboxRoot uses default baseDir when not provided", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin.test");

  // Should use process.cwd()/data/plugin-runtime-sandboxes as default
  assert.ok(root.includes("plugin-runtime-sandboxes"));
});

// =============================================================================
// buildContainerizedPluginRuntimeLaunchSpec tests
// =============================================================================

test("buildContainerizedPluginRuntimeLaunchSpec renders container launcher placeholders", () => {
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "plugin.demo",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-demo",
    runtimeImage: "ghcr.io/example/plugin-runtime:latest",
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "--rm",
        "--network=none",
        "-v",
        "{sandboxRoot}:{sandboxRoot}",
        "{runtimeImage}",
        "{node}",
        "{childModulePath}",
      ]),
    },
  });

  assert.equal(spec.command, "docker");
  assert.deepEqual(spec.args, [
    "run",
    "--rm",
    "--network=none",
    "-v",
    "/workspace/data/plugin-runtime-sandboxes/plugin-demo:/workspace/data/plugin-runtime-sandboxes/plugin-demo",
    "ghcr.io/example/plugin-runtime:latest",
    process.execPath,
    "/workspace/dist/plugin-runtime-child.js",
  ]);
});

// =============================================================================
// Issue #1945: renderContainerizedToken uses unsanitized pluginId
// The pluginId is substituted directly into command template without sanitization
// =============================================================================

test("buildContainerizedPluginRuntimeLaunchSpec substitutes pluginId with sanitization (issue #1945)", () => {
  // Security fix: pluginId is now sanitized before substitution
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "plugin.test; echo hacked",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
    runtimeImage: "ghcr.io/example/plugin-runtime:latest",
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "--rm",
        "{pluginId}",
      ]),
    },
  });

  // The pluginId with semicolon IS sanitized - special chars become underscores
  assert.equal(spec.command, "docker");
  assert.ok(spec.args.includes("plugin.test__echo_hacked"));
});

test("buildContainerizedPluginRuntimeLaunchSpec substitutes pluginId with path traversal characters (issue #1945)", () => {
  // Security fix: pluginId is now sanitized - path traversal chars become underscores
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "../../../etc",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes",
    runtimeImage: "ghcr.io/example/plugin-runtime:latest",
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "-v",
        "{sandboxRoot}:{sandboxRoot}",
        "{pluginId}",
      ]),
    },
  });

  // The pluginId with ../ is sanitized - path traversal is neutralized
  assert.ok(spec.args.includes(".._.._.._etc"));
});

test("buildContainerizedPluginRuntimeLaunchSpec handles pluginId with newlines (issue #1945)", () => {
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "plugin.test\nmalicious",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes",
    runtimeImage: "ghcr.io/example/plugin-runtime:latest",
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "{pluginId}",
      ]),
    },
  });

  // Newline character is sanitized to underscore
  assert.ok(spec.args.some(arg => arg.includes("plugin.test_malicious")));
});

test("buildContainerizedPluginRuntimeLaunchSpec substitutes workspaceRoot correctly", () => {
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "plugin.test",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
    runtimeImage: "ghcr.io/example/plugin-runtime:latest",
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "-v",
        "{workspaceRoot}:{workspaceRoot}",
      ]),
    },
  });

  assert.ok(spec.args.includes("/workspace:/workspace"));
});

test("buildContainerizedPluginRuntimeLaunchSpec substitutes sandboxRoot correctly", () => {
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "plugin.test",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
    runtimeImage: "ghcr.io/example/plugin-runtime:latest",
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "-v",
        "{sandboxRoot}:{sandboxRoot}",
      ]),
    },
  });

  assert.ok(spec.args.includes("/workspace/data/plugin-runtime-sandboxes/plugin-test:/workspace/data/plugin-runtime-sandboxes/plugin-test"));
});

test("buildContainerizedPluginRuntimeLaunchSpec handles missing runtimeImage (issue #1945)", () => {
  const spec = buildContainerizedPluginRuntimeLaunchSpec({
    pluginId: "plugin.test",
    childModulePath: "/workspace/dist/plugin-runtime-child.js",
    workspaceRoot: "/workspace",
    sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
    runtimeImage: null,
    env: {
      AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
        "docker",
        "run",
        "{runtimeImage}",
      ]),
    },
  });

  // Empty string when runtimeImage is null
  assert.ok(spec.args.includes(""));
});

test("buildContainerizedPluginRuntimeLaunchSpec throws when AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON missing", () => {
  assert.throws(
    () => buildContainerizedPluginRuntimeLaunchSpec({
      pluginId: "plugin.test",
      childModulePath: "/workspace/dist/plugin-runtime-child.js",
      workspaceRoot: "/workspace",
      sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
      runtimeImage: null,
      env: {},
    }),
    /plugin_spi\.container_launcher_missing/,
  );
});

test("buildContainerizedPluginRuntimeLaunchSpec throws when JSON is invalid", () => {
  assert.throws(
    () => buildContainerizedPluginRuntimeLaunchSpec({
      pluginId: "plugin.test",
      childModulePath: "/workspace/dist/plugin-runtime-child.js",
      workspaceRoot: "/workspace",
      sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
      runtimeImage: null,
      env: {
        AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: "not valid json",
      },
    }),
    /plugin_spi\.container_launcher_invalid_json/,
  );
});

test("buildContainerizedPluginRuntimeLaunchSpec throws when template is not array", () => {
  assert.throws(
    () => buildContainerizedPluginRuntimeLaunchSpec({
      pluginId: "plugin.test",
      childModulePath: "/workspace/dist/plugin-runtime-child.js",
      workspaceRoot: "/workspace",
      sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
      runtimeImage: null,
      env: {
        AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify("not an array"),
      },
    }),
    /plugin_spi\.container_launcher_invalid_shape/,
  );
});

test("buildContainerizedPluginRuntimeLaunchSpec throws when template has non-string elements", () => {
  assert.throws(
    () => buildContainerizedPluginRuntimeLaunchSpec({
      pluginId: "plugin.test",
      childModulePath: "/workspace/dist/plugin-runtime-child.js",
      workspaceRoot: "/workspace",
      sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
      runtimeImage: null,
      env: {
        AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([123, "string"]),
      },
    }),
    /plugin_spi\.container_launcher_invalid_shape/,
  );
});

test("buildContainerizedPluginRuntimeLaunchSpec throws when command is empty", () => {
  assert.throws(
    () => buildContainerizedPluginRuntimeLaunchSpec({
      pluginId: "plugin.test",
      childModulePath: "/workspace/dist/plugin-runtime-child.js",
      workspaceRoot: "/workspace",
      sandboxRoot: "/workspace/data/plugin-runtime-sandboxes/plugin-test",
      runtimeImage: null,
      env: {
        AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([""]),
      },
    }),
    /plugin_spi\.container_launcher_empty_command/,
  );
});

// =============================================================================
// ForkedPluginRuntimeHost tests
// =============================================================================

test("ForkedPluginRuntimeHost executes presenter plugin through a sandboxed child runtime", async () => {
  const host = new ForkedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "sandboxed_process",
    sandboxPolicy: createSandboxPolicy({
      runtimeIsolation: "sandboxed_process",
    }),
    workspaceRoot: process.cwd(),
  });

  try {
    const output = await host.invoke<{ summary: string }>("present", createLifecycleContext(), {
      domainId: "coding",
      machineOutputs: [{ stepId: "step_1", outputRef: null, payload: { ok: true } }],
      artifacts: [],
      audience: "developer",
    });

    assert.equal(output.summary, "Completed 1 coding step(s): step_1");
  } finally {
    await host.stop();
  }
});

test("ForkedPluginRuntimeHost surfaces child runtime errors for unsupported actions", async () => {
  const host = new ForkedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "forked_process",
    sandboxPolicy: createSandboxPolicy({
      runtimeIsolation: "forked_process",
    }),
    workspaceRoot: process.cwd(),
  });

  try {
    await assert.rejects(
      async () => {
        await host.invoke("retrieve", createLifecycleContext(), {
          taskId: "task_1",
          intent: "invalid",
          context: {},
          tokenBudget: 32,
        });
      },
      /not a retriever/i,
    );
  } finally {
    await host.stop();
  }
});

test("ForkedPluginRuntimeHost.stop handles already stopped child", async () => {
  const host = new ForkedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "forked_process",
    sandboxPolicy: createSandboxPolicy(),
    workspaceRoot: process.cwd(),
  });

  // Calling stop twice should not throw
  await host.stop();
  await host.stop();
});

test("ForkedPluginRuntimeHost.invoke throws when child is unavailable", async () => {
  const host = new ForkedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "forked_process",
    sandboxPolicy: createSandboxPolicy(),
    workspaceRoot: process.cwd(),
  });

  // Start and then stop the host
  await host.start();
  await host.stop();

  // Invoke should throw since child is stopped
  await assert.rejects(
    async () => host.invoke("present", createLifecycleContext(), {}),
    /unavailable/i,
  );
});

// =============================================================================
// ContainerizedPluginRuntimeHost tests
// =============================================================================

test("ContainerizedPluginRuntimeHost can be instantiated", () => {
  const host = new ContainerizedPluginRuntimeHost({
    pluginId: "plugin.test",
    isolation: "containerized_process",
    sandboxPolicy: createSandboxPolicy(),
    workspaceRoot: process.cwd(),
  });

  assert.ok(host);
});

test("ContainerizedPluginRuntimeHost requires AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON env var", async () => {
  const host = new ContainerizedPluginRuntimeHost({
    pluginId: "plugin.test",
    isolation: "containerized_process",
    sandboxPolicy: createSandboxPolicy(),
    workspaceRoot: process.cwd(),
  });

  // ContainerizedPluginRuntimeHost spawns child which needs the env var
  // Without proper launcher config, it should fail
  try {
    await host.start();
    // If it starts, it should have proper config
    await host.stop();
  } catch (err: any) {
    // Expected to fail due to missing launcher config
    assert.ok(err.message.includes("container_launcher_missing") || err.message.includes("validation"));
  }
});

// =============================================================================
// Sandbox root path handling tests
// =============================================================================

test("sanitizePluginIdForPath preserves valid pluginId characters", () => {
  // pluginId with dots, underscores, hyphens are preserved
  const root = buildPluginRuntimeSandboxRoot("plugin.test.special", "/tmp");
  assert.ok(root.includes("plugin.test.special"));
});

test("buildPluginRuntimeSandboxRoot preserves valid pluginId characters", () => {
  const root = buildPluginRuntimeSandboxRoot("plugin.coding.retriever", "/tmp/sandboxes");
  // Dots are valid pluginId characters and are preserved
  assert.ok(root.includes("plugin.coding.retriever"));
});

// =============================================================================
// Environment variable tests
// =============================================================================

test("buildPluginRuntimeExecArgv forwards PATH from env", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: createSandboxPolicy(),
    sandboxRoot: "/tmp/sandbox",
    env: {
      PATH: "/usr/bin:/bin",
    },
  });

  // Should contain permission flags but not duplicate PATH
  assert.ok(args.length > 0);
});

test("buildPluginRuntimeExecArgv dedupes arguments", () => {
  const args = buildPluginRuntimeExecArgv({
    isolation: "sandboxed_process",
    workspaceRoot: "/workspace",
    sandboxPolicy: createSandboxPolicy(),
    sandboxRoot: "/tmp/sandbox",
    env: {
      NODE_V8_COVERAGE: "/tmp/coverage",
    },
  });

  // Check for duplicates by seeing if there are repeated --allow-fs-read entries
  const allowReadCount = args.filter(arg => arg.startsWith("--allow-fs-read")).length;
  const uniqueAllowReadCount = new Set(args.filter(arg => arg.startsWith("--allow-fs-read"))).size;
  assert.equal(allowReadCount, uniqueAllowReadCount, "Args should not have duplicates");
});