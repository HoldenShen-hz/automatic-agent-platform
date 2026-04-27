import assert from "node:assert/strict";
import test from "node:test";

import { ModelRoutingService } from "../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";
import { ModelGatewayFallbackService } from "../../../../src/platform/model-gateway/fallback/index.js";
import { DegradationController, DegradationLevel } from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import { estimateTextTokens, estimateMessageTokens } from "../../../../src/platform/model-gateway/messages/token-estimator.js";
import { buildMessageParts, parseMessagePartsJson, renderMessagePartContent } from "../../../../src/platform/model-gateway/messages/message-parts.js";

test("ModelRoutingService and DegradationController integration", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "gpt-4": {
          name: "gpt-4",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text", "function_calling"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
        "gpt-4-fast": {
          name: "gpt-4-fast",
          provider: "openai",
          tier: "fast",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.005, outputPer1kUsd: 0.015 },
          maxOutputTokens: 4096,
        },
        "claude-sonnet": {
          name: "claude-sonnet",
          provider: "anthropic",
          tier: "balanced",
          capabilities: ["text", "vision"],
          pricing: { inputPer1kUsd: 0.015, outputPer1kUsd: 0.075 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
        "anthropic": { id: "anthropic", name: "Anthropic", status: "active" as const },
      },
    },
    providerHealth: {
      "openai": { status: "healthy" as const, latencyMs: 100, errorRate: 0.01 },
      "anthropic": { status: "healthy" as const, latencyMs: 150, errorRate: 0.02 },
    },
  });

  const decision = routingService.route({
    routeClass: "default",
    riskLevel: "medium",
    turnId: "turn_001",
  });

  assert.ok(decision.profileName.length > 0);
  assert.ok(decision.trace !== undefined);
  assert.ok(decision.trace.targetTierOrder.length > 0);
});

test("ModelRoutingService with governance snapshot integration", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "gpt-4": {
          name: "gpt-4",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
      },
    },
  });

  const decision = routingService.route({
    governanceSnapshot: {
      profileStatuses: { "gpt-4": "degraded" },
      rollbackTargets: { "gpt-4": null },
    },
  });

  assert.ok(decision.profileName === "gpt-4" || decision.trace.selectedGovernanceStatus === "degraded");
});

test("ModelRoutingService fallback lease integration", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "gpt-4": {
          name: "gpt-4",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
        "gpt-4-fast": {
          name: "gpt-4-fast",
          provider: "openai",
          tier: "fast",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.005, outputPer1kUsd: 0.015 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
      },
    },
    providerHealth: {
      "openai": { status: "degraded" as const, latencyMs: 500, errorRate: 0.1 },
    },
  });

  const decision = routingService.route({
    routeClass: "default",
    turnId: "turn_001",
  });

  assert.ok(decision.fallbackLease !== null || decision.trace.turnScopedFallbackIssued === false);
});

test("Token estimation workflow integration", () => {
  const text = "This is a sample text for token estimation. It contains multiple words and sentences.";

  const textTokens = estimateTextTokens(text);
  assert.ok(textTokens > 0);

  const message = {
    content: text,
    partsJson: null,
  };

  const messageTokens = estimateMessageTokens(message);
  assert.ok(messageTokens > 0);

  assert.ok(messageTokens >= textTokens);
});

test("Message parts parsing and rendering workflow", () => {
  const message = {
    id: "msg_integration_001",
    messageType: "user",
    content: "Hello, how are you?",
    createdAt: new Date().toISOString(),
  };

  const parts = buildMessageParts(message);
  assert.ok(parts.length > 0);

  const json = JSON.stringify(parts);
  const parsed = parseMessagePartsJson(json);
  assert.equal(parsed.length, parts.length);

  for (const part of parsed) {
    const content = renderMessagePartContent(part);
    assert.ok(typeof content === "string");
  }
});

test("DegradationController state transitions", () => {
  const mockProvider = {
    createChatCompletion: async () => ({
      id: "msg_001",
      content: "Response",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "gpt-4",
      provider: "mock",
    }),
    dispose: () => {},
  } as any;

  const fallbackService = new ModelGatewayFallbackService();
  const cacheService = {
    put: () => ({ value: "", model: "", expiresAt: 0 }),
    get: () => null,
    invalidate: () => true,
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    cleanupExpired: async () => 0,
    buildCacheKey: () => "",
  } as any;

  const controller = new DegradationController({
    primaryProvider: mockProvider,
    fallbackService,
    cacheService,
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.reset();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("ModelRoutingService with cost cap integration", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "expensive-model": {
          name: "expensive-model",
          provider: "openai",
          tier: "reasoning",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.1, outputPer1kUsd: 0.3 },
          maxOutputTokens: 4096,
        },
        "cheap-model": {
          name: "cheap-model",
          provider: "openai",
          tier: "fast",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.001, outputPer1kUsd: 0.003 },
          maxOutputTokens: 2048,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
      },
    },
  });

  const decision = routingService.route({
    maxInputPer1kUsd: 0.05,
    allowStrongUpgrade: false,
  });

  assert.ok(decision.profile.pricing.inputPer1kUsd <= 0.05 || decision.trace.routeReason === "cost_cap_fallback");
});

test("ModelRoutingService route class tier ordering", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "coding-model": {
          name: "coding-model",
          provider: "openai",
          tier: "coding",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
        "reasoning-model": {
          name: "reasoning-model",
          provider: "openai",
          tier: "reasoning",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.015, outputPer1kUsd: 0.045 },
          maxOutputTokens: 4096,
        },
        "balanced-model": {
          name: "balanced-model",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.008, outputPer1kUsd: 0.024 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
      },
    },
  });

  const codingDecision = routingService.route({ routeClass: "coding" });
  assert.equal(codingDecision.trace.requestedRouteClass, "coding");

  const reasoningDecision = routingService.route({ routeClass: "reasoning" });
  assert.equal(reasoningDecision.trace.requestedRouteClass, "reasoning");
});

test("ModelRoutingService with required capabilities", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "vision-model": {
          name: "vision-model",
          provider: "anthropic",
          tier: "balanced",
          capabilities: ["text", "vision"],
          pricing: { inputPer1kUsd: 0.015, outputPer1kUsd: 0.075 },
          maxOutputTokens: 4096,
        },
        "text-only-model": {
          name: "text-only-model",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
        "anthropic": { id: "anthropic", name: "Anthropic", status: "active" as const },
      },
    },
  });

  const decision = routingService.route({
    requiredCapabilities: ["vision"],
  });

  assert.ok(decision.profile.capabilities.includes("vision"));
});

test("DegradationController health evaluation integration", () => {
  const mockProvider = {
    createChatCompletion: async () => ({ id: "msg", content: "resp", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, model: "m", provider: "p" }),
    dispose: () => {},
  } as any;

  const controller = new DegradationController({
    primaryProvider: mockProvider,
    fallbackService: new ModelGatewayFallbackService(),
    cacheService: { put: () => ({}), get: () => null, invalidate: () => true, buildCacheKey: () => "", invalidateByTag: async () => 0, invalidateNamespace: async () => 0, cleanupExpired: async () => 0 } as any,
  });

  controller.setLevel(DegradationLevel.D1);

  const result1 = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result1.newLevel, DegradationLevel.D1);

  const result2 = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 60,
    errorRate: 60,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result2.action, "escalate");
});

test("Message parts with multiple sequences integration", () => {
  const message = {
    id: "msg_multi",
    messageType: "tool_result",
    content: "Tool result content",
    createdAt: new Date().toISOString(),
  };

  const parts = buildMessageParts(message);
  const serialized = JSON.stringify(parts);
  const parsed = parseMessagePartsJson(serialized);

  assert.equal(parsed.length, parts.length);

  let renderedContent = "";
  for (const part of parsed) {
    renderedContent += renderMessagePartContent(part) + " ";
  }

  assert.ok(renderedContent.includes("Tool result"));
});

test("ModelRoutingService with sticky profile", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "preferred-model": {
          name: "preferred-model",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
        "other-model": {
          name: "other-model",
          provider: "anthropic",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.015, outputPer1kUsd: 0.075 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
        "anthropic": { id: "anthropic", name: "Anthropic", status: "active" as const },
      },
    },
  });

  const decision = routingService.route({
    stickyProfileName: "preferred-model",
  });

  assert.equal(decision.profileName, "preferred-model");
  assert.equal(decision.trace.routeReason, "sticky_profile");
});

test("ModelRoutingService pinned profile throws when disabled", () => {
  const routingService = new ModelRoutingService({
    registry: {
      profiles: {
        "disabled-model": {
          name: "disabled-model",
          provider: "openai",
          tier: "balanced",
          capabilities: ["text"],
          pricing: { inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
          maxOutputTokens: 4096,
        },
      },
      providers: {
        "openai": { id: "openai", name: "OpenAI", status: "active" as const },
      },
    },
    providerHealth: {},
  });

  assert.throws(() => {
    routingService.route({
      pinnedProfileName: "disabled-model",
      governanceSnapshot: {
        profileStatuses: { "disabled-model": "disabled" },
        rollbackTargets: { "disabled-model": null },
      },
    });
  }, /governance_disabled/);
});
