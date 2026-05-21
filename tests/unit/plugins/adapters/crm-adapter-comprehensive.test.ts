import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin, type CrmAdapterPluginOptions } from "../../../../src/plugins/adapters/crm-adapter.js";

function createMockPolicy(allowed: boolean = true) {
  return {
    evaluate: (_url: string) => ({
      allowed,
      destinationType: "external" as const,
      destination: "api.hubspot.com",
      reasonCode: allowed ? null : "egress.denied",
    }),
    getMode: () => "enforce" as const,
    record: () => {},
  };
}

function createMockFetch(response: unknown, ok: boolean = true) {
  return async () => ({
    ok,
    status: ok ? 200 : 400,
    json: async () => response,
    text: async () => (ok ? "" : "mock error"),
  });
}

test.describe("CrmAdapter Plugin", () => {
  test("createCrmAdapterPlugin returns ExternalAdapterPlugin with correct metadata", () => {
    const adapter = createCrmAdapterPlugin();
    assert.equal(adapter.pluginId, "plugin.growth.crm_adapter");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(adapter.adapterType, "crm_analytics");
  });

  test("createCrmAdapterPlugin has correct capabilityIds for hubspot", () => {
    const adapter = createCrmAdapterPlugin();
    assert.deepEqual(adapter.capabilityIds, ["external.hubspot", "external.hubspot.contacts", "external.hubspot.campaigns"]);
  });

  test("createCrmAdapterPlugin has correct capabilityIds for salesforce", () => {
    const adapter = createCrmAdapterPlugin({ crmType: "salesforce" });
    assert.deepEqual(adapter.capabilityIds, ["external.salesforce", "external.salesforce.contacts", "external.salesforce.campaigns"]);
  });

  test("createCrmAdapterPlugin accepts custom apiBaseUrl", () => {
    const adapter = createCrmAdapterPlugin({ apiBaseUrl: "https://custom.crm.com/api" });
    assert.ok(adapter !== undefined);
  });

  test("createCrmAdapterPlugin accepts custom crmType", () => {
    const adapter = createCrmAdapterPlugin({ crmType: "salesforce" });
    assert.ok(adapter !== undefined);
  });

  test("initialize returns undefined", async () => {
    const adapter = createCrmAdapterPlugin();
    const result = await adapter.initialize();
    assert.equal(result, undefined);
  });

  test("shutdown clears credential state", async () => {
    const adapter = createCrmAdapterPlugin();
    await adapter.authenticate({ token: "test_token" });
    await adapter.shutdown();
  });

  test("healthCheck returns policy evaluation result", async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(true) });
    const result = await adapter.healthCheck();
    assert.equal(result, true);
  });

  test("healthCheck returns false when policy denies", async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
    const result = await adapter.healthCheck();
    assert.equal(result, false);
  });
});

test.describe("CrmAdapter authenticate", () => {
  test("authenticate stores credential fingerprint", async () => {
    const adapter = createCrmAdapterPlugin();
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });
  });

  test("authenticate accepts managedSecretRef format", async () => {
    const adapter = createCrmAdapterPlugin();
    await adapter.authenticate({ managedSecretRef: "secret://my-token" });
  });

  test("authenticate throws on missing token", async () => {
    const adapter = createCrmAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({}),
      { message: /crm_adapter\.missing_token/ },
    );
  });

  test("authenticate throws on empty string token", async () => {
    const adapter = createCrmAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: "   " }),
      { message: /crm_adapter\.missing_token/ },
    );
  });

  test("authenticate throws on null token", async () => {
    const adapter = createCrmAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: null }),
      { message: /crm_adapter\.missing_token/ },
    );
  });

  test("authenticate uses sha256 fingerprint for token", async () => {
    const adapter = createCrmAdapterPlugin();
    await adapter.authenticate({ token: "test_token_hash" });
  });
});

test.describe("CrmAdapter execute - contacts list", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("returns success response for contacts action", async () => {
    const mockResponse = { results: [{ id: "1", properties: { name: "Test Contact" } }], total: 1 };
    globalThis.fetch = createMockFetch(mockResponse) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });
    const result = await adapter.execute("contacts", { limit: 10 }) as any;
    assert.equal(result.ok, true);
    assert.equal(result.data.action, "contacts");
    assert.equal(result.data.crmType, "hubspot");
  });

  test("makes API call with correct URL for contacts", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ apiBaseUrl: "https://api.hubspot.com", policy: createMockPolicy() });
    await adapter.authenticate({ token: "real_token" });
    await adapter.execute("contacts", { limit: 50 });
    assert.ok(capturedUrl !== null);
    assert.ok(capturedUrl!.startsWith("https://api.hubspot.com/crm/v3/objects/contacts"));
    assert.ok(capturedUrl!.includes("limit=50"));
  });

  test("makes API call with correct URL for companies", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("companies", {});
    assert.ok(capturedUrl !== null);
    assert.ok(capturedUrl!.includes("/companies"));
  });

  test("makes API call with correct URL for deals", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("deals", {});
    assert.ok(capturedUrl !== null);
    assert.ok(capturedUrl!.includes("/deals"));
  });

  test("uses default limit of 100 when not specified", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", {});
    assert.ok(capturedUrl!.includes("limit=100"));
  });

  test("uses custom after cursor when provided", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", { after: "cursor123" });
    assert.ok(capturedUrl!.includes("after=cursor123"));
  });

  test("uses custom properties filter when provided", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", { properties: "email,name" });
    assert.ok(capturedUrl!.includes("properties=email,name"));
  });

  test("includes latencyMs in response", async () => {
    globalThis.fetch = createMockFetch({ results: [] }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    const result = await adapter.execute("contacts", {}) as any;
    assert.ok(typeof result.latencyMs === "number");
    assert.ok(result.latencyMs >= 0);
  });
});

test.describe("CrmAdapter execute - single record", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("makes API call for contact with id", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ id: "123", properties: {} }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contact", { id: "123" });
    assert.ok(capturedUrl!.includes("/contact/123"));
  });

  test("makes API call for company with id", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ id: "456", properties: {} }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("company", { id: "456" });
    assert.ok(capturedUrl!.includes("/company/456"));
  });

  test("makes API call for deal with id", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ id: "789", properties: {} }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("deal", { id: "789" });
    assert.ok(capturedUrl!.includes("/deal/789"));
  });

  test("throws on missing id for contact action", async () => {
    globalThis.fetch = createMockFetch({}) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await assert.rejects(
      async () => adapter.execute("contact", {}),
      { message: /crm_adapter\.missing_id/ },
    );
  });

  test("throws on empty id for contact action", async () => {
    globalThis.fetch = createMockFetch({}) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await assert.rejects(
      async () => adapter.execute("contact", { id: "  " }),
      { message: /crm_adapter\.missing_id/ },
    );
  });

  test("throws on non-string id for contact action", async () => {
    globalThis.fetch = createMockFetch({}) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await assert.rejects(
      async () => adapter.execute("contact", { id: 123 as any }),
      { message: /crm_adapter\.missing_id/ },
    );
  });
});

test.describe("CrmAdapter execute - campaigns", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("makes API call for campaigns action", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("campaigns", {});
    assert.ok(capturedUrl!.includes("/campaigns"));
  });

  test("uses GET method for campaigns", async () => {
    let capturedMethod: string | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("campaigns", {});
    assert.equal(capturedMethod, "GET");
  });
});

test.describe("CrmAdapter execute - mutating actions", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("makes POST request for upsert_contact", async () => {
    let capturedMethod: string | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("upsert_contact", { email: "test@example.com", name: "Test" });
    assert.equal(capturedMethod, "POST");
  });

  test("makes POST request for upsert_company", async () => {
    let capturedMethod: string | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("upsert_company", { name: "Test Company" });
    assert.equal(capturedMethod, "POST");
  });

  test("makes POST request for append_note", async () => {
    let capturedMethod: string | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("append_note", { contactId: "123", note: "Test note" });
    assert.equal(capturedMethod, "POST");
  });

  test("includes body in POST request for upsert_contact", async () => {
    let capturedBody: string | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string ?? null;
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("upsert_contact", { email: "test@example.com", name: "Test Name" });
    const body = JSON.parse(capturedBody!);
    assert.equal(body.email, "test@example.com");
    assert.equal(body.name, "Test Name");
  });

  test("returns success response for upsert_contact", async () => {
    globalThis.fetch = createMockFetch({ id: "op-123", success: true }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    const result = await adapter.execute("upsert_contact", { email: "test@example.com" }) as any;
    assert.equal(result.ok, true);
    assert.equal(result.data.result.success, true);
  });

  test("returns failure for non-whitelisted mutating action", async () => {
    globalThis.fetch = createMockFetch({}) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    const result = await adapter.execute("custom_action", { param: "value" }) as any;
    assert.equal(result.ok, false);
    assert.ok(result.data.error.includes("crm_adapter.invalid_action"));
  });
});

test.describe("CrmAdapter execute - error handling", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("returns failure response on API error", async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "Unauthorized",
    })) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "invalid_token" });
    const result = await adapter.execute("contacts", {}) as any;
    assert.equal(result.ok, false);
    assert.ok(result.data.error.includes("401"));
    assert.ok(result.data.error.includes("Unauthorized"));
  });

  test("returns failure response on server error", async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "Internal Server Error",
    })) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    const result = await adapter.execute("contacts", {}) as any;
    assert.equal(result.ok, false);
    assert.ok(result.data.error.includes("500"));
  });

  test("handles text() failure gracefully", async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 400,
      json: async () => { throw new Error("json error"); },
      text: async () => { throw new Error("text error"); },
    })) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    const result = await adapter.execute("contacts", {}) as any;
    assert.equal(result.ok, false);
    assert.ok(result.data.error.includes("unknown"));
  });

  test("returns failure with correct crmType on API error", async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "Forbidden",
    })) as any;
    const adapter = createCrmAdapterPlugin({ crmType: "salesforce", policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    const result = await adapter.execute("contacts", {}) as any;
    assert.equal(result.ok, false);
    assert.equal(result.data.crmType, "salesforce");
  });
});

test.describe("CrmAdapter execute - policy enforcement", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("throws PolicyDeniedError when egress blocked for contacts", async () => {
    globalThis.fetch = createMockFetch({ results: [] }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });
    await assert.rejects(
      async () => adapter.execute("contacts", {}),
      (err: any) => err.code === "egress.denied",
    );
  });

  test("throws PolicyDeniedError when egress blocked for campaigns", async () => {
    globalThis.fetch = createMockFetch({ results: [] }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });
    await assert.rejects(
      async () => adapter.execute("campaigns", {}),
      (err: any) => err.code === "egress.denied",
    );
  });

  test("throws PolicyDeniedError when egress blocked for mutating action", async () => {
    globalThis.fetch = createMockFetch({ success: true }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
    await adapter.authenticate({ token: "hubspot_secret_abc12345" });
    await assert.rejects(
      async () => adapter.execute("upsert_contact", { email: "test@example.com" }),
      (err: any) => err.code === "egress.denied",
    );
  });
});

test.describe("CrmAdapter execute - not authenticated", () => {
  test("throws error when executing without authentication", async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await assert.rejects(
      async () => adapter.execute("contacts", {}),
      { message: "crm_adapter.not_authenticated" },
    );
  });

  test("throws error when executing with cleared credentials after shutdown", async () => {
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.shutdown();
    await assert.rejects(
      async () => adapter.execute("contacts", {}),
      { message: "crm_adapter.not_authenticated" },
    );
  });
});

test.describe("CrmAdapter custom fetch implementation", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("uses custom fetchImplementation when provided", async () => {
    let customFetchCalled = false;
    const customFetch = async () => {
      customFetchCalled = true;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    };
    const adapter = createCrmAdapterPlugin({
      policy: createMockPolicy(),
      fetchImplementation: customFetch,
    });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", {});
    assert.equal(customFetchCalled, true);
  });

  test("throws when fetch is unavailable and not provided", async () => {
    // Ensure globalThis.fetch is not a function
    (globalThis as any).fetch = undefined;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await assert.rejects(
      async () => adapter.execute("contacts", {}),
      { message: "crm_adapter.fetch_unavailable" },
    );
  });

  test("throws when fetchImplementation is not a function", async () => {
    const adapter = createCrmAdapterPlugin({
      policy: createMockPolicy(),
      fetchImplementation: "not a function" as any,
    });
    await adapter.authenticate({ token: "token" });
    await assert.rejects(
      async () => adapter.execute("contacts", {}),
      { message: "crm_adapter.fetch_unavailable" },
    );
  });
});

test.describe("CrmAdapter apiBaseUrl handling", () => {
  let originalFetch: typeof fetch;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch as typeof fetch;
  });

  test.afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test("uses default hubspot apiBaseUrl", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", {});
    assert.ok(capturedUrl!.startsWith("https://api.hubspot.com"));
  });

  test("strips trailing slashes from apiBaseUrl", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({ apiBaseUrl: "https://custom.hubspot.com/api///", policy: createMockPolicy() });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", {});
    assert.ok(capturedUrl!.startsWith("https://custom.hubspot.com/api"));
    assert.ok(!capturedUrl!.includes("//"));
  });

  test("uses custom apiBaseUrl for all requests", async () => {
    let capturedUrl: string | null = null;
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => "" };
    }) as any;
    const adapter = createCrmAdapterPlugin({
      apiBaseUrl: "https://custom.crm.com/v1",
      policy: createMockPolicy(),
    });
    await adapter.authenticate({ token: "token" });
    await adapter.execute("contacts", {});
    assert.ok(capturedUrl!.startsWith("https://custom.crm.com/v1"));
  });
});