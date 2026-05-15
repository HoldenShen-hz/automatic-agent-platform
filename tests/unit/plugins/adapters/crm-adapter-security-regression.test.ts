import assert from "node:assert/strict";
import test from "node:test";

import { createCrmAdapterPlugin } from "../../../../src/plugins/adapters/crm-adapter.js";
import type { NetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";

function createAllowPolicy(): NetworkEgressPolicyService {
  return {
    evaluate: (_url: string) => ({
      allowed: true,
      destinationType: "external" as const,
      destination: "api.hubspot.com",
      reasonCode: null,
    }),
    getMode: () => "enforce" as const,
    record: () => {},
  } as unknown as NetworkEgressPolicyService;
}

test("CrmAdapter.authenticate uses hashed fingerprint instead of leaking token prefix", async () => {
  const adapter = createCrmAdapterPlugin({ policy: createAllowPolicy() });
  const rawToken = "verysecret_token_12345";
  let authorizationHeader: string | null = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    authorizationHeader = new Headers(init?.headers).get("Authorization");
    return new Response(JSON.stringify({ crmType: "hubspot" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await adapter.authenticate({ token: rawToken });
    await adapter.execute("contacts", { email: "user@example.com" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(authorizationHeader);
  assert.match(authorizationHeader!, /^Bearer crm_hubspot_[0-9a-f]{8}$/);
  assert.equal(authorizationHeader!.includes(rawToken.slice(0, 8)), false);
});
