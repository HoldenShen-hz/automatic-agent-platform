import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ConfigGovernanceService } from "../../../../../src/platform/control-plane/config-center/config-governance-service.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

function seedConfigTree(root: string, overrides: Record<string, string> = {}): void {
  const files: Record<string, string> = {
    "bootstrap/default.json": JSON.stringify({ appName: "aa", phase: "phase_2a", stableCoreEnabled: true }, null, 2),
    "gateways/default.json": JSON.stringify({ defaultGateway: "cli", sseEnabled: true }, null, 2),
    "providers/default.json": JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }, null, 2),
    "providers/models.json": JSON.stringify({
      version: "test-registry",
      providers: {
        openai: { status: "active", authMethods: ["api_key"] },
        anthropic: { status: "active", authMethods: ["api_key"] },
      },
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
        balanced: {
          provider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          tier: "balanced",
          capabilities: ["reasoning"],
          contextWindowTokens: 200000,
          maxOutputTokens: 64000,
          pricing: { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
          metadataSource: "local_override",
        },
      },
    }, null, 2),
    "runtime/default.json": JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }, null, 2),
    "security/default.json": JSON.stringify({
      approvalMode: "supervised",
      sandboxMode: "workspace_write",
      allowDestructiveActions: false,
      remoteWorkerRegistration: {
        challengeTtlMs: 300000,
        allowedCapabilities: ["bash", "edit", "mcp"],
      },
    }, null, 2),
    "workflows/default.json": JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }, null, 2),
    ...overrides,
  };

  for (const [relativePath, content] of Object.entries(files)) {
    createFile(join(root, relativePath), content);
  }
}

test("config governance service loads a bundle, versions it, and detects tampering", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });

    const original = service.loadBundle("dev");
    createFile(
      join(configRoot, "runtime/default.json"),
      JSON.stringify({ maxConcurrentTasks: 4, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }, null, 2),
    );
    const tamper = service.detectTampering(original.version.versionId, "dev");

    assert.equal(original.issues.length, 0);
    assert.equal(typeof original.version.versionId, "string");
    assert.equal(tamper.tampered, true);
    assert.ok(tamper.issues.includes("config.version_mismatch"));
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service diffs bundles and enforces prod restrictions", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });

    const before = service.loadBundle("dev");
    createFile(
      join(configRoot, "security/default.json"),
      JSON.stringify({ approvalMode: "supervised", sandboxMode: "restricted_exec", allowDestructiveActions: true }, null, 2),
    );
    const after = service.loadBundle("prod");
    const diff = service.diffBundles(before, after);

    assert.ok(diff.some((entry) => entry.path === "security.allowDestructiveActions" && entry.changeType === "changed"));
    assert.ok(after.issues.includes("config.prod_destructive_actions_denied"));
    assert.ok(after.issues.includes("config.invalid_security.sandboxMode") === false);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service accepts JSONC layer files with comments and trailing commas", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "runtime/default.json": `{
        // runtime defaults
        "maxConcurrentTasks": 2,
        "defaultTaskTimeoutMs": 300000,
        /* step timeout stays explicit */
        "defaultStepTimeoutMs": 120000,
      }`,
      "security/default.json": `{
        "approvalMode": "supervised",
        "sandboxMode": "workspace_write",
        "allowDestructiveActions": false, // keep prod-safe
        "remoteWorkerRegistration": {
          "challengeTtlMs": 300000,
          "allowedCapabilities": ["bash", "edit", "mcp"],
        },
      }`,
    });

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const bundle = service.loadBundle("dev");

    assert.equal(bundle.issues.length, 0);
    assert.equal(bundle.layers.runtime?.defaultTaskTimeoutMs, 300000);
    assert.equal(bundle.layers.security?.sandboxMode, "workspace_write");
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service still rejects malformed JSONC after comment stripping", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "runtime/default.json": `{
        "maxConcurrentTasks": 2,
        "defaultTaskTimeoutMs": ,
        "defaultStepTimeoutMs": 120000
      }`,
    });

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });

    assert.throws(() => service.loadBundle("dev"), /config\.invalid_json:.*runtime\/default\.json/);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service validates provider defaults against models registry", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "providers/default.json": JSON.stringify(
        { defaultProvider: "anthropic", defaultModelProfile: "reasoning-medium" },
        null,
        2,
      ),
    });

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle.issues.includes("config.invalid_providers.defaultModelProfileProviderMismatch"));
    assert.equal(bundle.issues.includes("config.invalid_providers.defaultModelProfileRegistryRef"), false);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service validates remote worker registration policy", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "security/default.json": JSON.stringify({
        approvalMode: "supervised",
        sandboxMode: "workspace_write",
        allowDestructiveActions: false,
        remoteWorkerRegistration: {
          challengeTtlMs: 0,
          allowedCapabilities: [],
        },
      }, null, 2),
    });

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle.issues.includes("config.invalid_security.remoteWorkerRegistration.challengeTtlMs"));
    assert.ok(bundle.issues.includes("config.invalid_security.remoteWorkerRegistration.allowedCapabilities"));
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service validates the cross-division DAG feature flag shape", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "workflows/default.json": JSON.stringify({
        defaultWorkflowId: "single_agent_minimal",
        allowCrossDivisionDag: "sometimes",
      }, null, 2),
    });

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle.issues.includes("config.invalid_workflows.allowCrossDivisionDag"));
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance service validates bundle field types and integer ranges through schemas", () => {
  const workspace = createTempWorkspace("aa-config-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "bootstrap/default.json": JSON.stringify({ appName: "aa", phase: "phase_2a", stableCoreEnabled: "yes" }, null, 2),
      "gateways/default.json": JSON.stringify({ defaultGateway: "  ", sseEnabled: "sometimes" }, null, 2),
      "runtime/default.json": JSON.stringify({
        maxConcurrentTasks: 1.5,
        defaultTaskTimeoutMs: 300000,
        defaultStepTimeoutMs: 120000,
        maxAgentRounds: 0,
        maxToolCalls: "many",
      }, null, 2),
      "security/default.json": JSON.stringify({
        approvalMode: " ",
        sandboxMode: "workspace_write",
        allowDestructiveActions: "false",
        remoteWorkerRegistration: {
          challengeTtlMs: 300000,
          allowedCapabilities: ["bash", " "],
        },
      }, null, 2),
    });

    const service = new ConfigGovernanceService({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle.issues.includes("config.invalid_bootstrap.stableCoreEnabled"));
    assert.ok(bundle.issues.includes("config.invalid_gateways.defaultGateway"));
    assert.ok(bundle.issues.includes("config.invalid_gateways.sseEnabled"));
    assert.ok(bundle.issues.includes("config.invalid_runtime.maxConcurrentTasks"));
    assert.ok(bundle.issues.includes("config.invalid_runtime.maxAgentRounds"));
    assert.ok(bundle.issues.includes("config.invalid_runtime.maxToolCalls"));
    assert.ok(bundle.issues.includes("config.invalid_security.approvalMode"));
    assert.ok(bundle.issues.includes("config.invalid_security.allowDestructiveActions"));
    assert.ok(bundle.issues.includes("config.invalid_security.remoteWorkerRegistration.allowedCapabilities"));
  } finally {
    cleanupPath(workspace);
  }
});
