/**
 * Integration Test: Config Governance
 *
 * Verifies ConfigGovernanceService integration with hierarchical config loading,
 * bundle validation, tamper detection, and cross-layer merge semantics.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";

import { ConfigGovernanceService } from "../../../../../src/platform/five-plane-control-plane/config-center/config-governance-service.js";
import { HierarchicalConfigLoader } from "../../../../../src/platform/five-plane-control-plane/config-center/hierarchical-config-loader.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function seedFullConfigTree(root: string): void {
  mkdirSync(join(root, "bootstrap"), { recursive: true });
  mkdirSync(join(root, "gateways"), { recursive: true });
  mkdirSync(join(root, "providers"), { recursive: true });
  mkdirSync(join(root, "runtime"), { recursive: true });
  mkdirSync(join(root, "security"), { recursive: true });
  mkdirSync(join(root, "workflows"), { recursive: true });

  writeFileSync(join(root, "bootstrap/default.json"), JSON.stringify({
    appName: "automatic-agent",
    phase: "phase_2a",
    stableCoreEnabled: true,
    dependencyOrder: ["init", "runtime", "ready"],
    readinessGates: ["gate-1", "gate-2"],
    degradationPolicy: {
      onReadinessFailure: "degrade",
      allowSummaryMode: true,
    },
    healthCheckTimeoutMs: 5000,
    readinessProbe: {
      initialDelayMs: 1000,
      intervalMs: 5000,
      timeoutMs: 3000,
      failureThreshold: 3,
    },
  }));

  writeFileSync(join(root, "gateways/default.json"), JSON.stringify({
    defaultGateway: "cli",
    sseEnabled: true,
  }));

  writeFileSync(join(root, "providers/default.json"), JSON.stringify({
    defaultProvider: "openai",
    defaultModelProfile: "reasoning-medium",
  }));

  writeFileSync(join(root, "providers/models.json"), JSON.stringify({
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

  writeFileSync(join(root, "runtime/default.json"), JSON.stringify({
    configVersion: "1.0.0",
    configSchemaVersion: "1.0",
    defaultTaskTimeoutMs: 300000,
    defaultStepTimeoutMs: 120000,
    maxConcurrentTasks: 2,
    apiDefaultTimeoutMs: 30000,
    apiMaxTimeoutMs: 300000,
    retryMax: 3,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 1000,
    },
    configDriftReconciler: {
      interval: 60000,
    },
  }));

  writeFileSync(join(root, "security/default.json"), JSON.stringify({
    approvalMode: "supervised",
    sandboxMode: "workspace_write",
    allowDestructiveActions: false,
    remoteWorkerRegistration: {
      challengeTtlMs: 300000,
      allowedCapabilities: ["bash", "edit", "mcp"],
    },
  }));

  writeFileSync(join(root, "workflows/default.json"), JSON.stringify({
    defaultWorkflowId: "single_agent_minimal",
    allowCrossDivisionDag: false,
  }));
}

function seedDevOverride(root: string): void {
  mkdirSync(join(root, "runtime"), { recursive: true });
  writeFileSync(join(root, "runtime/dev.json"), JSON.stringify({
    maxConcurrentTasks: 5,
    defaultTaskTimeoutMs: 600000,
  }));
}

test("config governance: loads complete bundle with all required layers", () => {
  const workspace = createTempWorkspace("aa-cfg-full-");
  try {
    seedFullConfigTree(workspace);
    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle.version.versionId, "Bundle should have versionId");
    assert.ok(bundle.version.bundleHash, "Bundle should have bundleHash");
    assert.strictEqual(bundle.environment, "dev");
    assert.strictEqual(realpathSync(bundle.configRoot), realpathSync(workspace));

    assert.ok(bundle.layers.bootstrap, "Should have bootstrap layer");
    assert.ok(bundle.layers.gateways, "Should have gateways layer");
    assert.ok(bundle.layers.providers, "Should have providers layer");
    assert.ok(bundle.layers.runtime, "Should have runtime layer");
    assert.ok(bundle.layers.security, "Should have security layer");
    assert.ok(bundle.layers.workflows, "Should have workflows layer");

    assert.equal(bundle.issues.length, 0, "Bundle should have no issues");
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: dev override merges on top of default runtime values", () => {
  const workspace = createTempWorkspace("aa-cfg-override-");
  try {
    seedFullConfigTree(workspace);
    seedDevOverride(workspace);
    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("dev");

    // Override should take effect: maxConcurrentTasks=5 (dev) instead of 2 (default)
    assert.strictEqual(bundle.layers.runtime!.maxConcurrentTasks, 5);
    // Non-overridden: defaultStepTimeoutMs=120000 should remain from default.json
    assert.strictEqual(bundle.layers.runtime!.defaultStepTimeoutMs, 120000);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: bundle validation catches missing required layers", () => {
  const workspace = createTempWorkspace("aa-cfg-missing-");
  try {
    mkdirSync(join(workspace, "bootstrap"), { recursive: true });
    writeFileSync(join(workspace, "bootstrap/default.json"), JSON.stringify({ appName: "test" }));
    // Missing gateways, providers, runtime, security, workflows

    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("dev");

    const missingIssues = bundle.issues.filter((i: string) => i.startsWith("config.missing_layer:"));
    assert.ok(missingIssues.length >= 5, `Should have at least 5 missing layer issues, got: ${missingIssues.join(", ")}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: bundle validation catches invalid provider registry references", () => {
  const workspace = createTempWorkspace("aa-cfg-badprovider-");
  try {
    seedFullConfigTree(workspace);
    // Override providers to reference a non-existent provider and profile
    mkdirSync(join(workspace, "providers"), { recursive: true });
    writeFileSync(join(workspace, "providers/default.json"), JSON.stringify({
      defaultProvider: "nonexistent-provider",
      defaultModelProfile: "nonexistent-profile",
    }));
    // Restore models.json for registry
    writeFileSync(join(workspace, "providers/models.json"), JSON.stringify({
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

    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("dev");

    const providerIssues = bundle.issues.filter((i: string) =>
      i.includes("defaultProviderRegistryRef") || i.includes("defaultModelProfileRegistryRef")
    );
    assert.ok(providerIssues.length >= 1, `Should have invalid provider issues, got: ${bundle.issues.join(", ")}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: prod environment requires allowDestructiveActions=false", () => {
  const workspace = createTempWorkspace("aa-cfg-prod-");
  try {
    seedFullConfigTree(workspace);
    mkdirSync(join(workspace, "security"), { recursive: true });
    // Override security to allow destructive actions
    writeFileSync(join(workspace, "security/default.json"), JSON.stringify({
      approvalMode: "supervised",
      sandboxMode: "workspace_write",
      allowDestructiveActions: true,
    }));

    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("prod");

    assert.ok(bundle.issues.includes("config.prod_destructive_actions_denied"),
      `Should flag prod destructive actions, issues: ${bundle.issues.join(", ")}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: detectTampering returns tampered=false for clean bundle", () => {
  const workspace = createTempWorkspace("aa-cfg-tamper-");
  try {
    seedFullConfigTree(workspace);
    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("dev");

    const detection = service.detectTampering(bundle.version.versionId, "dev");
    assert.strictEqual(detection.tampered, false);
    assert.strictEqual(detection.currentVersion, bundle.version.versionId);
    assert.deepStrictEqual(detection.issues, []);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: detectTampering returns tampered=true when version changes", () => {
  const workspace = createTempWorkspace("aa-cfg-tamper-check-");
  try {
    seedFullConfigTree(workspace);
    const service = new ConfigGovernanceService({ configRoot: workspace });
    const originalBundle = service.loadBundle("dev");
    const originalVersionId = originalBundle.version.versionId;

    // Modify a layer file
    writeFileSync(join(workspace, "runtime", "default.json"), JSON.stringify({
      maxConcurrentTasks: 99,
      defaultTaskTimeoutMs: 999999,
      defaultStepTimeoutMs: 999999,
    }));

    const detection = service.detectTampering(originalVersionId, "dev");
    assert.strictEqual(detection.tampered, true);
    assert.notStrictEqual(detection.currentVersion, originalVersionId);
    assert.ok(detection.issues.includes("config.version_mismatch"), `Should include version mismatch, got: ${detection.issues.join(", ")}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: diffBundles reports layer value changes", () => {
  const workspace = createTempWorkspace("aa-cfg-diff-");
  try {
    seedFullConfigTree(workspace);
    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundleBefore = service.loadBundle("dev");

    // Modify runtime config
    writeFileSync(join(workspace, "runtime", "default.json"), JSON.stringify({
      maxConcurrentTasks: 99,
      defaultTaskTimeoutMs: 300000,
      defaultStepTimeoutMs: 120000,
    }));

    const bundleAfter = service.loadBundle("dev");
    const diffs = service.diffBundles(bundleBefore, bundleAfter);

    assert.ok(diffs.length >= 1, "Should have at least one diff");
    const runtimeDiffs = diffs.filter(d => d.path.startsWith("runtime."));
    assert.ok(runtimeDiffs.length >= 1, "Should have runtime diffs");
  } finally {
    cleanupPath(workspace);
  }
});

test("config governance: loads bundle with JSONC comments without widening access", () => {
  const workspace = createTempWorkspace("aa-cfg-jsonc-");
  try {
    seedFullConfigTree(workspace);
    mkdirSync(join(workspace, "runtime"), { recursive: true });
    writeFileSync(join(workspace, "runtime/default.json"), `{
      // This is a comment within allowed workspace
      "configVersion": "1.0.0",
      "configSchemaVersion": "1.0",
      "maxConcurrentTasks": 3,
      "defaultTaskTimeoutMs": 300000,
      "defaultStepTimeoutMs": 120000,
      "apiDefaultTimeoutMs": 30000,
      "apiMaxTimeoutMs": 300000,
      "retryMax": 3,
      "circuitBreaker": { "enabled": true, "threshold": 5 },
      "rateLimit": { "enabled": true, "requestsPerMinute": 1000 },
      "configDriftReconciler": { "interval": 60000 }
    }`);

    const service = new ConfigGovernanceService({ configRoot: workspace });
    const bundle = service.loadBundle("dev");

    assert.strictEqual(bundle.layers.runtime!.maxConcurrentTasks, 3);
    assert.equal(bundle.issues.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("hierarchical config loader: merges platform then tenant then pack then task_type", () => {
  const loader = new HierarchicalConfigLoader();

  const platformConfig = { logLevel: "info", maxRetries: 3 };
  const tenantConfigs = { "tenant-1": { logLevel: "debug", timeout: 5000 } };
  const packConfigs = { "pack-a": { timeout: 10000, poolSize: 10 } };
  const taskTypeConfigs = { "task-type-1": { poolSize: 20 } };

  const result = loader.loadConfig(
    platformConfig,
    tenantConfigs,
    packConfigs,
    taskTypeConfigs,
    "tenant-1",
    "pack-a",
    "task-type-1",
  );

  // Most specific wins: task_type poolSize=20, platform logLevel=info (not overridden)
  assert.strictEqual(result.merged.logLevel, "debug"); // tenant override
  assert.strictEqual(result.merged.maxRetries, 3);    // platform default
  assert.strictEqual(result.merged.timeout, 10000);    // pack override
  assert.strictEqual(result.merged.poolSize, 20);     // task_type override

  assert.strictEqual(result.sources.length, 4);
  assert.strictEqual(result.sources[0]!.layer, "platform");
  assert.strictEqual(result.sources[3]!.layer, "task_type");
  assert.strictEqual(result.layerMap.logLevel, "tenant");
  assert.strictEqual(result.layerMap.poolSize, "task_type");
});

test("hierarchical config loader: handles missing intermediate layers gracefully", () => {
  const loader = new HierarchicalConfigLoader();

  const platformConfig = { logLevel: "info" };
  // tenant-99 does not exist, pack-a exists, task-type-1 exists
  const packConfigs = { "pack-a": { timeout: 10000 } };
  const taskTypeConfigs = { "task-type-1": { poolSize: 20 } };

  const result = loader.loadConfig(
    platformConfig,
    {},
    packConfigs,
    taskTypeConfigs,
    "tenant-99",  // non-existent
    "pack-a",
    "task-type-1",
  );

  assert.strictEqual(result.merged.logLevel, "info");
  assert.strictEqual(result.merged.timeout, 10000);
  assert.strictEqual(result.merged.poolSize, 20);
  assert.strictEqual(result.sources.length, 3);
  assert.strictEqual(result.sources[0]!.layer, "platform");
});

test("hierarchical config loader: deep merges nested objects", () => {
  const loader = new HierarchicalConfigLoader();

  const baseConfig = {
    auth: { provider: "oidc", timeout: 5000 },
    network: { maxConnections: 100 },
  };
  const overrideConfig = {
    auth: { timeout: 10000 },  // Only override auth.timeout
    network: { maxConnections: 200 },
  };

  const result = loader.loadConfig(
    baseConfig,
    { "tenant-x": overrideConfig },
    {},
    {},
    "tenant-x",
  );

  // auth.provider should survive from base (deep merge), auth.timeout overridden
  assert.strictEqual((result.merged.auth as { provider: string; timeout: number }).provider, "oidc");
  assert.strictEqual((result.merged.auth as { provider: string; timeout: number }).timeout, 10000);
  assert.strictEqual((result.merged.network as { maxConnections: number }).maxConnections, 200);
});
