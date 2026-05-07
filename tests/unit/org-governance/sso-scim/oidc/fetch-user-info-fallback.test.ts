import assert from "node:assert/strict";
import test from "node:test";

import { OidcIdentityService } from "../../../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import type { OidcProviderConfig } from "../../../../../src/org-governance/sso-scim/oidc/index.js";

function createProviderConfig(): OidcProviderConfig {
  return {
    providerId: "oidc-provider",
    issuer: "https://issuer.example.com",
    clientId: "client-1",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", "profile", "email"],
  };
}

test("fetchUserInfo throws instead of simulating a user when mock fallback is disabled", async () => {
  const service = new OidcIdentityService(createProviderConfig(), undefined, {
    allowMockFallback: false,
  });
  const originalFetch = globalThis.fetch;

  // Mock fetch that returns a failing response - properly returns a Promise
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 503,
      json: async () => ({}),
    };
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(
      async () => service.fetchUserInfo("access-token-1"),
      /oidc\.userinfo_fetch_failed:503/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
