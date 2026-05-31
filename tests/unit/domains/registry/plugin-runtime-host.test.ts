import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ForkedPluginRuntimeHost,
  buildContainerizedPluginRuntimeLaunchSpec,
  buildPluginRuntimeExecArgv,
  buildPluginRuntimeSandboxRoot,
} from "../../../../src/domains/registry/plugin-runtime-host.js";
import type { PluginLifecycleContext, PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

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
  assert.equal(args.includes("--allow-fs-read=/workspace"), false);
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

test("ContainerizedPluginRuntimeHost logs non-protocol stdout lines", () => {
  const source = readFileSync("src/domains/registry/plugin-runtime-host.ts", "utf8");

  assert.match(source, /getPluginRuntimeHostLogger\(\)\.warn\("plugin_runtime_host\.non_protocol_stdout"/);
});

test("plugin runtime child installs fatal rejection isolation hooks", () => {
  const source = readFileSync("src/domains/registry/plugin-runtime-child.ts", "utf8");

  assert.match(source, /process\.on\("unhandledRejection"/);
  assert.match(source, /process\.on\("uncaughtException"/);
  assert.match(source, /handleFatalRuntimeError/);
});

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

test("buildPluginRuntimeSandboxRoot rejects pluginId containing path traversal segments", () => {
  assert.throws(
    () => buildPluginRuntimeSandboxRoot("../../../etc/passwd"),
    /invalid_plugin_id/i,
  );
});

test("buildPluginRuntimeSandboxRoot rejects pluginId with path traversal sequences", () => {
  assert.throws(
    () => buildPluginRuntimeSandboxRoot("plugin/../../../etc"),
    /invalid_plugin_id/i,
  );
});

test("buildContainerizedPluginRuntimeLaunchSpec rejects malicious pluginId with shell metacharacters", () => {
  const maliciousPluginId = '"; cat /etc/passwd; echo "';
  assert.throws(
    () =>
      buildContainerizedPluginRuntimeLaunchSpec({
        pluginId: maliciousPluginId,
        childModulePath: "/workspace/dist/plugin-runtime-child.js",
        workspaceRoot: "/workspace",
        sandboxRoot: "/workspace/data/plugin-runtime-sandboxes",
        runtimeImage: "ghcr.io/example/plugin-runtime:latest",
        env: {
          AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
            "docker",
            "run",
            "--rm",
            "{pluginId}",
          ]),
        },
      }),
    /invalid_plugin_id/i,
  );
});

test("buildContainerizedPluginRuntimeLaunchSpec rejects pluginId with null bytes", () => {
  const maliciousPluginId = "plugin\x00malicious";
  assert.throws(
    () =>
      buildContainerizedPluginRuntimeLaunchSpec({
        pluginId: maliciousPluginId,
        childModulePath: "/workspace/dist/plugin-runtime-child.js",
        workspaceRoot: "/workspace",
        sandboxRoot: "/workspace/data/plugin-runtime-sandboxes",
        runtimeImage: "ghcr.io/example/plugin-runtime:latest",
        env: {
          AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON: JSON.stringify([
            "docker",
            "run",
            "--rm",
            "{pluginId}",
          ]),
        },
      }),
    /invalid_plugin_id/i,
  );
});

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
