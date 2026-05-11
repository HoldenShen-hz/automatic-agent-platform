import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { RecipeExecutor } from "../../../src/domains/recipes/recipe-executor.js";
import { DomainRecipeSchema } from "../../../src/domains/recipes/index.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { ForkedPluginRuntimeHost } from "../../../src/domains/registry/plugin-runtime-host.js";
import {
  parsePluginRuntimeChildMessage,
  parsePluginRuntimeMessage,
} from "../../../src/domains/registry/plugin-runtime-protocol.js";
import type { PluginSandboxPolicy } from "../../../src/domains/registry/plugin-spi.js";
import {
  ApprovalRouteRequestSchema,
  getFxRateProvider,
  resolveApprovalRoute,
} from "../../../src/org-governance/approval-routing/route-engine/index.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

function createSandboxPolicy(overrides: Partial<PluginSandboxPolicy> = {}): PluginSandboxPolicy {
  return {
    timeoutMs: 5_000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 4,
    runtimeIsolation: "forked_process",
    cooldownMs: 0,
    allowedExternalDomains: [],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

class ExposedPluginRuntimeHost extends ForkedPluginRuntimeHost {
  public receive(message: unknown): void {
    this.handleMessage(message);
  }
}

test("R30-36: resolveApprovalRoute fails closed when SoD removes every approver", () => {
  const nodes: readonly OrgNode[] = [
    {
      orgNodeId: "team-1",
      nodeType: "team",
      displayName: "Team 1",
      parentOrgNodeId: null,
      ownerUserIds: ["requester-1"],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];

  assert.throws(
    () => resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
      requesterId: "requester-1",
      orgNodeId: "team-1",
      riskLevel: "high",
    })),
    /approval_route\.empty_approver_chain/,
  );
});

test("R30-37: plugin runtime protocol rejects malformed messages and host treats them as violations", () => {
  assert.throws(() => parsePluginRuntimeMessage({
    type: "response",
    ok: true,
    pid: 123,
  }), /requestId/i);
  assert.throws(() => parsePluginRuntimeChildMessage({
    type: "request",
    requestId: "",
    pluginId: "plugin.demo",
    action: "present",
    context: null,
  }), /requestId/i);

  let unexpectedExit: boolean | null = null;
  const host = new ExposedPluginRuntimeHost({
    pluginId: "plugin.coding.presenter",
    isolation: "forked_process",
    sandboxPolicy: createSandboxPolicy(),
    workspaceRoot: process.cwd(),
    onExit: (unexpected) => {
      unexpectedExit = unexpected;
    },
  });
  host.receive({ type: "response", ok: true, pid: 123 });
  assert.equal(unexpectedExit, true);
});

test("R30-38: RecipeExecutor fails closed when no workflow registry is supplied", async () => {
  const executor = new RecipeExecutor();
  const recipe = DomainRecipeSchema.parse({
    recipeId: "recipe-without-registry",
    domainId: "coding",
    name: "Recipe without registry",
    triggerPhrases: [],
    defaultWorkflowId: "wf_unregistered",
    defaultToolBundleIds: [],
  });

  const result = await executor.execute(recipe, {
    executionId: "exec-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    correlationId: "corr-1",
    input: "test",
  });

  assert.equal(result.success, false);
  assert.match(result.error ?? "", /not available/i);
});

test("R30-39: plugin runtime child uses stdin buffer naming for stdin protocol accumulation", () => {
  const source = readFileSync("src/domains/registry/plugin-runtime-child.ts", "utf8");
  assert.match(source, /\blet stdinBuffer = "";/);
  assert.ok(!source.includes("stdoutBuffer +="));
});

test("R30-40: DomainRegistryService.deprecate only allows active domains", () => {
  const service = new DomainRegistryService();
  service.register({
    domainId: "draft-domain",
    name: "Draft Domain",
    description: "draft",
    version: 1,
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: [],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
  }, { skipSmokeTest: true });

  assert.throws(
    () => service.deprecate("draft-domain"),
    (error: unknown) =>
      error instanceof Error
      && "code" in error
      && (error as { code?: string }).code === "domain_registry.invalid_deprecate_state",
  );
});

test("R30-41: route engine uses configurable FX rate and rejects stale FX snapshots", async () => {
  const previousRate = process.env["APPROVAL_ROUTE_USD_CNY_RATE"];
  const previousSource = process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"];
  process.env["APPROVAL_ROUTE_USD_CNY_RATE"] = "6.91";
  process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"] = "test_env_rate";

  try {
    const provider = getFxRateProvider();
    assert.equal(await provider.getRate("USD", "CNY"), 6.91);
    assert.equal(provider.source, "test_env_rate");
  } finally {
    if (previousRate === undefined) {
      delete process.env["APPROVAL_ROUTE_USD_CNY_RATE"];
    } else {
      process.env["APPROVAL_ROUTE_USD_CNY_RATE"] = previousRate;
    }
    if (previousSource === undefined) {
      delete process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"];
    } else {
      process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"] = previousSource;
    }
  }

  const nodes: readonly OrgNode[] = [
    {
      orgNodeId: "team-1",
      nodeType: "team",
      displayName: "Team 1",
      parentOrgNodeId: null,
      ownerUserIds: ["owner-1"],
      active: true,
      costCenter: "",
      metadata: {},
    },
  ];

  assert.throws(
    () => resolveApprovalRoute(nodes, ApprovalRouteRequestSchema.parse({
      requesterId: "requester-1",
      orgNodeId: "team-1",
      riskLevel: "medium",
      amount: {
        value: 100,
        currency: "USD",
        fxRateSnapshot: {
          baseCurrency: "USD",
          quoteCurrency: "CNY",
          rate: 7.1,
          source: "stale_treasury",
          capturedAt: "1970-01-01T00:00:00.000Z",
        },
      },
    })),
    /approval_route\.fx_snapshot_stale/,
  );
});

test("R30-42: no tracked sync-backed async backup file remains in source tree", () => {
  assert.equal(existsSync("src/platform/shared/async/sync-backed-async-service.ts.bak"), false);
  assert.equal(existsSync("src/shared/async/sync-backed-async-service.ts.bak"), false);
});
