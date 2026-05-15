import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIChatService } from "../../../../src/platform/model-gateway/provider-registry/openai/openai-chat-service.js";
import {
  createWebSearchTool,
} from "../../../../src/platform/five-plane-execution/tool-executor/web-search.js";
import { resetGlobalNetworkEgressPolicyService } from "../../../../src/platform/five-plane-control-plane/iam/network-egress-policy.js";
import { withEnv } from "../../../helpers/env.js";

async function withResetEgressEnv<T>(overrides: Record<string, string>, run: () => Promise<T>): Promise<T> {
  resetGlobalNetworkEgressPolicyService();
  try {
    let value!: T;
    await withEnv(overrides, async () => {
      value = await run();
    });
    return value;
  } finally {
    resetGlobalNetworkEgressPolicyService();
  }
}

test("provider egress enforcement blocks disallowed model endpoint hosts", async () => {
  await withResetEgressEnv(
    {
      AA_EGRESS_POLICY_MODE: "enforce",
      AA_EGRESS_ALLOWED_DOMAINS: "api.anthropic.com",
    },
    async () => {
      const service = new OpenAIChatService({
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com",
        fetchImpl: async () => new Response("ok", { status: 200 }),
      });

      await assert.rejects(
        () =>
          service.createChatCompletion({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "hello" }],
          }),
        /egress\.blocked:EGRESS_DOMAIN_NOT_ALLOWED:api\.openai\.com/,
      );
    },
  );
});

test("web search fail-closes when egress policy blocks duckduckgo", async () => {
  await withResetEgressEnv(
    {
      AA_EGRESS_POLICY_MODE: "enforce",
      AA_EGRESS_ALLOWED_DOMAINS: "api.openai.com",
    },
    async () => {
      const tool = createWebSearchTool();
      const result = await tool.execute({ query: "automatic agent" });
      assert.equal(result.success, false);
      assert.equal(result.errorCode, "FETCH_ERROR");
      assert.match(result.error ?? "", /egress\.blocked:EGRESS_DOMAIN_NOT_ALLOWED:duckduckgo\.com/);
    },
  );
});
