import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { buildDefaultStartupConfigValidator } from "../../../../src/platform/execution/startup/startup-preflight.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

function seedConfigTree(root: string): void {
  createFile(join(root, "bootstrap/default.json"), JSON.stringify({ appName: "aa", phase: "phase_2a", stableCoreEnabled: true }));
  createFile(join(root, "gateways/default.json"), JSON.stringify({ defaultGateway: "cli", sseEnabled: true }));
  createFile(join(root, "providers/default.json"), JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }));
  createFile(join(root, "providers/models.json"), JSON.stringify({
    version: "test-registry",
    providers: { openai: { status: "active", authMethods: ["api_key"] } },
    profiles: {
      "reasoning-medium": {
        provider: "openai",
        modelId: "gpt-5.2",
        tier: "reasoning",
        capabilities: ["reasoning"],
        contextWindowTokens: 400000,
        maxOutputTokens: 128000,
        pricing: { inputPer1kUsd: 0.012, outputPer1kUsd: 0.036 },
        metadataSource: "local_override",
      },
    },
  }));
  createFile(join(root, "runtime/default.json"), JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }));
  createFile(join(root, "security/default.json"), JSON.stringify({
    approvalMode: "supervised",
    sandboxMode: "workspace_write",
    allowDestructiveActions: false,
    remoteWorkerRegistration: {
      challengeTtlMs: 300000,
      allowedCapabilities: ["bash", "edit", "mcp"],
    },
  }));
  createFile(join(root, "workflows/default.json"), JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }));
}

test("startup preflight validator fails closed on config symlink escapes", () => {
  const workspace = createTempWorkspace("aa-startup-preflight-sec-");
  const outside = createTempWorkspace("aa-startup-preflight-target-");

  try {
    const configRoot = join(workspace, "config");
    seedConfigTree(configRoot);
    createFile(
      join(outside, "security.json"),
      JSON.stringify({ approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false }),
    );
    rmSync(join(configRoot, "security/default.json"));
    createSymlink(join(outside, "security.json"), join(configRoot, "security/default.json"));

    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });
    const result = validate();

    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.includes("sandbox.symlink_denied")));
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
