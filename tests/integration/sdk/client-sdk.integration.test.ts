/**
 * @fileoverview Integration tests for SDK Client Flow
 * Tests the end-to-end flow of SDK client operations
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  createApiClient,
} from "../../../src/sdk/client-sdk/api-client.js";

test("Integration: API Client creates run and retrieves result", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      runId: "harness_run_123",
      status: "running",
      taskId: "task_456",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ runId: string; status: string; taskId: string }>(
      "/harness-runs",
      { taskId: "task_456" }
    );

    assert.equal(result.data.runId, "harness_run_123");
    assert.equal(result.data.status, "running");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client lists harness runs with pagination", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { runId: "run_1", status: "completed" },
      { runId: "run_2", status: "running" },
    ]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "next-page-token",
        "x-total-count": "50",
      },
    });

  try {
    const result = await client.getPaginated<{ runId: string; status: string }>(
      "/harness-runs",
      { limit: 10 }
    );

    assert.equal(result.data.length, 2);
    assert.equal(result.nextCursor, "next-page-token");
    assert.equal(result.totalCount, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client pauses harness run", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      runId: "harness_run_123",
      status: "paused",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ runId: string; status: string }>(
      "/harness-runs/harness_run_123/pause",
      { reason: "User requested pause" }
    );

    assert.equal(result.data.status, "paused");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client aborts harness run", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      runId: "harness_run_123",
      status: "aborted",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ runId: string; status: string }>(
      "/harness-runs/harness_run_123/abort",
      { reason: "User requested abort" }
    );

    assert.equal(result.data.status, "aborted");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client publishes pack", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      packId: "pack_123",
      status: "published",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.publishPack<{ packId: string; status: string }>(
      "pack_123",
      { version: "1.0.0" }
    );

    assert.equal(result.data.packId, "pack_123");
    assert.equal(result.data.status, "published");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client retries on 429 with backoff", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      return new Response(JSON.stringify({}), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "1" },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ success: boolean }>("/test");
    assert.equal(result.data.success, true);
    assert.equal(attemptCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client throws AuthError on 401", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "invalid-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "auth_failed",
      message: "Invalid token",
    }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.get("/test"),
      (error: unknown) => {
        return error instanceof Error && error.message.includes("Authentication/authorization failed");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: API Client throws BusinessError on 400", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "validation_error",
      message: "Invalid input",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.post("/test", { invalid: true }),
      (error: unknown) => {
        return error instanceof Error && error.message.includes("Request failed with status 400");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Integration: createApiClient validates required configuration", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "",
      apiVersion: "v1",
      bearerToken: "test-token",
    } as any),
    /baseUrl/
  );

  assert.throws(
    () => createApiClient({
      baseUrl: "https://api.example.com",
      apiVersion: "",
      bearerToken: "test-token",
    } as any),
    /apiVersion/
  );
});