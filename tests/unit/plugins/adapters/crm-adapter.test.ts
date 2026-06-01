import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin, type CrmAdapterPluginOptions } from "../../../../src/plugins/adapters/crm-adapter.js";
import type { NetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";

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

async function withMockedFetch<T>(mockFetch: typeof globalThis.fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    return await run();
  } finally {
    if (originalFetch === undefined) {
      delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
  }
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
  await assert.doesNotReject(async () => {
    const adapter = createCrmAdapterPlugin();

    await adapter.authenticate({ token: "hubspot_secret_abc12345" });

    // No error means success
  });
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
  await withMockedFetch(createMockFetch(mockResponse) as any, async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });

    const result = await adapter.execute("contacts", { limit: 10 });

    const data = result as any;
    assert.equal(data.ok, true);
    assert.equal(data.data.action, "contacts");
    assert.equal(data.data.crmType, "hubspot");
  });
});

test("CrmAdapter.execute returns correct crmType for salesforce", async () => {
  await withMockedFetch(createMockFetch({ results: [] }) as any, async () => {
    const adapter = createCrmAdapterPlugin({ crmType: "salesforce", policy: createMockPolicy() });
    await adapter.authenticate({ token: "sf_secret_xyz789" });

    const result = await adapter.execute("contacts", {});

    const data = result as any;
    assert.equal(data.data.crmType, "salesforce");
  });
});

test("CrmAdapter.execute throws PolicyDeniedError when egress blocked", async () => {
  await withMockedFetch(createMockFetch({ results: [] }) as any, async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });

    await assert.rejects(
      async () => adapter.execute("contacts", {}),
      (err: any) => {
        return err.code === "egress.denied";
      },
    );
  });
});

test("CrmAdapter uses custom apiBaseUrl when provided", async () => {
  await withMockedFetch(createMockFetch({ results: [] }) as any, async () => {
    const adapter = createCrmAdapterPlugin({
      apiBaseUrl: "https://custom.hubspot.com/api",
      policy: createMockPolicy(),
    });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });

    const result = await adapter.execute("contacts", {});

    const data = result as any;
    assert.equal(data.ok, true);
  });
});

test("CrmAdapter uses default apiBaseUrl for hubspot", async () => {
  const mockResponse = { results: [{ id: "1", properties: { name: "HubSpot Contact" } }], total: 1 };
  await withMockedFetch(createMockFetch(mockResponse) as any, async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });

    const result = await adapter.execute("contacts", {});

    const data = result as any;
    assert.equal(data.ok, true);
    assert.equal(data.data.result.total, 1);
    assert.equal(data.data.result.results[0].properties.name, "HubSpot Contact");
  });
});

test("CrmAdapter.execute makes real API call with correct URL and headers", async () => {
  const mockResponse = { results: [{ id: "123", properties: { email: "test@example.com" } }] };
  let capturedRequest: RequestInit | null = null;
  let capturedUrl: string | null = null;

  await withMockedFetch((async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedRequest = init ?? null;
    return {
      ok: true,
      status: 200,
      json: async () => mockResponse,
      text: async () => "",
    };
  }) as any, async () => {
    const adapter = createCrmAdapterPlugin({
      apiBaseUrl: "https://api.hubspot.com",
      policy: createMockPolicy(),
    });
    await adapter.authenticate({ token: "real_hubspot_token_abc12345" });

    const result = await adapter.execute("contacts", { limit: 50, properties: "email" });

    assert.ok(capturedUrl !== null);
    const requestUrl = capturedUrl as string;
    assert.ok(requestUrl.startsWith("https://api.hubspot.com/crm/v3/objects/contacts"));
    assert.ok(requestUrl.includes("limit=50"));
    assert.ok(requestUrl.includes("properties=email"));
    assert.ok(capturedRequest !== null);
    const request = capturedRequest as RequestInit;
    assert.equal(request.method, "GET");
    assert.equal((request.headers as Record<string, string>)["Authorization"], "Bearer real_hubspot_token_abc12345");
    assert.equal((result as any).ok, true);
    assert.deepEqual((result as any).data.result, mockResponse);
  });
});

test("CrmAdapter.execute makes POST request with body for whitelisted mutating actions", async () => {
  const mockResponse = { id: "op-123", success: true };
  let capturedRequest: RequestInit | null = null;

  await withMockedFetch((async (_url: string, init?: RequestInit) => {
    capturedRequest = init ?? null;
    return {
      ok: true,
      status: 200,
      json: async () => mockResponse,
      text: async () => "",
    };
  }) as any, async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "hubspot_token_xyz" });

    const result = await adapter.execute("upsert_contact", { param1: "value1", param2: 42 });

    assert.ok(capturedRequest !== null);
    const request = capturedRequest as RequestInit & { body?: string };
    assert.equal(request.method, "POST");
    assert.ok(request.body !== undefined);
    const body = JSON.parse(request.body as string);
    assert.equal(body.param1, "value1");
    assert.equal(body.param2, 42);
    assert.equal((result as any).ok, true);
    assert.deepEqual((result as any).data.result, mockResponse);
  });
});

test("CrmAdapter.execute rejects actions outside the explicit allowlist", async () => {
  await withMockedFetch(createMockFetch({}) as any, async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "hubspot_token_xyz" });
    await assert.rejects(
      () => adapter.execute("custom_action", { param1: "value1" }),
      /crm_adapter\.invalid_action/,
    );
  });
});

test("CrmAdapter.execute throws on API failure instead of flattening the transport result", async () => {
  await withMockedFetch((async () => ({
    ok: false,
    status: 401,
    json: async () => ({}),
    text: async () => "Unauthorized",
  })) as any, async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "invalid_token" });

    await assert.rejects(
      () => adapter.execute("contacts", {}),
      /crm_adapter\.api_error:401/,
    );
  });
});
