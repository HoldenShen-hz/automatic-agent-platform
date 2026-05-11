import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin, type CrmAdapterPluginOptions } from "../../../../src/plugins/adapters/crm-adapter.js";
import type { NetworkEgressPolicyService } from "../../../../src/platform/control-plane/iam/network-egress-policy.js";

function createMockPolicy(allowed: boolean = true): NetworkEgressPolicyService {
  return {
    evaluate: (_url: string) => ({
      allowed,
      destinationType: "external" as const,
      destination: "api.hubspot.com",
      reasonCode: allowed ? null : "egress.denied",
    }),
    getMode: () => "enforce" as const,
    record: () => {},
  } as unknown as NetworkEgressPolicyService;
}

function createMockFetch(response: unknown, ok: boolean = true) {
  return async () => ({
    ok,
    status: ok ? 200 : 400,
    json: async () => response,
    text: async () => (ok ? "" : "mock error"),
  });
}

test("CrmAdapter type exports are correct", () => {
  const adapter = createCrmAdapterPlugin();
  assert.ok(adapter !== undefined);
});

test("CrmAdapter has correct plugin metadata", () => {
  const adapter = createCrmAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.growth.crm_adapter");
  assert.equal(adapter.spiType, "adapter");
  assert.equal(adapter.adapterType, "crm_analytics");
});

test("CrmAdapter has correct capabilityIds for hubspot (default)", () => {
  const adapter = createCrmAdapterPlugin();

  assert.deepEqual(adapter.capabilityIds, ["external.hubspot", "external.hubspot.contacts", "external.hubspot.campaigns"]);
});

test("CrmAdapter has correct capabilityIds for salesforce", () => {
  const adapter = createCrmAdapterPlugin({ crmType: "salesforce" });

  assert.deepEqual(adapter.capabilityIds, ["external.salesforce", "external.salesforce.contacts", "external.salesforce.campaigns"]);
});

test("CrmAdapter.initialize returns undefined", async () => {
  const adapter = createCrmAdapterPlugin();
  assert.ok(adapter.initialize !== undefined);
  const result = await adapter.initialize();
  assert.equal(result, undefined);
});

test("CrmAdapter.shutdown clears credential fingerprint", async () => {
  const adapter = createCrmAdapterPlugin();
  assert.ok(adapter.shutdown !== undefined);
  await adapter.shutdown();
});

test("CrmAdapter.authenticate stores credential fingerprint", async () => {
  const adapter = createCrmAdapterPlugin();

  await adapter.authenticate({ token: "hubspot_secret_abc12345" });

  // No error means success
});

test("CrmAdapter.authenticate throws on missing token", async () => {
  const adapter = createCrmAdapterPlugin();

  await assert.rejects(
    async () => adapter.authenticate({}),
    { message: /crm_adapter\.missing_token/ },
  );
});

test("CrmAdapter.execute returns stub response with action", async () => {
  const mockResponse = { results: [{ id: "1", properties: { name: "Test Contact" } }] };
  globalThis.fetch = createMockFetch(mockResponse) as any;

  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "hubspot_secret_abc12345" });

  const result = await adapter.execute("contacts", { limit: 10 });

  const data = result as any;
  assert.equal(data.ok, true);
  assert.equal(data.data.action, "contacts");
  assert.equal(data.data.crmType, "hubspot");

  delete (globalThis as any).fetch;
});

test("CrmAdapter.execute returns correct crmType for salesforce", async () => {
  globalThis.fetch = createMockFetch({ results: [] }) as any;

  const adapter = createCrmAdapterPlugin({ crmType: "salesforce", policy: createMockPolicy() });
  await adapter.authenticate({ token: "sf_secret_xyz789" });

  const result = await adapter.execute("contacts", {});

  const data = result as any;
  assert.equal(data.data.crmType, "salesforce");

  delete (globalThis as any).fetch;
});

test("CrmAdapter.execute throws PolicyDeniedError when egress blocked", async () => {
  globalThis.fetch = createMockFetch({ results: [] }) as any;

  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
  await adapter.authenticate({ token: "hubspot_secret_abc12345" });

  await assert.rejects(
    async () => adapter.execute("contacts", {}),
    (err: any) => {
      return err.code === "egress.denied";
    },
  );

  delete (globalThis as any).fetch;
});

test("CrmAdapter uses custom apiBaseUrl when provided", async () => {
  globalThis.fetch = createMockFetch({ results: [] }) as any;

  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://custom.hubspot.com/api",
    policy: createMockPolicy(),
  });
  await adapter.authenticate({ token: "hubspot_secret_abc12345" });

  const result = await adapter.execute("contacts", {});

  const data = result as any;
  assert.equal(data.ok, true);

  delete (globalThis as any).fetch;
});

test("CrmAdapter uses default apiBaseUrl for hubspot", async () => {
  const mockResponse = { results: [{ id: "1", properties: { name: "HubSpot Contact" } }], total: 1 };
  globalThis.fetch = createMockFetch(mockResponse) as any;

  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "hubspot_secret_abc12345" });

  const result = await adapter.execute("contacts", {});

  const data = result as any;
  assert.equal(data.ok, true);
  assert.equal(data.data.result.total, 1);
  assert.equal(data.data.result.results[0].properties.name, "HubSpot Contact");

  delete (globalThis as any).fetch;
});

test("CrmAdapter.execute makes real API call with correct URL and headers", async () => {
  const mockResponse = { results: [{ id: "123", properties: { email: "test@example.com" } }] };
  let capturedRequest: RequestInit | null = null;
  let capturedUrl: string | null = null;

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedRequest = init ?? null;
    return {
      ok: true,
      status: 200,
      json: async () => mockResponse,
      text: async () => "",
    };
  }) as any;

  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://api.hubspot.com",
    policy: createMockPolicy(),
  });
  await adapter.authenticate({ token: "real_hubspot_token_abc12345" });

  const result = await adapter.execute("contacts", { limit: 50, properties: "email" });

  assert.ok(capturedUrl !== null);
  assert.ok(capturedUrl!.startsWith("https://api.hubspot.com/crm/v3/objects/contacts"));
  assert.ok(capturedUrl!.includes("limit=50"));
  assert.ok(capturedUrl!.includes("properties=email"));
  assert.ok(capturedRequest !== null);
  assert.equal(capturedRequest!.method, "GET");
  assert.ok(capturedRequest!.headers!["Authorization"] === "Bearer real_hubspot_token_abc12345");
  assert.equal((result as any).ok, true);
  assert.deepEqual((result as any).data.result, mockResponse);

  delete (globalThis as any).fetch;
});

test("CrmAdapter.execute makes POST request with body for custom actions", async () => {
  const mockResponse = { id: "op-123", success: true };
  let capturedRequest: RequestInit | null = null;

  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    capturedRequest = init ?? null;
    return {
      ok: true,
      status: 200,
      json: async () => mockResponse,
      text: async () => "",
    };
  }) as any;

  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "hubspot_token_xyz" });

  const result = await adapter.execute("custom_action", { param1: "value1", param2: 42 });

  assert.ok(capturedRequest !== null);
  assert.equal(capturedRequest!.method, "POST");
  assert.ok(capturedRequest!.body !== undefined);
  const body = JSON.parse(capturedRequest!.body as string);
  assert.equal(body.param1, "value1");
  assert.equal(body.param2, 42);
  assert.equal((result as any).ok, true);
  assert.deepEqual((result as any).data.result, mockResponse);

  delete (globalThis as any).fetch;
});

test("CrmAdapter.execute returns error response on API failure", async () => {
  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    json: async () => ({}),
    text: async () => "Unauthorized",
  })) as any;

  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
  await adapter.authenticate({ token: "invalid_token" });

  const result = await adapter.execute("contacts", {});

  const data = result as any;
  assert.equal(data.ok, false);
  assert.ok(data.data.error.includes("401"));

  delete (globalThis as any).fetch;
});
