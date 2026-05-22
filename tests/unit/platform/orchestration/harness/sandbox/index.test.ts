import assert from "node:assert/strict";
import test from "node:test";

import { createSandboxLayer } from "../../../../../../src/platform/five-plane-orchestration/harness/sandbox/index.js";

test("createSandboxLayer defaults to ephemeral isolation", () => {
  const layer = createSandboxLayer(["planner", "executor"], {});

  assert.equal(layer.defaultLayer, "ephemeral");
  assert.equal(layer.bindings.length, 2);
  assert.ok(layer.bindings.every((binding) => binding.layer === "ephemeral"));
  assert.ok(layer.bindings.every((binding) => binding.timeoutMs === 30_000));
});

test("createSandboxLayer propagates sandbox requirements to each tool binding", () => {
  const allowedHosts = ["api.example.com", "status.example.com"] as const;
  const layer = createSandboxLayer(["search"], {
    sandboxRequirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 45_000,
      allowedHosts,
    },
  });

  assert.equal(layer.defaultLayer, "network_isolated");
  assert.equal(layer.bindings.length, 1);
  assert.equal(layer.bindings[0]?.toolName, "search");
  assert.equal(layer.bindings[0]?.layer, "network_isolated");
  assert.equal(layer.bindings[0]?.timeoutMs, 45_000);
  assert.deepEqual(layer.bindings[0]?.allowedHosts, allowedHosts);
  assert.match(layer.bindings[0]?.isolationId ?? "", /^sandbox_search_/);
});
