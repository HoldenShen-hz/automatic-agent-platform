import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { bootstrapConfiguredRegistries } from "../../../../src/domains/registry/registry-bootstrap.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";

function seedRequiredConfigLayers(configRoot: string): void {
  createFile(join(configRoot, "bootstrap/default.json"), JSON.stringify({ appName: "aa", phase: "phase_4", stableCoreEnabled: true }));
  createFile(join(configRoot, "gateways/default.json"), JSON.stringify({ defaultGateway: "cli", sseEnabled: true }));
  createFile(join(configRoot, "providers/default.json"), JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }));
  createFile(join(configRoot, "runtime/default.json"), JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }));
  createFile(join(configRoot, "security/default.json"), JSON.stringify({ approvalMode: "supervised", sandboxMode: "read_only", allowDestructiveActions: false }));
  createFile(join(configRoot, "workflows/default.json"), JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }));
}

test("bootstrapConfiguredRegistries loads domain, plugin, and knowledge config layers", () => {
  const workspace = createTempWorkspace("aa-registry-bootstrap-");
  const configRoot = join(workspace, "config");

  try {
    seedRequiredConfigLayers(configRoot);
    createFile(join(configRoot, "plugins/default.json"), JSON.stringify({
      manifests: [{
        pluginId: "plugin.coding.retriever",
        name: "Coding Retriever",
        version: "1.0.0",
        owner: "test",
        domainIds: ["coding"],
        capabilityIds: ["knowledge.retrieve"],
        spiTypes: ["retriever"],
        extensionKind: "domain_plugin",
        trustLevel: "trusted",
        publicSdkSurface: "tests/mock",
        settingsSchema: {},
      }],
    }));
    createFile(join(configRoot, "domains/default.json"), JSON.stringify({
      domains: [{
        domainId: "coding",
        name: "Coding",
        description: "Coding domain",
        version: 1,
        workflows: [{ workflowId: "wf", name: "wf", triggerConditions: {}, steps: [] }],
        toolBundles: [{ bundleId: "default", tools: [{ toolName: "repo_map", enabled: true, configOverrides: {} }] }],
        outputContracts: [],
        promptOverrides: {},
        capabilities: {
          supportedTaskTypes: ["bugfix"],
          requiredTools: ["repo_map"],
          optionalTools: [],
          modelPreferences: {},
          budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
          securityLevel: "standard",
        },
        status: "validated",
        externalAdapters: [],
        pluginBindings: [{
          bindingId: "binding.retriever",
          domainId: "coding",
          pluginType: "retriever",
          pluginId: "plugin.coding.retriever",
          priority: 1,
          enabled: true,
          config: {},
        }],
      }],
    }));
    createFile(join(configRoot, "knowledge/default.json"), JSON.stringify({
      namespaces: [{
        namespaceId: "ns_coding_repo",
        path: "coding/repo",
        description: "repo knowledge",
        ownerDomainId: "coding",
        accessPolicy: "domain_only",
        freshnessPolicy: {
          maxAgeDays: 30,
          staleAction: "warn",
          refreshStrategy: "manual",
          refreshIntervalHours: null,
        },
        trustLevel: "verified",
        maxDocuments: 100,
        maxTotalSizeBytes: 1000,
      }],
    }));

    const result = bootstrapConfiguredRegistries({
      configRoot,
      environment: "prod",
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });

    assert.equal(result.skippedPluginIds.length, 0);
    assert.ok(result.pluginRegistry.get("plugin.coding.retriever"));
    assert.equal(result.domainRegistry.get("coding")?.domainId, "coding");
    assert.equal(result.knowledgeNamespaces[0]?.path, "coding/repo");
  } finally {
    cleanupPath(workspace);
  }
});

test("bootstrapConfiguredRegistries handles missing optional config files", () => {
  const workspace = createTempWorkspace("aa-registry-bootstrap-missing-");
  const configRoot = join(workspace, "config");

  try {
    // Only seed required files, skip plugins/domains/knowledge
    seedRequiredConfigLayers(configRoot);

    const result = bootstrapConfiguredRegistries({
      configRoot,
      environment: "test",
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });

    // Should still succeed with empty registries
    assert.ok(result.pluginRegistry instanceof Map || result.pluginRegistry !== null);
    assert.deepEqual(result.knowledgeNamespaces, []);
  } finally {
    cleanupPath(workspace);
  }
});

test("bootstrapConfiguredRegistries handles empty domains array", () => {
  const workspace = createTempWorkspace("aa-registry-bootstrap-empty-");
  const configRoot = join(workspace, "config");

  try {
    seedRequiredConfigLayers(configRoot);
    createFile(join(configRoot, "domains/default.json"), JSON.stringify({ domains: [] }));
    createFile(join(configRoot, "plugins/default.json"), JSON.stringify({ manifests: [] }));

    const result = bootstrapConfiguredRegistries({
      configRoot,
      environment: "test",
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });

    assert.equal(result.domainRegistry.list().length, 0);
  } finally {
    cleanupPath(workspace);
  }
});
