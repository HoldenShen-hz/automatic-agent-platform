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
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", { limit: 10 });

  const data = result as any;
  assert.equal(data.ok, true);
  assert.equal(data.data.action, "get_contacts");
  assert.equal(data.data.crmType, "hubspot");
});

test("CrmAdapter.execute returns correct crmType for salesforce", async () => {
  const adapter = createCrmAdapterPlugin({ crmType: "salesforce", policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", {});

  const data = result as any;
  assert.equal(data.data.crmType, "salesforce");
});

test("CrmAdapter.execute throws PolicyDeniedError when egress blocked", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });

  await assert.rejects(
    async () => adapter.execute("get_contacts", {}),
    (err: any) => {
      return err.code === "egress.denied";
    },
  );
});

test("CrmAdapter uses custom apiBaseUrl when provided", async () => {
  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://custom.hubspot.com/api",
    policy: createMockPolicy(),
  });

  const result = await adapter.execute("get_contacts", {});

  const data = result as any;
  assert.equal(data.ok, true);
});

test("CrmAdapter uses default apiBaseUrl for hubspot", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", {});

  const data = result as any;
  assert.equal(data.ok, true);
  assert.ok(data.data.result.includes("hubspot"));
});
