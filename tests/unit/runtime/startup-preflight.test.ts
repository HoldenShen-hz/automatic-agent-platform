import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  buildDefaultStartupConfigValidator,
  buildEnvironmentProviderReadinessProbe,
  deriveProviderApiKeyEnvName,
} from "../../../src/platform/five-plane-execution/startup/startup-preflight.js";
import { createWorkspaceWritePolicy } from "../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../helpers/fs.js";

function seedConfigTree(root: string, overrides: Record<string, string> = {}): void {
  const files: Record<string, string> = {
    "bootstrap/default.json": JSON.stringify({
      appName: "aa",
      phase: "phase_2a",
      stableCoreEnabled: true,
      dependencyOrder: ["bootstrap", "gateways", "providers", "runtime", "security", "workflows"],
      readinessGates: ["config_bundle_loaded", "provider_registry_loaded"],
      degradationPolicy: {
        onReadinessFailure: "block_startup",
        allowSummaryMode: true,
      },
      healthCheckTimeoutMs: 10000,
      readinessProbe: {
        initialDelayMs: 1000,
        intervalMs: 5000,
        timeoutMs: 2000,
        failureThreshold: 3,
      },
    }, null, 2),
    "gateways/default.json": JSON.stringify({ defaultGateway: "cli", sseEnabled: true }, null, 2),
    "providers/default.json": JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }, null, 2),
    "providers/models.json": JSON.stringify({
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
    }, null, 2),
    "runtime/default.json": JSON.stringify({
      configVersion: "test-runtime-v1",
      configSchemaVersion: "1.0.0",
      maxConcurrentTasks: 2,
      defaultTaskTimeoutMs: 300000,
      defaultStepTimeoutMs: 120000,
      apiDefaultTimeoutMs: 30000,
      apiMaxTimeoutMs: 120000,
      retryMax: 3,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
      },
      rateLimit: {
        enabled: true,
        requestsPerMinute: 120,
      },
      configDriftReconciler: {
        interval: 60000,
      },
    }, null, 2),
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

test("startup config validator converts invalid bundles into structured failures [startup-preflight]", () => {
  const workspace = createTempWorkspace("aa-startup-preflight-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot, {
      "runtime/default.json": JSON.stringify({ maxConcurrentTasks: 0, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }, null, 2),
    });

    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const result = validate();

    assert.equal(result.ok, false);
    assert.ok(result.issues.includes("config.invalid_runtime.maxConcurrentTasks"));
    assert.equal(result.bundle?.configRoot.endsWith("/config"), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("startup provider readiness probe requires API key credentials for the default provider [startup-preflight]", () => {
  const workspace = createTempWorkspace("aa-startup-preflight-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const result = validate();
    const probe = buildEnvironmentProviderReadinessProbe({
      providerEnv: {},
    });
    const findings = probe(result);

    assert.equal(result.ok, true);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.provider, "openai");
    assert.equal(findings[0]?.reasonCode, "provider.credentials_missing");
    assert.match(findings[0]?.message ?? "", new RegExp(deriveProviderApiKeyEnvName("openai")));
  } finally {
    cleanupPath(workspace);
  }
});

test("startup config validator succeeds when all config files are valid [startup-preflight]", () => {
  const workspace = createTempWorkspace("aa-startup-preflight-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const result = validate();

    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("startup provider readiness probe passes when API key is present in env [startup-preflight]", () => {
  const workspace = createTempWorkspace("aa-startup-preflight-");
  const configRoot = join(workspace, "config");

  try {
    seedConfigTree(configRoot);
    const validate = buildDefaultStartupConfigValidator({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    const result = validate();
    const probe = buildEnvironmentProviderReadinessProbe({
      providerEnv: {
        [deriveProviderApiKeyEnvName("openai")]: "sk-test-openai-key",
      },
    });
    const findings = probe(result);

    assert.equal(result.ok, true);
    assert.equal(findings.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("deriveProviderApiKeyEnvName returns correct env var name format [startup-preflight]", () => {
  assert.equal(deriveProviderApiKeyEnvName("anthropic"), "ANTHROPIC_API_KEY");
  assert.equal(deriveProviderApiKeyEnvName("openai"), "OPENAI_API_KEY");
  assert.equal(deriveProviderApiKeyEnvName("minimax"), "MINIMAX_API_KEY");
});
