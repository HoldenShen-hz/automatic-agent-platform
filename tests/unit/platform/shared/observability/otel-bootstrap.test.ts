import assert from "node:assert/strict";
import test from "node:test";

import { initOtel, isOtelRuntimeAvailable } from "../../../../../src/platform/shared/observability/otel-bootstrap.js";

test("isOtelRuntimeAvailable returns false when modules are absent", () => {
  const available = isOtelRuntimeAvailable(((specifier: string) => {
    throw new Error(`module not found: ${specifier}`);
  }) as never);
  assert.equal(available, false);
});

test("initOtel returns false when disabled", async () => {
  const initialized = await initOtel({
    enabled: false,
    endpoint: null,
    serviceName: "automatic-agent",
    serviceVersion: "0.1.0",
    instrumentHttp: true,
  });
  assert.equal(initialized, false);
});
