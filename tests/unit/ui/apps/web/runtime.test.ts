import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../../../../ui/apps/web/src/runtime.ts", import.meta.url),
  "utf8",
);

test("web runtime config reads explicit env keys and normalizes blank values", () => {
  for (const envKey of [
    "VITE_API_BASE_URL",
    "VITE_WS_URL",
    "VITE_TENANT_ID",
    "VITE_OTLP_ENDPOINT",
    "VITE_OTLP_AUTH_TOKEN",
  ]) {
    assert.equal(source.includes(envKey), true, `missing ${envKey}`);
  }

  assert.equal(source.includes("readBootstrapAuthToken"), true);
  assert.equal(source.includes('meta[name="aa-auth-token"]'), true);
  assert.equal(source.includes("const trimmed = value.trim();"), true);
  assert.equal(source.includes("return trimmed.length > 0 ? trimmed : undefined;"), true);
});

test("web runtime avoids insecure localhost fallback and disables transport mocking", () => {
  assert.equal(source.includes("http://localhost:3000"), false);
  assert.equal(source.includes('baseUrl: config.apiBaseUrl ?? "/api"'), true);
  assert.equal(source.includes("fallbackToMock: false"), true);
});

test("web runtime client stack keeps auth, tenant, retry, and offline queue interceptors", () => {
  for (const fragment of [
    "createTraceInterceptor()",
    "createRetryInterceptor()",
    "createDedupeInterceptor()",
    "createContractVersionInterceptor()",
    "createCsrfInterceptor()",
    "createIdempotencyKeyInterceptor()",
    "createAuthInterceptor(tokenManager)",
    "createTenantInterceptor(config.tenantId ?? null)",
    "createOfflineQueueInterceptor(offlineQueue)",
  ]) {
    assert.equal(source.includes(fragment), true, `missing ${fragment}`);
  }
});

test("web runtime seeds auth sessions and prefers BrowserWSClient over an in-memory-only socket", () => {
  for (const fragment of [
    "config.authToken != null && !hasSession(tokenManager)",
    "tokenManager.setSession({",
    "accessToken: authToken",
    "new OtlpHttpTelemetryExporter",
    "startWebVitalsCollection(sink)",
    "constructOrCall(BrowserWSClient, WebSocket, constructOrCall(InMemoryWSClient))",
  ]) {
    assert.equal(source.includes(fragment), true, `missing ${fragment}`);
  }
});

test("service worker registration targets aa-sw.js and emits update notifications", () => {
  for (const fragment of [
    'navigator.serviceWorker.register(`${baseUrl}aa-sw.js`)',
    '"aa-sw-update-available"',
    "registration.waiting != null",
    'installing.state === "installed"',
  ]) {
    assert.equal(source.includes(fragment), true, `missing ${fragment}`);
  }
});
