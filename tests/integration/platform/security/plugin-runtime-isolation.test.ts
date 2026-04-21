import assert from "node:assert/strict";
import test from "node:test";

import { ForkedPluginRuntimeHost } from "../../../../src/domains/registry/plugin-runtime-host.js";
import type { PluginLifecycleContext } from "../../../../src/domains/registry/plugin-spi.js";

function createLifecycleContext(): PluginLifecycleContext {
  return {
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    capabilityIds: ["present.output"],
    bindingId: null,
    config: {},
  };
}

test("sandboxed plugin runtime reports isolated sandbox metadata and handles lifecycle cleanly", async () => {
  let readySandboxRoot: string | null = null;
  let unexpectedExit: boolean | null = null;
  const host = new ForkedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "sandboxed_process",
    sandboxPolicy: {
      timeoutMs: 5_000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 2,
      runtimeIsolation: "sandboxed_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
    workspaceRoot: process.cwd(),
    onReady: ({ sandboxRoot }) => {
      readySandboxRoot = sandboxRoot;
    },
    onExit: (unexpected) => {
      unexpectedExit = unexpected;
    },
  });

  try {
    const pid = await host.start();
    assert.ok(pid > 0);
    assert.match(readySandboxRoot ?? "", /plugin-runtime-sandboxes/);

    const result = await host.invoke<{ summary: string }>("present", createLifecycleContext(), {
      machineOutputs: [
        {
          stepId: "step_security",
          outputRef: null,
          payload: { summary: "sandbox ok" },
        },
      ],
      artifacts: ["artifact:security"],
      audience: "developer",
    });
    assert.match(result.summary, /coding/);
  } finally {
    await host.stop();
  }

  assert.equal(unexpectedExit, false);
});
