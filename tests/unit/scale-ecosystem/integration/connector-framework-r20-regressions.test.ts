import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";

test("R20-50 first-party connectors run through concrete executors and deliver callbacks [connector-framework-r20-regressions]", async () => {
  const service = new ConnectorFrameworkService();
  service.register({
    connectorId: "github-first-party",
    provider: "github",
    capabilities: ["create_pr"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["repo.sync"],
    lifecycleState: "enabled",
  });

  const originalFetch = globalThis.fetch;
  const callbackCalls: Array<{ url: string; body: string | undefined; headers: HeadersInit | undefined }> = [];
  (globalThis as { fetch?: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    callbackCalls.push({
      url: String(input),
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: init?.headers,
    });
    return { ok: true } as Response;
  }) as typeof fetch;

  try {
    const result = await service.execute(
      {
        connectorId: "github-first-party",
        capability: "unsupported_capability",
        payload: {},
        policyRef: "policy://github",
        secretBindings: [{ secretRef: "secret://github/token", purpose: "api_token" }],
        callbackUrl: "https://callback.test/github",
      },
      { environment: "dev", eventType: "repo.sync", executedAt: "2026-05-11T00:00:00.000Z" },
    );

    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
    assert.equal(callbackCalls.length, 1);
    assert.equal(callbackCalls[0]?.url, "https://callback.test/github");
    assert.match(String((callbackCalls[0]?.headers as Record<string, string>)["X-Connector-Callback"]), /true/i);
    assert.match(callbackCalls[0]?.body ?? "", /"status":"failed"/);
  } finally {
    if (originalFetch == null) {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    } else {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    }
  }
});

test("R20-51 manifests and bindings survive restart via durable connector storage [connector-framework-r20-regressions]", async () => {
  const storageDir = mkdtempSync(join(tmpdir(), "connector-framework-r20-"));
  try {
    const writer = new ConnectorFrameworkService(storageDir);
    writer.register({
      connectorId: "github-persisted",
      provider: "github",
      capabilities: ["create_pr"],
      authMode: "oauth2",
      rateLimits: { perMinute: 60 },
      supportedEvents: ["repo.sync"],
      lifecycleState: "enabled",
    });
    writer.bind("github-persisted", "tenant-1", "prod", "2026-05-11T00:00:00.000Z");

    const reader = new ConnectorFrameworkService(storageDir);
    assert.ok(reader.getManifest("github-persisted"));
    assert.equal(reader.listBindings({ connectorId: "github-persisted" }).length, 1);

    const result = await reader.execute(
      {
        connectorId: "github-persisted",
        capability: "unsupported_capability",
        payload: {},
        policyRef: "policy://github",
        secretBindings: [{ secretRef: "secret://github/token", purpose: "api_token" }],
      },
      { environment: "prod", eventType: "repo.sync", executedAt: "2026-05-11T00:01:00.000Z" },
    );

    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }
});
