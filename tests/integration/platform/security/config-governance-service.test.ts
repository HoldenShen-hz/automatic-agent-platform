import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { ConfigGovernanceService } from "../../../../src/platform/control-plane/config-center/config-governance-service.js";
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

test("config governance service blocks config roots outside the workspace sandbox", () => {
  const workspace = createTempWorkspace("aa-config-sec-");
  const outside = createTempWorkspace("aa-config-outside-");

  try {
    seedConfigTree(join(outside, "config"));
    const service = new ConfigGovernanceService({
      configRoot: join(outside, "config"),
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(() => service.loadBundle("dev"), /sandbox\.path_outside_allowed_roots/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("config governance service blocks symlink escapes inside config trees", () => {
  const workspace = createTempWorkspace("aa-config-sec-");
  const outside = createTempWorkspace("aa-config-target-");

  try {
    const configRoot = join(workspace, "config");
    seedConfigTree(configRoot);
    createFile(join(outside, "security.json"), JSON.stringify({ approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false }));
    rmSync(join(configRoot, "security/default.json"));
    createSymlink(join(outside, "security.json"), join(configRoot, "security/default.json"));

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(() => service.loadBundle("dev"), /sandbox\.symlink_denied/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("config governance service parses JSONC config files without widening sandbox access", () => {
  const workspace = createTempWorkspace("aa-config-sec-");

  try {
    const configRoot = join(workspace, "config");
    seedConfigTree(configRoot);
    createFile(
      join(configRoot, "runtime/default.json"),
      `{
        // keep within workspace root
        "maxConcurrentTasks": 2,
        "defaultTaskTimeoutMs": 300000,
        "defaultStepTimeoutMs": 120000,
      }`,
    );

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });
    const bundle = service.loadBundle("dev");

    assert.equal(bundle.layers.runtime?.defaultTaskTimeoutMs, 300000);
    assert.equal(bundle.issues.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service blocks symlink escapes for models registry files", () => {
  const workspace = createTempWorkspace("aa-config-sec-");
  const outside = createTempWorkspace("aa-config-registry-target-");

  try {
    const configRoot = join(workspace, "config");
    seedConfigTree(configRoot);
    createFile(
      join(outside, "models.json"),
      JSON.stringify({
        version: "outside-registry",
        providers: { openai: { status: "active", authMethods: ["api_key"] } },
        profiles: {},
      }),
    );
    rmSync(join(configRoot, "providers/models.json"));
    createSymlink(join(outside, "models.json"), join(configRoot, "providers/models.json"));

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(() => service.loadBundle("dev"), /sandbox\.symlink_denied/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
