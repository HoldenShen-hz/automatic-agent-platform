import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  DegradationController,
  DegradationLevel,
  DEFAULT_TEMPLATE_RESPONSES,
  type LLMDegradationRequest,
} from "../../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import type { ModelFallbackCandidate } from "../../../../../src/platform/model-gateway/fallback/index.js";

interface MockChatResult {
  id: string;
  content: string;
  refusal: string | null;
  reasoningContent: string | null;
  finishReason: string;
  stopSequence: string | null;
  toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  provider: string;
}

class MockUnifiedChatProvider {
  public readonly createChatCompletion = mock.fn(async (_request: { model: string; messages: unknown[] }): Promise<MockChatResult> => {
    throw new Error("provider_down");
  });

  public readonly getAvailableProfiles = mock.fn(() => [] satisfies ModelFallbackCandidate[]);
}

class MockFallbackService {
  public readonly selectFallback = mock.fn((input: { primaryProfileName: string; candidates: ModelFallbackCandidate[] }) => ({
    selectedProfileName: input.candidates[0]?.profileName ?? null,
    reasonCode: input.candidates.length > 0 ? "fallback.selected" : "fallback.no_candidate_available",
    degradedFromProfileName: input.primaryProfileName,
    attemptedProfiles: input.candidates.map((candidate) => candidate.profileName),
  }));
}

class MockCacheService {
  public put(): void {}

  public get(): null {
    return null;
  }
}

function createController(primaryProvider: MockUnifiedChatProvider): DegradationController {
  return new DegradationController({
    primaryProvider: primaryProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
    fallbackProvider: null,
    fallbackService: new MockFallbackService() as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
    cacheService: new MockCacheService() as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
  });
}

const failingRequest: LLMDegradationRequest = {
  model: "primary-model",
  routeClass: "default",
  messages: [{ role: "user", content: "Hello" }],
};

test("degradation controller recursion depth is scoped to a single route call", async () => {
  const provider = new MockUnifiedChatProvider();
  const controller = createController(provider);

  const first = await controller.route(failingRequest);
  assert.equal(first.degradationLevel, DegradationLevel.D3);
  assert.equal(first.content, DEFAULT_TEMPLATE_RESPONSES.default);
  assert.equal(provider.createChatCompletion.mock.calls.length, 1);

  controller.reset();

  const second = await controller.route(failingRequest);
  assert.equal(second.degradationLevel, DegradationLevel.D3);
  assert.equal(second.content, DEFAULT_TEMPLATE_RESPONSES.default);
  assert.equal(provider.createChatCompletion.mock.calls.length, 2);
});
