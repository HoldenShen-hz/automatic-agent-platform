import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApiUrl,
  buildAuthHeaders,
} from "../../../../src/sdk/client-sdk/index.js";

test("client-sdk builds versioned API URLs with tenant and query params", () => {
  const url = buildApiUrl(
    { baseUrl: "https://api.example.com/", apiVersion: "v1", tenantId: "tenant_a" },
    { path: "/tasks", query: { limit: 5, status: "open" } },
  );

  assert.equal(url, "https://api.example.com/v1/tasks?limit=5&status=open&tenantId=tenant_a");
});

test("client-sdk builds bearer auth headers", () => {
  assert.deepEqual(buildAuthHeaders({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "token_123",
  }), {
    authorization: "Bearer token_123",
  });
});
