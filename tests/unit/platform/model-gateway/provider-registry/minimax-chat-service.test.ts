import assert from "node:assert/strict";
import test from "node:test";

import { ProviderCredentialPool } from "../../../../../src/platform/model-gateway/provider-registry/provider-credential-pool.js";
import {
  MiniMaxAPIError,
  MiniMaxChatService,
  createMiniMaxChatServiceFromEnvironment,
} from "../../../../../src/platform/model-gateway/provider-registry/minimax/minimax-chat-service.js";

test("MiniMax chat service fails over to the next credential after retry-after cooldown", async () => {
  const requests: string[] = [];
  const pool = new ProviderCredentialPool({
    provider: "minimax",
    credentials: [
      { credentialId: "cred-a", apiKey: "sk-a" },
      { credentialId: "cred-b", apiKey: "sk-b" },
    ],
  });

  const service = new MiniMaxChatService({
    credentialPool: pool,
    fetchImpl: async (input, init) => {
      void input;
      requests.push(String(init?.headers instanceof Headers ? init.headers.get("Authorization") : (init?.headers as Record<string, string>)?.Authorization));
      if (requests.length === 1) {
        return new Response("rate limited", {
          status: 429,
          statusText: "Too Many Requests",
          headers: new Headers({ "retry-after-ms": "1500" }),
        });
      }

      return new Response(
        JSON.stringify({
          id: "resp-1",
          choices: [
            {
              message: {
                role: "assistant",
                content: "hello",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
          model: "MiniMax-M2",
        }),
        {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        },
      );
    },
  });

  const result = await service.createChatCompletion({
    model: "MiniMax-M2",
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(result.content, "hello");
  assert.deepEqual(requests, ["Bearer sk-a", "Bearer sk-b"]);
  const states = pool.getStates();
  assert.equal(states[0]?.status, "cooling_down");
  assert.equal(states[1]?.effectiveStatus, "active");
});

test("MiniMax chat service disables exhausted credential and surfaces structured error", async () => {
  const pool = new ProviderCredentialPool({
    provider: "minimax",
    credentials: [{ credentialId: "cred-a", apiKey: "sk-a" }],
  });

  const service = new MiniMaxChatService({
    credentialPool: pool,
    fetchImpl: async () =>
      new Response("quota exhausted", {
        status: 402,
        statusText: "Payment Required",
      }),
  });

  await assert.rejects(
    () =>
      service.createChatCompletion({
        model: "MiniMax-M2",
        messages: [{ role: "user", content: "hi" }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof MiniMaxAPIError);
      assert.equal(error.statusCode, 402);
      assert.equal(error.credentialId, "cred-a");
      return true;
    },
  );

  const exhaustion = pool.getExhaustion("2026-04-08T12:00:01.000Z");
  assert.equal(exhaustion.reasonCode, "provider.credentials_disabled");
});

test("MiniMax chat service can bootstrap its credential pool from managed secret refs", async () => {
  const requests: string[] = [];
  const service = createMiniMaxChatServiceFromEnvironment({
    providerEnv: {
      MINIMAX_API_KEY_SECRET_REF: "secret://providers/minimax/default",
    },
    secretResolver: (secretRef) =>
      ({
        "secret://providers/minimax/default": "sk-managed-minimax-default",
      })[secretRef] ?? "",
    fetchImpl: async (_input, init) => {
      requests.push(
        String(
          init?.headers instanceof Headers
            ? init.headers.get("Authorization")
            : (init?.headers as Record<string, string>)?.Authorization,
        ),
      );
      return new Response(
        JSON.stringify({
          id: "resp-managed-1",
          choices: [
            {
              message: {
                role: "assistant",
                content: "managed hello",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 4,
            total_tokens: 13,
          },
          model: "MiniMax-M2",
        }),
        {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        },
      );
    },
  });

  const result = await service.createChatCompletion({
    model: "MiniMax-M2",
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(result.content, "managed hello");
  assert.deepEqual(requests, ["Bearer sk-managed-minimax-default"]);
});

test("MiniMax chat service issues and revokes managed secret leases per request", async () => {
  const requests: string[] = [];
  const issued: string[] = [];
  const revoked: string[] = [];
  const service = createMiniMaxChatServiceFromEnvironment({
    providerEnv: {
      MINIMAX_API_KEY_SECRET_REF: "secret://providers/minimax/default",
    },
    secretLeaseIssuer: (secretRef, context) => {
      issued.push(`${context.credentialId}:${secretRef}`);
      return {
        apiKey: "sk-issued-minimax-lease",
        leaseId: "lease-minimax-1",
        expiresAt: "2099-01-01T00:00:00.000Z",
        leaseSource: "provider_issued",
      };
    },
    secretLeaseRevoker: (leaseId, context) => {
      revoked.push(`${leaseId}:${context.reasonCode}`);
    },
    fetchImpl: async (_input, init) => {
      requests.push(
        String(
          init?.headers instanceof Headers
            ? init.headers.get("Authorization")
            : (init?.headers as Record<string, string>)?.Authorization,
        ),
      );
      return new Response(
        JSON.stringify({
          id: "resp-lease-1",
          choices: [
            {
              message: {
                role: "assistant",
                content: "leased hello",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 8,
            completion_tokens: 4,
            total_tokens: 12,
          },
          model: "MiniMax-M2",
        }),
        {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        },
      );
    },
  });

  const result = await service.createChatCompletion({
    model: "MiniMax-M2",
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(result.content, "leased hello");
  assert.deepEqual(requests, ["Bearer sk-issued-minimax-lease"]);
  assert.deepEqual(issued, ["minimax-managed-default:secret://providers/minimax/default"]);
  assert.deepEqual(revoked, ["lease-minimax-1:provider.request_completed"]);
});
