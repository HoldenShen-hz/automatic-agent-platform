/**
 * Golden Test: Configuration Bundle Generation
 *
 * Verifies configuration bundle generation produces expected structure
 * with proper layer organization, hashes, and versioning.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { ConfigGovernanceService } from "../../src/platform/control-plane/config-center/config-governance-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";

function writeLayerConfig(configRoot: string, layerName: string, value: Record<string, unknown>): void {
  const layerRoot = join(configRoot, layerName);
  mkdirSync(layerRoot, { recursive: true });
  writeFileSync(join(layerRoot, "default.json"), JSON.stringify(value));
}

function writeModelRegistry(configRoot: string): void {
  const providersRoot = join(configRoot, "providers");
  mkdirSync(providersRoot, { recursive: true });
  writeFileSync(join(providersRoot, "models.json"), JSON.stringify({
    version: "test.local",
    providers: {
      minimax: {
        status: "active",
        authMethods: ["api_key"],
      },
    },
    profiles: {
      balanced: {
        provider: "minimax",
        modelId: "MiniMax-M1",
        tier: "balanced",
        capabilities: ["reasoning", "tool_use"],
        contextWindowTokens: 204800,
        maxOutputTokens: 65536,
        pricing: {
          inputPer1kUsd: 0.003,
          outputPer1kUsd: 0.015,
        },
        metadataSource: "local_override",
      },
    },
  }));
}

function createValidConfigRoot(workspace: string): string {
  const configRoot = join(workspace, "config");
  mkdirSync(configRoot, { recursive: true });

  writeLayerConfig(configRoot, "bootstrap", {
    appName: "automatic-agent",
    phase: "stable",
    stableCoreEnabled: true,
    dependencyOrder: ["config", "providers", "runtime"],
    healthCheckTimeoutMs: 30000,
    degradationPolicy: {
      onRegistryLookupFailure: "fail_closed",
      onOptionalServiceFailure: "degrade",
      onCriticalServiceFailure: "halt",
    },
    readinessGates: ["config_loaded", "providers_ready"],
  });
  writeLayerConfig(configRoot, "gateways", {
    defaultGateway: "primary",
    sseEnabled: true,
  });
  writeLayerConfig(configRoot, "providers", {
    defaultProvider: "minimax",
    defaultModelProfile: "balanced",
  });
  writeLayerConfig(configRoot, "runtime", {
    defaultTaskTimeoutMs: 60000,
    defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 4,
    maxAgentRounds: 8,
    maxToolCalls: 16,
  });
  writeLayerConfig(configRoot, "security", {
    approvalMode: "required",
    sandboxMode: "workspace_write",
    allowDestructiveActions: false,
    remoteWorkerRegistration: {
      challengeTtlMs: 300000,
      allowedCapabilities: ["read", "write"],
    },
  });
  writeLayerConfig(configRoot, "workflows", {
    defaultWorkflowId: "single_agent_minimal",
    allowCrossDivisionDag: false,
  });
  writeModelRegistry(configRoot);

  return configRoot;
}

test("golden: config governance service loads bundle structure", () => {
  const workspace = createTempWorkspace("aa-golden-config-");

  try {
    const configRoot = createValidConfigRoot(workspace);

    const service = new ConfigGovernanceService({ configRoot });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle, "Bundle should be loaded");
    assert.ok(bundle.version, "Should have version");
    assert.ok(bundle.layers, "Should have layers");
    assert.equal(bundle.issues.length, 0, "Valid bundle should not report issues");
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: config bundle version structure", () => {
  const workspace = createTempWorkspace("aa-golden-config-version-");

  try {
    const configRoot = createValidConfigRoot(workspace);

    const service = new ConfigGovernanceService({ configRoot });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle.version.versionId, "Version ID should exist");
    assert.ok(bundle.version.generatedAt, "Generated at should exist");
    assert.ok(bundle.version.layerHashes, "Layer hashes should exist");
    assert.match(bundle.version.versionId, /^[0-9a-f]{16}$/i, "Version ID should be a 16-char hash prefix");
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: config layer hashes are deterministic", () => {
  const workspace = createTempWorkspace("aa-golden-config-hashes-");

  try {
    const configRoot = createValidConfigRoot(workspace);
    writeLayerConfig(configRoot, "runtime", {
      defaultTaskTimeoutMs: 60000,
      defaultStepTimeoutMs: 10000,
      maxConcurrentTasks: 4,
      maxAgentRounds: 8,
      maxToolCalls: 16,
      testKey: "testValue",
      number: 42,
      array: [1, 2, 3],
    });

    const service1 = new ConfigGovernanceService({ configRoot });
    const service2 = new ConfigGovernanceService({ configRoot });
    const bundle1 = service1.loadBundle("dev");
    const bundle2 = service2.loadBundle("dev");

    const runtimeHash1 = bundle1.version.layerHashes["runtime"];
    const runtimeHash2 = bundle2.version.layerHashes["runtime"];

    assert.equal(runtimeHash1, runtimeHash2, "Same layer should produce same hash");
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: config bundle load handles missing layers gracefully", () => {
  const workspace = createTempWorkspace("aa-golden-config-missing-");

  try {
    const configRoot = join(workspace, "config");
    mkdirSync(configRoot, { recursive: true });
    writeLayerConfig(configRoot, "runtime", {
      defaultTaskTimeoutMs: 60000,
      defaultStepTimeoutMs: 10000,
      maxConcurrentTasks: 4,
    });

    const service = new ConfigGovernanceService({ configRoot });
    const bundle = service.loadBundle("nonexistent");

    assert.ok(bundle.issues.includes("config.missing_layer:bootstrap"));
    assert.ok(bundle.issues.includes("config.missing_layer:gateways"));
    assert.ok(bundle.issues.includes("config.missing_layer:providers"));
    assert.ok(bundle.issues.includes("config.missing_layer:security"));
    assert.ok(bundle.issues.includes("config.missing_layer:workflows"));
  } finally {
    cleanupPath(workspace);
  }
});
