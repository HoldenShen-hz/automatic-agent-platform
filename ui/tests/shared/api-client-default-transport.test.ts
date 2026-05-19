import { describe, expect, it } from "vitest";

import { createRuntimeRESTClient } from "../../packages/shared/api-client/src/rest-client";

describe("runtime REST client defaults", () => {
  it("prefers same-origin version-negotiated /api HTTP transport instead of mock fallback", async () => {
    const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const client = createRuntimeRESTClient({
      fetchImplementation: async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ requestId: "req-1", data: { ok: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const result = await client.get<{ ok: boolean }>("/health");

    expect(result.ok).toBe(true);
    expect(String(requests[0]?.input)).toContain("/api/health");
  });
});
