import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  ApiClientConfig,
  ApiErrorCategory,
  VersionHandshakeResult,
} from "../../../../src/sdk/client-sdk/index.js";

/**
 * Unit tests for version handshake negotiation in RetryableApiClient.
 */

test("performVersionHandshake sends correct version headers and returns accepted result on 200", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
    platformVersion: "2026.04.01",
    contractVersion: "1.0.0",
  };
  const client = new RetryableApiClient(config);

  let capturedUrl: string | undefined;
  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url.toString();
    capturedHeaders = { ...(options?.headers as Record<string, string>) };
    return new Response(JSON.stringify({ accepted: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-sdk-compatibility": "compatible",
        "x-platform-version": "2026.04.01",
        "x-contract-version": "1.0.0",
      },
    });
  };

  try {
    const result = await client.performVersionHandshake();
    assert.equal(result.accepted, true);
    assert.equal(result.statusCode, 200);
    assert.equal(result.reasonCode, "sdk.accepted");
    // Verify version headers were sent (buildAuthHeaders uses uppercase for custom headers)
    assert.equal(capturedHeaders["X-SDK-Version"], "1.0.0");
    assert.equal(capturedHeaders["X-Platform-Version"], "2026.04.01");
    assert.equal(capturedHeaders["X-Contract-Version"], "1.0.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("performVersionHandshake throws ApiError with CONTRACT category on 426 rejection", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "0.9.0",
    platformVersion: "2026.04.01",
    contractVersion: "1.0.0",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Upgrade required" }), {
      status: 426,
      headers: {
        "content-type": "application/json",
        "x-sdk-compatibility": "upgrade_required",
        "x-platform-version": "2026.04.01",
        "x-contract-version": "1.0.0",
      },
    });

  try {
    await assert.rejects(
      client.performVersionHandshake(),
      (error: unknown) => {
        return (
          error instanceof Error &&
          error.message.includes("Version handshake rejected") &&
          error.message.includes("sdk.upgrade_required") &&
          "category" in error &&
          (error as { category: ApiErrorCategory }).category === ApiErrorCategory.CONTRACT
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("performVersionHandshake parses compatibility warnings from response headers", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
    platformVersion: "2026.04.01",
    contractVersion: "1.0.0",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ accepted: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-sdk-compatibility": "compatibility_warning",
        "x-sdk-warnings": "sdk_outdated,recommended=1.2.0",
        "x-platform-version": "2026.04.01",
        "x-contract-version": "1.0.0",
      },
    });

  try {
    const result = await client.performVersionHandshake();
    assert.equal(result.accepted, true);
    assert.equal(result.statusCode, 200);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings.some((w) => w.includes("sdk_outdated")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("performVersionHandshake handles handshake endpoint timeout", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
    timeoutMs: 50,
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    // Simulate timeout by throwing an AbortError (what AbortSignal.timeout produces)
    const error = new DOMException("aborted", "AbortError");
    throw error;
  };

  try {
    await assert.rejects(
      client.performVersionHandshake(),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("performVersionHandshake constructs correct URL with path /handshake", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
  };
  const client = new RetryableApiClient(config);

  let capturedUrl: string | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ accepted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.performVersionHandshake();
    assert.ok(capturedUrl !== undefined);
    assert.ok(capturedUrl!.includes("/v1/handshake"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("performVersionHandshake returns VersionHandshakeResult with correct structure", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ accepted: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-sdk-compatibility": "compatible",
      },
    });

  try {
    const result = await client.performVersionHandshake();
    // Verify structure
    assert.ok("accepted" in result);
    assert.ok("statusCode" in result);
    assert.ok("reasonCode" in result);
    assert.ok("headers" in result);
    assert.ok("warnings" in result);
    assert.ok(Array.isArray(result.warnings));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("performVersionHandshake sends accept header for JSON response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
  };
  const client = new RetryableApiClient(config);

  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedHeaders = options?.headers as Record<string, string> ?? {};
    return new Response(JSON.stringify({ accepted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.performVersionHandshake();
    assert.equal(capturedHeaders["accept"], "application/json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});