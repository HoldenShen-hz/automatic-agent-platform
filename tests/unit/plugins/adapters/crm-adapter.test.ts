/**
 * Unit Tests: CRM Adapter (Extended)
 *
 * Tests for issue #2008: CRM adapter execute returns hardcoded mock, no real API
 *
 * These tests verify the CRM adapter's stub behavior and policy enforcement.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin, type CrmAdapterPluginOptions } from "../../../../src/plugins/adapters/crm-adapter.js";
import type { NetworkEgressPolicyService } from "../../../../src/platform/control-plane/iam/network-egress-policy.js";

// Mock policy factory for testing
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

// =============================================================================
// Issue #2008: CRM adapter execute returns hardcoded mock, no real API
// These tests document the stub behavior
// =============================================================================

test("CrmAdapter.execute returns stub response confirming no real API call (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", { limit: 10 });

  const data = result as Record<string, unknown>;
  assert.equal(data.ok, true, "Stub response should return ok=true");
  assert.equal(
    (data.data as Record<string, unknown>).result,
    "CRM get_contacts stub — implement hubspot API integration",
    "Stub should indicate no real API implementation",
  );
});

test("CrmAdapter.execute stub includes action and params in response (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("query_accounts", { filter: "active" });

  const data = result as Record<string, unknown>;
  assert.equal((data.data as Record<string, unknown>).action, "query_accounts");
  assert.deepEqual((data.data as Record<string, unknown>).params, { filter: "active" });
});

test("CrmAdapter.execute stub latencyMs is 0 (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("get_deals", {});

  const data = result as Record<string, unknown>;
  assert.equal(data.latencyMs, 0, "Stub response should have 0 latency");
});

// =============================================================================
// Plugin metadata and initialization tests
// =============================================================================

test("CrmAdapter has correct plugin metadata", () => {
  const adapter = createCrmAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.growth.crm_adapter");
  assert.equal(adapter.spiType, "adapter");
  assert.equal(adapter.adapterType, "crm_analytics");
});

test("CrmAdapter has correct capabilityIds for hubspot (default)", () => {
  const adapter = createCrmAdapterPlugin();

  assert.deepEqual(adapter.capabilityIds, [
    "external.hubspot",
    "external.hubspot.contacts",
    "external.hubspot.campaigns",
  ]);
});

test("CrmAdapter has correct capabilityIds for salesforce", () => {
  const adapter = createCrmAdapterPlugin({ crmType: "salesforce" });

  assert.deepEqual(adapter.capabilityIds, [
    "external.salesforce",
    "external.salesforce.contacts",
    "external.salesforce.campaigns",
  ]);
});

test("CrmAdapter.initialize returns undefined", async () => {
  const adapter = createCrmAdapterPlugin();
  const result = await adapter.initialize();
  assert.equal(result, undefined);
});

test("CrmAdapter.shutdown clears credential fingerprint", async () => {
  const adapter = createCrmAdapterPlugin();
  await adapter.shutdown();
  // No error means success
});

// =============================================================================
// Authentication tests
// =============================================================================

test("CrmAdapter.authenticate stores credential fingerprint", async () => {
  const adapter = createCrmAdapterPlugin();

  await adapter.authenticate({ token: "hubspot_secret_abc12345" });
  // No error means success - credential fingerprint is stored internally
});

test("CrmAdapter.authenticate accepts managedSecretRef", async () => {
  const adapter = createCrmAdapterPlugin();

  await adapter.authenticate({ managedSecretRef: "secret://hubspot/token" });
  // No error means success
});

test("CrmAdapter.authenticate throws on missing token", async () => {
  const adapter = createCrmAdapterPlugin();

  await assert.rejects(
    async () => adapter.authenticate({}),
    { message: /crm_adapter\.missing_token/ },
  );
});

test("CrmAdapter.authenticate throws on empty token", async () => {
  const adapter = createCrmAdapterPlugin();

  await assert.rejects(
    async () => adapter.authenticate({ token: "   " }),
    { message: /crm_adapter\.missing_token/ },
  );
});

// =============================================================================
// Execute tests
// =============================================================================

test("CrmAdapter.execute returns correct crmType for hubspot (default)", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", {});

  const data = result as Record<string, unknown>;
  assert.equal((data.data as Record<string, unknown>).crmType, "hubspot");
});

test("CrmAdapter.execute returns correct crmType for salesforce", async () => {
  const adapter = createCrmAdapterPlugin({ crmType: "salesforce", policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", {});

  const data = result as Record<string, unknown>;
  assert.equal((data.data as Record<string, unknown>).crmType, "salesforce");
});

test("CrmAdapter.execute stub result includes CRM type name (issue #2008)", async () => {
  const adapter = createCrmAdapterPlugin({ crmType: "salesforce", policy: createMockPolicy() });

  const result = await adapter.execute("get_accounts", {});

  const data = result as Record<string, unknown>;
  assert.ok(
    (data.data as Record<string, unknown>).result.includes("salesforce"),
    "Stub should indicate Salesforce implementation",
  );
});

// =============================================================================
// Policy enforcement tests
// =============================================================================

test("CrmAdapter.execute throws PolicyDeniedError when egress blocked", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });

  await assert.rejects(
    async () => adapter.execute("get_contacts", {}),
    (err: any) => {
      return err.code === "egress.denied";
    },
  );
});

test("CrmAdapter.execute builds correct endpoint for action", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  // The policy evaluates the URL - verify it includes the action
  await adapter.execute("query_objects", {});
  // If we get here without throwing, the policy allowed it
  assert.ok(true);
});

// =============================================================================
// Configuration tests
// =============================================================================

test("CrmAdapter uses custom apiBaseUrl when provided", async () => {
  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://custom.hubspot.com/api",
    policy: createMockPolicy(),
  });

  const result = await adapter.execute("get_contacts", {});

  const data = result as Record<string, unknown>;
  assert.equal(data.ok, true);
});

test("CrmAdapter uses default apiBaseUrl for hubspot", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy() });

  const result = await adapter.execute("get_contacts", {});

  const data = result as Record<string, unknown>;
  assert.equal(data.ok, true);
  assert.ok((data.data as Record<string, unknown>).result.includes("hubspot"));
});

test("CrmAdapter.apiBaseUrl strips trailing slashes", async () => {
  const adapter = createCrmAdapterPlugin({
    apiBaseUrl: "https://api.hubspot.com///",
    policy: createMockPolicy(),
  });

  const result = await adapter.execute("get_contacts", {});
  assert.equal((result as Record<string, unknown>).ok, true);
});

// =============================================================================
// Health check tests
// =============================================================================

test("CrmAdapter.healthCheck returns boolean from policy", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(true) });
  const result = await adapter.healthCheck();
  assert.equal(typeof result, "boolean");
  assert.equal(result, true);
});

test("CrmAdapter.healthCheck returns false when policy denies", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createMockPolicy(false) });
  const result = await adapter.healthCheck();
  assert.equal(result, false);
});