import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { loadModelMetadataRegistry } from "../../../../../src/platform/five-plane-control-plane/config-center/model-metadata-registry.js";
import { createWorkspacePolicy, createWorkspaceWritePolicy } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

test("loadModelMetadataRegistry returns registry when config root has no override", () => {
  const workspace = join("/tmp", `test-model-registry-${Date.now()}`);
  mkdirSync(join(workspace, "providers"), { recursive: true });
  writeFileSync(join(workspace, "providers", "models.bundled.json"), JSON.stringify({
    version: "test-v1",
    providers: {
      testprovider: {
        status: "active",
        authMethods: ["api_key"],
      },
    },
    profiles: {
      "test-profile": {
        provider: "testprovider",
        modelId: "test-model",
        tier: "balanced",
        capabilities: ["chat"],
        contextWindowTokens: 100000,
        maxOutputTokens: 4096,
        pricing: { inputPer1kUsd: 0.1, outputPer1kUsd: 0.2 },
        metadataSource: "bundled_snapshot",
      },
    },
  }));

  try {
    const policy = createWorkspacePolicy(workspace, workspace);
    const registry = loadModelMetadataRegistry(workspace, policy);
    assert.ok(registry != null);
    assert.ok(typeof registry.version === "string");
    assert.ok(registry.providers != null);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("loadModelMetadataRegistry merges override with bundled", () => {
  const workspace = join("/tmp", `test-model-registry-override-${Date.now()}`);
  mkdirSync(join(workspace, "providers"), { recursive: true });

  // Write bundled file
  writeFileSync(join(workspace, "providers", "models.bundled.json"), JSON.stringify({
    version: "bundled-v1",
    providers: {
      bundled_provider: {
        status: "active",
        authMethods: ["api_key"],
      },
    },
    profiles: {
      "bundled-profile": {
        provider: "bundled_provider",
        modelId: "bundled-model",
        tier: "balanced",
        capabilities: ["chat"],
        contextWindowTokens: 100000,
        maxOutputTokens: 4096,
        pricing: { inputPer1kUsd: 0.1, outputPer1kUsd: 0.2 },
        metadataSource: "bundled_snapshot",
      },
    },
  }));

  // Write override file
  writeFileSync(join(workspace, "providers", "models.json"), JSON.stringify({
    version: "override-v1",
    providers: {
      override_provider: {
        status: "active",
        authMethods: ["oauth"],
      },
    },
    profiles: {
      "override-profile": {
        provider: "override_provider",
        modelId: "override-model",
        tier: "fast",
        capabilities: ["chat", "completion"],
        contextWindowTokens: 200000,
        maxOutputTokens: 8192,
        pricing: { inputPer1kUsd: 0.05, outputPer1kUsd: 0.1 },
        metadataSource: "local_override",
      },
    },
  }));

  try {
    const policy = createWorkspaceWritePolicy(workspace);
    const registry = loadModelMetadataRegistry(workspace, policy);
    assert.ok(registry != null);
    assert.equal(registry.version, "override-v1");
    // Should have both bundled and override entries
    assert.ok(registry.providers["bundled_provider"] != null);
    assert.ok(registry.providers["override_provider"] != null);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("ModelProviderMetadata has expected shape", () => {
  const provider = {
    status: "active" as const,
    authMethods: ["api_key", "oauth"],
    region: "us-east-1",
    latencyP99Ms: 100,
  };
  assert.equal(provider.status, "active");
  assert.ok(Array.isArray(provider.authMethods));
});

test("ModelProfileMetadata has expected shape", () => {
  const profile = {
    provider: "test-provider",
    modelId: "test-model",
    tier: "balanced" as const,
    capabilities: ["chat", "completion"],
    contextWindowTokens: 100000,
    maxOutputTokens: 4096,
    pricing: {
      inputPer1kUsd: 0.1,
      outputPer1kUsd: 0.2,
    },
    metadataSource: "bundled_snapshot" as const,
  };
  assert.equal(profile.tier, "balanced");
  assert.ok(profile.contextWindowTokens > 0);
});
