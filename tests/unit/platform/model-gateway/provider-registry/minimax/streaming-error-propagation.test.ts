import assert from "node:assert/strict";
import test from "node:test";

import {
  MiniMaxChatService,
  type MiniMaxChatCompletionRequest,
} from "../../../../../../../src/platform/model-gateway/provider-registry/minimax/minimax-chat-service.js";

const FAKE_API_KEY = "test-api-key-minimax";
const FAKE_MODEL = "abab6.5s";

test("MiniMax streaming throws MiniMaxAPIError on business error (R27-02)", async () => {
  // Create a mock credential pool that returns a fake credential
  const mockCredentialPool = {
    acquireCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
    }),
    releaseCredential: () => {},
    selectCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
      selectedCredential: { apiKey: FAKE_API_KEY },
    }),
  };

  // Create a mock fetch that returns a streaming response with a business error
  const businessErrorResponse = {
    id: "chatcmpl-test",
    model: FAKE_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello",
        },
        finish_reason: null,
      },
    ],
    base_resp: {
      status_code: 1001, // Business error code
      status_msg: "Invalid request parameters",
    },
  };

  const mockFetch = async () => {
    const stream = new ReadableStream({
      start(controller) {
        // Send the business error response as a streaming SSE
        const data = `data: ${JSON.stringify(businessErrorResponse)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: {
        getReader: () => stream.getReader(),
      },
    } as unknown as Response;
  };

  const service = new MiniMaxChatService({
    apiKey: FAKE_API_KEY,
    fetchImpl: mockFetch,
    credentialPool: mockCredentialPool as unknown as import("../../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js").ProviderCredentialPool,
  });

  const request: MiniMaxChatCompletionRequest = {
    model: FAKE_MODEL,
    messages: [{ role: "user", content: "Hello" }],
    stream: true,
  };

  let caughtError: unknown = null;
  try {
    await service.createStreamingChatCompletion(request, () => {});
    assert.fail("Expected error to be thrown");
  } catch (err) {
    caughtError = err;
  }

  // Verify the business error was propagated, not swallowed at debug level
  assert.ok(caughtError instanceof Error, "Expected an Error to be thrown");
  assert.ok(
    (caughtError as Error).message.includes("1001") || (caughtError as Error).message.includes("MiniMax API business error"),
    `Expected business error to mention status code, got: ${(caughtError as Error).message}`
  );
});

test("MiniMax streaming re-throws MiniMaxAPIError from assertMiniMaxBusinessSuccess", async () => {
  const mockCredentialPool = {
    acquireCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
    }),
    releaseCredential: () => {},
    selectCredential: async () => ({
      credentialId: "fake-cred",
      leaseId: "fake-lease",
      selectedCredential: { apiKey: FAKE_API_KEY },
    }),
  };

  // Response where status code 30001 indicates a business error
  const businessErrorResponse = {
    id: "chatcmpl-test",
    model: FAKE_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "partial response",
        },
        finish_reason: null,
      },
    ],
    base_resp: {
      status_code: 30001,
      status_msg: "Account quota exceeded",
    },
  };

  const mockFetch = async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(businessErrorResponse)}\n\n`));
        controller.close();
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: {
        getReader: () => stream.getReader(),
      },
    } as unknown as Response;
  };

  const service = new MiniMaxChatService({
    apiKey: FAKE_API_KEY,
    fetchImpl: mockFetch,
    credentialPool: mockCredentialPool as unknown as import("../../../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js").ProviderCredentialPool,
  });

  const request: MiniMaxChatCompletionRequest = {
    model: FAKE_MODEL,
    messages: [{ role: "user", content: "Hello" }],
    stream: true,
  };

  let thrownError: unknown = null;
  try {
    await service.createStreamingChatCompletion(request, () => {});
  } catch (err) {
    thrownError = err;
  }

  // The fix ensures MiniMaxAPIError is thrown and logged at error level, not swallowed
  assert.ok(thrownError instanceof Error, "Business error must be propagated");
  assert.ok(
    (thrownError as Error).message.includes("30001") || (thrownError as Error).message.includes("Account quota exceeded"),
    `Error should mention business error details: ${(thrownError as Error).message}`
  );
});