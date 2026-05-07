import assert from "node:assert/strict";
import test from "node:test";

import { createWebFetchTool, resolvesToBlockedAddress } from "../../../../../src/platform/five-plane-execution/tool-executor/web-fetch.js";

test("resolvesToBlockedAddress rejects DNS rebinding targets that resolve to loopback", async () => {
  const blocked = await resolvesToBlockedAddress(
    "public.example.test",
    async () => [{ address: "127.0.0.1", family: 4 }],
  );

  assert.equal(blocked, true);
});

test("resolvesToBlockedAddress allows public DNS answers", async () => {
  const blocked = await resolvesToBlockedAddress(
    "public.example.test",
    async () => [{ address: "93.184.216.34", family: 4 }],
  );

  assert.equal(blocked, false);
});

test("createWebFetchTool blocks rebinding destinations before issuing fetch", async () => {
  let fetchCalled = false;
  const tool = createWebFetchTool({
    dnsLookup: async () => [{ address: "127.0.0.1", family: 4 }],
    fetchImplementation: async () => {
      fetchCalled = true;
      return new Response("unexpected");
    },
  });

  const result = await tool.execute({ url: "https://public.example.test/path" });

  assert.equal(result.success, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "DNS_REBINDING_BLOCKED");
  assert.equal(fetchCalled, false);
});
