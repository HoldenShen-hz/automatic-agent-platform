import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getPlatformArchitectureServices,
  registerPlatformArchitectureServices,
} from "../../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import { createCrmAdapterPlugin } from "../../../src/plugins/adapters/crm-adapter.js";
import { RetryableApiClient } from "../../../src/sdk/client-sdk/api-client.js";
import { definePlugin, enforcePluginSignature } from "../../../src/sdk/plugin-sdk/plugin-definition.js";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

test("1989..1995: security/bootstrap configs, architecture readiness guards, division boundaries, and devops-operations disambiguation stay fixed", async () => {
  const securityDefault = readJson<{
    approvalMode: string;
    sandboxMode: string;
    allowDestructiveActions: boolean;
    remoteWorkerRegistration: { allowedCapabilities: string[] };
  }>("config/security/default.json");
  const bootstrapDefault = readJson<{
    dependencyOrder: string[];
    readinessGates: string[];
    hotReload: { enabled: boolean; reloadStrategies: Record<string, string> };
    impactAnalysis: { enabled: boolean; thresholds: Record<string, number> };
    canaryDeployment: { enabled: boolean; autoRollback: boolean; metrics: Record<string, number> };
    gateHierarchy: Record<string, unknown>;
    healthCheckGates: Record<string, unknown>;
  }>("config/bootstrap/default.json");

  assert.equal(securityDefault.approvalMode, "supervised");
  assert.equal(securityDefault.sandboxMode, "read_only");
  assert.equal(securityDefault.allowDestructiveActions, false);
  assert.ok(!securityDefault.remoteWorkerRegistration.allowedCapabilities.includes("bash"));

  assert.deepEqual(
    bootstrapDefault.dependencyOrder,
    ["bootstrap", "platform", "domains", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "apps", "plugins", "sdk"],
  );
  assert.deepEqual(
    bootstrapDefault.readinessGates,
    ["config_loaded", "service_registry_ready", "startup_targets_registered"],
  );
  assert.equal(bootstrapDefault.hotReload.enabled, true);
  assert.equal(bootstrapDefault.hotReload.reloadStrategies.config, "incremental");
  assert.equal(bootstrapDefault.impactAnalysis.enabled, true);
  assert.equal(bootstrapDefault.impactAnalysis.thresholds.maxImpactScore, 80);
  assert.equal(bootstrapDefault.canaryDeployment.enabled, true);
  assert.equal(bootstrapDefault.canaryDeployment.autoRollback, true);
  assert.equal(bootstrapDefault.canaryDeployment.metrics.errorRateThreshold, 0.05);
  assert.ok("bootstrap" in bootstrapDefault.gateHierarchy);
  assert.ok("bootstrap_l0" in bootstrapDefault.healthCheckGates);

  const registry = ServiceRegistry.createScoped();
  const registered = registerPlatformArchitectureServices(registry);
  assert.equal(registry.has("architecture.layer-catalog"), true);
  assert.equal(registry.has("architecture.bootstrap-summary"), true);
  const resolved = getPlatformArchitectureServices(registry);
  const resolvedAgain = getPlatformArchitectureServices(registry);
  assert.equal(resolved.layers, resolvedAgain.layers);
  assert.equal(resolved.summary, resolvedAgain.summary);
  assert.equal(registered.summary.startupEntryModule, "src/index.ts");
  await registry.reset();

  const divisionFiles = [
    "divisions/academic-research/division.yaml",
    "divisions/advertising/division.yaml",
    "divisions/analytics/division.yaml",
    "divisions/coding/division.yaml",
    "divisions/content-moderation/division.yaml",
    "divisions/content/division.yaml",
    "divisions/customer-service/division.yaml",
    "divisions/data-engineering/division.yaml",
    "divisions/data/division.yaml",
    "divisions/design/division.yaml",
    "divisions/devops/division.yaml",
    "divisions/ecommerce/division.yaml",
    "divisions/engineering_ops/division.yaml",
    "divisions/finance-accounting/division.yaml",
    "divisions/financial-services/division.yaml",
    "divisions/general_ops/division.yaml",
    "divisions/healthcare/division.yaml",
    "divisions/human-resources/division.yaml",
    "divisions/industry-research/division.yaml",
    "divisions/it-operations/division.yaml",
    "divisions/knowledge-base/division.yaml",
    "divisions/legal/division.yaml",
    "divisions/live-streaming/division.yaml",
    "divisions/operations/division.yaml",
    "divisions/product-management/division.yaml",
    "divisions/project-management/division.yaml",
    "divisions/qa/division.yaml",
    "divisions/quality-assurance/division.yaml",
    "divisions/quant-trading/division.yaml",
    "divisions/research/division.yaml",
    "divisions/security/division.yaml",
    "divisions/support/division.yaml",
    "divisions/user-operations/division.yaml",
  ];
  for (const file of divisionFiles) {
    const content = readText(file);
    assert.match(content, /resource_boundaries:/);
    assert.match(content, /fault_domains:/);
  }

  const devopsDivision = readText("divisions/devops/division.yaml");
  const operationsDivision = readText("divisions/operations/division.yaml");
  assert.match(devopsDivision, /disambiguate:/);
  assert.match(operationsDivision, /disambiguate:/);
  assert.match(devopsDivision, /deployment:/);
  assert.match(operationsDivision, /deployment:/);
  assert.match(devopsDivision, /monitoring:/);
  assert.match(operationsDivision, /monitoring:/);
  assert.match(devopsDivision, /prefer: devops/);
  assert.match(operationsDivision, /prefer: operations/);
});

test("2000..2004: domain, gateway, entrypoint, runtime, and threat-model configs stay aligned with the audit requirements", () => {
  const domainsDefault = readJson<{
    domains: Array<{
      domainId: string;
      outputContracts: Array<{
        contractId: string;
        schema: {
          type: string;
          properties?: Record<string, unknown>;
          additionalProperties?: boolean;
        };
        validationLevel: string;
      }>;
    }>;
  }>("config/domains/default.json");
  const gatewaysDefault = readJson<{
    rateLimit: { enabled: boolean; maxRequests: number };
    cors: { enabled: boolean; allowedOrigins: string[] };
    auth: { required: boolean; allowApiKey: boolean; allowOidc: boolean };
    tls: { enabled: boolean; minVersion: string; rejectUnauthorized: boolean };
  }>("config/gateways/default.json");
  const runtimeDefault = readJson<{
    maxToolCalls: number;
    maxAgentRounds: number;
  }>("config/runtime/default.json");
  const threatMatrix = readJson<{
    dimensions: Record<string, string[]>;
  }>("config/security/threat-matrix.json");
  const rootIndexSource = readText("src/index.ts");
  const architectureTypesSource = readText("src/platform-architecture-types.ts");

  const codingDomain = domainsDefault.domains.find((item) => item.domainId === "coding");
  assert.ok(codingDomain);
  const patchContract = codingDomain.outputContracts.find((item) => item.contractId === "coding.patch");
  assert.ok(patchContract);
  assert.equal(patchContract.validationLevel, "strict");
  assert.equal(patchContract.schema.type, "object");
  assert.ok((patchContract.schema.properties?.patch) != null);
  assert.ok((patchContract.schema.properties?.filesModified) != null);
  assert.equal(patchContract.schema.additionalProperties, false);

  assert.equal(gatewaysDefault.rateLimit.enabled, true);
  assert.equal(gatewaysDefault.rateLimit.maxRequests, 120);
  assert.equal(gatewaysDefault.cors.enabled, true);
  assert.ok(gatewaysDefault.cors.allowedOrigins.includes("http://localhost:3000"));
  assert.equal(gatewaysDefault.auth.required, true);
  assert.equal(gatewaysDefault.auth.allowApiKey, true);
  assert.equal(gatewaysDefault.auth.allowOidc, true);
  assert.equal(gatewaysDefault.tls.enabled, true);
  assert.equal(gatewaysDefault.tls.minVersion, "TLSv1.2");
  assert.equal(gatewaysDefault.tls.rejectUnauthorized, true);

  assert.equal(runtimeDefault.maxToolCalls, 32);
  assert.equal(runtimeDefault.maxAgentRounds, 16);

  assert.match(architectureTypesSource, /export type PlatformStartupTargetKind = "summary" \| "demo" \| PlatformAppKind;/);
  assert.ok(!rootIndexSource.includes("PlatformRootEntryMode"));
  assert.match(rootIndexSource, /import type \{ PlatformAppKind, PlatformStartupTargetKind \} from "\.\/platform-architecture-types\.js";/);
  assert.match(rootIndexSource, /export type \{ PlatformAppKind, PlatformStartupTargetKind \} from "\.\/platform-architecture-types\.js";/);

  assert.ok(threatMatrix.dimensions.TAMPERING.some((item) => item.includes("configuration")));
  assert.ok(threatMatrix.dimensions.INFORMATION_DISCLOSURE.some((item) => item.includes("agent memory")));
});

test("2005..2008: client-sdk retry/envelope guards, plugin signature enforcement, and CRM adapter live-fetch path stay fixed", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    idempotencyKey: "idem-1",
    principal: { subject: "user-1", tenantId: "tenant-1", roles: ["admin"] },
  }, {
    maxRetries: 1,
    backoffMs: 1,
    backoffMultiplier: 1,
    maxBackoffMs: 1,
  });
  const pluginExecutorSource = readText("src/platform/five-plane-execution/plugin-executor/plugin-executor.service.ts");

  const originalFetch = globalThis.fetch;
  try {
    let attempts400 = 0;
    globalThis.fetch = (async () => {
      attempts400 += 1;
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await assert.rejects(async () => client.get("/bad-request"));
    assert.equal(attempts400, 1);

    let attemptsPost500 = 0;
    globalThis.fetch = (async () => {
      attemptsPost500 += 1;
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await assert.rejects(async () => client.post("/create", { hello: "world" }));
    assert.equal(attemptsPost500, 1);

    let attemptsGet500 = 0;
    let seenEnvelope: Record<string, unknown> | null = null;
    globalThis.fetch = (async (_url, init) => {
      attemptsGet500 += 1;
      if (init?.body) {
        seenEnvelope = JSON.parse(String(init.body)) as Record<string, unknown>;
      }
      if (attemptsGet500 === 1) {
        return new Response(JSON.stringify({ error: "temporary" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        envelopeId: "resp-env-1",
        schemaVersion: "v4.3",
        commandId: "resp-cmd-1",
        idempotencyKey: "resp-idem-1",
        correlationId: "resp-corr-1",
        timestamp: new Date().toISOString(),
        signature: null,
        ttl: 30000,
        metadata: {},
        payload: { ok: true },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const response = await client.post<{ ok: boolean }>("/wrapped", { hello: "world" }).catch(() => null);
    assert.equal(response, null);

    attemptsGet500 = 0;
    globalThis.fetch = (async () => {
      attemptsGet500 += 1;
      if (attemptsGet500 === 1) {
        return new Response(JSON.stringify({ error: "temporary" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const retried = await client.get<{ ok: boolean }>("/retry-ok");
    assert.equal(attemptsGet500, 2);
    assert.equal(retried.data.ok, true);

    globalThis.fetch = (async (_url, init) => {
      seenEnvelope = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await client.post("/envelope", { hello: "world" });
    assert.ok(seenEnvelope);
    assert.equal(seenEnvelope["schemaVersion"], "v4.3");
    assert.equal(seenEnvelope["idempotencyKey"], "idem-1");
    assert.deepEqual(seenEnvelope["payload"], { hello: "world" });

    const unsignedPlugin = definePlugin({
      pluginId: "test-pack.unsigned",
      name: "Unsigned Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "execute", description: "Execute", inputSchema: {}, outputSchema: {} }],
    });
    assert.throws(() => enforcePluginSignature(unsignedPlugin), /signature is required/);
    assert.throws(() => definePlugin({
      pluginId: "test-pack.signed",
      name: "Signed Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "execute", description: "Execute", inputSchema: {}, outputSchema: {} }],
      signing: {
        keyId: "unknown-key",
        signature: "invalid-signature",
        algorithm: "RSA-SHA256",
      },
    }), /not registered/);
    assert.match(
      pluginExecutorSource,
      /enforcePluginSignature\((?:toPluginDefinition\(instance\.manifest\)|instance\.manifest as unknown as PluginDefinition)\);/,
    );

    const crmAdapter = createCrmAdapterPlugin({
      policy: {
        evaluate: () => ({
          allowed: true,
          destinationType: "external",
          destination: "api.hubspot.com",
          reasonCode: null,
        }),
      } as never,
    });
    let requestedUrl = "";
    globalThis.fetch = (async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ results: [{ id: "contact-1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await crmAdapter.authenticate({ token: "managed-secret-token" });
    const crmResponse = await crmAdapter.execute("contacts", { limit: 25 });
    assert.equal(crmResponse.ok, true);
    assert.match(requestedUrl, /\/crm\/v3\/objects\/contacts\?limit=25/);
    assert.deepEqual((crmResponse.data as { result: { results: Array<{ id: string }> } }).result.results[0], { id: "contact-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
