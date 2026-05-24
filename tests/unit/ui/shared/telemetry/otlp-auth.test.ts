import assert from "node:assert/strict";
import test from "node:test";
import { loadRepoModule } from "../../../../helpers/repo-module.js";

async function loadTelemetryModule() {
  return loadRepoModule<{
    OtlpHttpTelemetryExporter: new (
      endpoint: string,
      fetcher: (url: string, init?: RequestInit) => Promise<Response>,
      options?: { authorization?: string },
    ) => {
      export(events: Array<{ name: string; attributes: Record<string, unknown>; recordedAt: string }>): Promise<void>;
    };
  }>("ui", "packages", "shared", "telemetry", "src", "index.ts");
}

test("OtlpHttpTelemetryExporter rejects missing authorization for multi-tenant isolation", async () => {
  const { OtlpHttpTelemetryExporter } = await loadTelemetryModule();
  assert.throws(
    () => new OtlpHttpTelemetryExporter("https://otel.example.com/v1/logs", async () => new Response("{}")),
    /requires authorization header or VITE_OTLP_AUTH_TOKEN/,
  );
});

test("OtlpHttpTelemetryExporter sends authorization header on export", async () => {
  const { OtlpHttpTelemetryExporter } = await loadTelemetryModule();
  let requestHeaders: HeadersInit | undefined;
  let requestSignal: AbortSignal | null | undefined;
  let requestBody: unknown;
  const exporter = new OtlpHttpTelemetryExporter(
    "https://otel.example.com/v1/logs",
    async (_url: string, init?: RequestInit) => {
      requestHeaders = init?.headers;
      requestSignal = init?.signal;
      requestBody = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    },
    { authorization: "Bearer tenant-token" },
  );

  await exporter.export([
    {
      name: "test.event",
      attributes: { count: 1 },
      recordedAt: "2026-05-04T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(requestHeaders, {
    "content-type": "application/json",
    "authorization": "Bearer tenant-token",
  });
  assert.ok(requestSignal instanceof AbortSignal, "OTLP exports should carry a timeout signal");
  assert.equal(Object.hasOwn(requestBody as Record<string, unknown>, "body"), false);
  assert.ok(Array.isArray((requestBody as { resourceLogs?: unknown[] }).resourceLogs));
});
