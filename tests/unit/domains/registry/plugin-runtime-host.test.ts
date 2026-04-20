import assert from "node:assert/strict";
import test from "node:test";

import {
  ForkedPluginRuntimeHost,
  buildContainerizedPluginRuntimeLaunchSpec,
  buildPluginRuntimeExecArgv,
} from "../../../../src/domains/registry/plugin-runtime-host.js";
import type { HumanOutput, PluginLifecycleContext, PluginSandboxPolicy } from "../../../../src/domains/registry/plugin-spi.js";

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
    sandboxPolicy: {
      timeoutMs: 5_000,
      allowFilesystemWrite: true,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 4,
      runtimeIsolation: "sandboxed_process",
      cooldownMs: 0,
    },
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
    sandboxPolicy: {
      timeoutMs: 5_000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 4,
      runtimeIsolation: "forked_process",
      cooldownMs: 0,
    },
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

test("ForkedPluginRuntimeHost executes presenter plugin through a sandboxed child runtime", async () => {
  let readyPid = 0;
  let unexpectedExit: boolean | null = null;
  const host = new ForkedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "sandboxed_process",
    sandboxPolicy: createSandboxPolicy(),
    workspaceRoot: process.cwd(),
    onReady: ({ pid }) => {
      readyPid = pid;
    },
    onExit: (unexpected) => {
      unexpectedExit = unexpected;
    },
  });

  try {
    const pid = await host.start();
    assert.ok(pid > 0);
    assert.equal(readyPid, pid);

    const result = await host.invoke<HumanOutput>("present", createLifecycleContext(), {
      machineOutputs: [
        {
          stepId: "step_present",
          outputRef: null,
          payload: { summary: "sandbox ok" },
        },
      ],
      artifacts: ["artifact:presented"],
      audience: "developer",
    });

    assert.match(result.summary, /完成 1 个 coding 步骤/);
    assert.ok(result.sections.some((section) => section.includes("step_present")));
    assert.deepEqual(result.citations, ["artifact:presented"]);
  } finally {
    await host.stop();
  }

  assert.equal(unexpectedExit, false);
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
