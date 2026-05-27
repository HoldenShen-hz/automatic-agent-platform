import assert from "node:assert/strict";
import test from "node:test";

import {
  DefaultSandboxProvider,
  createDefaultSandboxProvider,
  resolveSandboxProviderKind,
} from "../../../../../src/platform/five-plane-execution/sandbox-provider/index.js";

test("resolveSandboxProviderKind maps network isolated workloads to microvm [index]", () => {
  assert.equal(resolveSandboxProviderKind({ sandboxMode: "network_isolated" }), "microvm");
  assert.equal(resolveSandboxProviderKind({ sandboxMode: "persistent" }), "container");
  assert.equal(resolveSandboxProviderKind({ sandboxMode: "ephemeral" }), "local");
});

test("DefaultSandboxProvider creates sandbox sessions with bindings [index]", () => {
  const provider = new DefaultSandboxProvider("container");
  const session = provider.createSession(["bash", "read"], {
    sandboxMode: "persistent",
    timeoutMs: 120000,
    allowedHosts: ["api.example.com"],
  });

  assert.equal(session.providerKind, "container");
  assert.equal(session.sandboxLayer.bindings.length, 2);
  assert.equal(session.sandboxLayer.defaultLayer, "persistent");
  assert.equal(session.sandboxLayer.bindings[0]?.allowedHosts?.[0], "api.example.com");
});

test("createDefaultSandboxProvider honors inferred provider kind [index]", () => {
  const provider = createDefaultSandboxProvider({ sandboxMode: "network_isolated" });
  assert.equal(provider.providerKind, "microvm");
});
