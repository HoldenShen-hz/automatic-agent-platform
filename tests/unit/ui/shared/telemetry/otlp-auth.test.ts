import assert from "node:assert/strict";
import test from "node:test";

import { OtlpHttpTelemetryExporter } from "../../../../../ui/packages/shared/telemetry/src/index.js";

test("OtlpHttpTelemetryExporter rejects missing authorization for multi-tenant isolation", () => {
  assert.throws(
    () => new OtlpHttpTelemetryExporter("https://otel.example.com/v1/logs", async () => new Response("{}")),
    /requires authorization header or VITE_OTLP_AUTH_TOKEN/,
  );
});

test("OtlpHttpTelemetryExporter sends authorization header on export", async () => {
  let requestHeaders: HeadersInit | undefined;
  let requestSignal: AbortSignal | null | undefined;
  let requestBody: unknown;
  const exporter = new OtlpHttpTelemetryExporter(
    "https://otel.example.com/v1/logs",
    async (_url, init) => {
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
