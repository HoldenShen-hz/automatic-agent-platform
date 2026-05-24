import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin } from "../../../../src/plugins/adapters/crm-adapter.js";
import { NetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";

type CrmExecutionEnvelope = Awaited<ReturnType<ReturnType<typeof createCrmAdapterPlugin>["execute"]>> & {
  data: {
    action: string;
    crmType: string;
    error?: string;
  };
};

function createPolicy(allowedDomains: readonly string[] = ["api.hubspot.com", "api.salesforce.com"]) {
  return new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains,
  });
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("crm adapter exposes current plugin metadata for default and salesforce modes", () => {
  const hubspot = createCrmAdapterPlugin();
  const salesforce = createCrmAdapterPlugin({ crmType: "salesforce" });

  assert.equal(hubspot.pluginId, "plugin.growth.crm_adapter");
  assert.equal(hubspot.adapterType, "crm_analytics");
  assert.deepEqual(hubspot.capabilityIds, [
    "external.hubspot",
    "external.hubspot.contacts",
    "external.hubspot.campaigns",
  ]);
  assert.deepEqual(salesforce.capabilityIds, [
    "external.salesforce",
    "external.salesforce.contacts",
    "external.salesforce.campaigns",
  ]);
});

test("crm adapter initialize, authenticate, healthCheck, and shutdown follow current lifecycle", async () => {
  const adapter = createCrmAdapterPlugin({
    policy: createPolicy(),
  });

  assert.equal(await adapter.initialize?.(), undefined);
  await adapter.authenticate({ token: "hubspot_secret_abc12345" });
  assert.equal(await adapter.healthCheck?.(), true);
  await adapter.shutdown?.();
});

test("crm adapter healthCheck returns false when destination is not allowed", async () => {
  const adapter = createCrmAdapterPlugin({
    policy: createPolicy(["api.salesforce.com"]),
  });

  assert.equal(await adapter.healthCheck?.(), false);
});

test("crm adapter execute lists contacts with current response envelope", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const adapter = createCrmAdapterPlugin({
    policy: createPolicy(),
    fetchImplementation: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return createJsonResponse({ results: [{ id: "1" }], total: 1 });
    },
  });
  await adapter.authenticate({ token: "hubspot_token_123" });

  const result = await adapter.execute("contacts", {
    limit: 50,
    after: "cursor-1",
    properties: "email,name",
  }) as CrmExecutionEnvelope;

  assert.equal(result.ok, true);
  assert.equal(result.data.action, "contacts");
  assert.equal(result.data.crmType, "hubspot");
  assert.ok(capturedUrl.includes("/crm/v3/objects/contacts?"));
  assert.ok(capturedUrl.includes("limit=50"));
  assert.ok(capturedUrl.includes("after=cursor-1"));
  assert.ok(capturedUrl.includes("properties=email%2Cname"));
  assert.equal(capturedInit?.method, "GET");
  assert.equal((capturedInit?.headers as Record<string, string>)["Authorization"], "Bearer hubspot_token_123");
});

test("crm adapter execute sends POST body for whitelisted mutating actions", async () => {
  let capturedInit: RequestInit | undefined;
  const adapter = createCrmAdapterPlugin({
    policy: createPolicy(),
    fetchImplementation: async (_input, init) => {
      capturedInit = init;
      return createJsonResponse({ id: "mutation-1", success: true });
    },
  });
  await adapter.authenticate({ token: "hubspot_token_456" });

  const result = await adapter.execute("upsert_contact", {
    email: "user@example.com",
    score: 42,
  }) as CrmExecutionEnvelope;
  const requestBody = JSON.parse(String(capturedInit?.body));

  assert.equal(result.ok, true);
  assert.equal(capturedInit?.method, "POST");
  assert.equal(requestBody.email, "user@example.com");
  assert.equal(requestBody.score, 42);
});

test("crm adapter execute rejects unauthenticated, policy-denied, and invalid actions using current behavior", async () => {
  const unauthenticated = createCrmAdapterPlugin({
    policy: createPolicy(),
    fetchImplementation: async () => createJsonResponse({ results: [] }),
  });
  await assert.rejects(
    () => unauthenticated.execute("contacts", {}),
    /crm_adapter\.not_authenticated/,
  );

  const denied = createCrmAdapterPlugin({
    policy: createPolicy(["api.salesforce.com"]),
    fetchImplementation: async () => createJsonResponse({ results: [] }),
  });
  await denied.authenticate({ token: "hubspot_token_789" });
  await assert.rejects(
    () => denied.execute("contacts", {}),
    (error: unknown) => (error as { code?: string }).code === "egress.denied",
  );

  const invalid = createCrmAdapterPlugin({
    policy: createPolicy(),
    fetchImplementation: async () => createJsonResponse({}),
  });
  await invalid.authenticate({ token: "hubspot_token_999" });
  await assert.rejects(
    () => invalid.execute("custom-action", {}),
    /crm_adapter\.invalid_action/,
  );
});
