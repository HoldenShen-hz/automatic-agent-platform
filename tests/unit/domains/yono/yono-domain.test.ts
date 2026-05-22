import test from "node:test";
import assert from "node:assert/strict";

import {
  YONO_DOMAIN_ID,
  YonoCommentService,
  YonoCommentSignalService,
  YonoConsensusProbabilityService,
  YonoForecastService,
  YonoMarketReviewAgent,
  YonoMarketService,
  YonoRepository,
  YonoResolutionAssistAgent,
  YonoSocialForecastAgent,
  YonoTradingService,
  registerYonoDomain,
} from "../../../../src/domains/yono/index.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";

test("YONO domain registers as a business domain capability", () => {
  const registry = new DomainRegistryService();
  const definition = registerYonoDomain(registry);

  assert.equal(definition.domainId, YONO_DOMAIN_ID);
  assert.equal(registry.get(YONO_DOMAIN_ID)?.status, "active");
  assert.ok(definition.capabilities.supportedTaskTypes.includes("social_forecast"));
});

test("YONO market, comment signal, forecast and consensus flow works", () => {
  const repository = new YonoRepository();
  const marketService = new YonoMarketService(repository);
  const commentService = new YonoCommentService(repository);
  const signalService = new YonoCommentSignalService(repository);
  const forecastService = new YonoForecastService(repository);
  const consensusService = new YonoConsensusProbabilityService(repository);
  const socialAgent = new YonoSocialForecastAgent(repository);

  const market = marketService.createMarket({
    title: "Will a major Web3 project announce an airdrop?",
    description: "Resolves YES if the project officially announces an airdrop before the deadline.",
    creatorId: "user_001",
    closeAt: "2026-06-01T00:00:00.000Z",
    resolutionDeadline: "2026-06-07T00:00:00.000Z",
    tags: ["web3", "airdrop"],
  });
  const comment = commentService.createComment({
    marketId: market.marketId,
    userId: "user_002",
    text: "YES likely, source https://example.com announcement data looks strong",
  });
  const signal = signalService.extractSignal(comment);
  const forecast = forecastService.submitForecast({
    marketId: market.marketId,
    userId: "user_002",
    outcomeId: market.outcomes[0]!.outcomeId,
    probability: 0.7,
  });
  const consensus = consensusService.calculate(market.marketId);
  const social = socialAgent.run(market.marketId);

  assert.equal(signal.stance, "yes");
  assert.equal(signal.evidenceBacked, true);
  assert.equal(forecast.forecastType, "explicit_probability");
  assert.ok(consensus.yonoConsensusProbability > 0.5);
  assert.equal(social.trend, "bullish");
});

test("YONO market review and resolution agents surface governance decisions", () => {
  const repository = new YonoRepository();
  const marketService = new YonoMarketService(repository);
  const reviewAgent = new YonoMarketReviewAgent();
  const resolutionAgent = new YonoResolutionAssistAgent();

  const market = marketService.createMarket({
    title: "Will a Web3 protocol ship mainnet?",
    description: "Resolves YES if official mainnet launch evidence is published before deadline.",
    creatorId: "user_001",
    closeAt: "2026-06-01T00:00:00.000Z",
    resolutionDeadline: "2026-06-07T00:00:00.000Z",
  });
  const review = reviewAgent.review(market);
  const draft = resolutionAgent.draft(market, ["evidence:official-announcement:yes"]);

  assert.equal(review.decision, "approve");
  assert.equal(draft.requiresHumanReview, false);
  assert.equal(draft.proposedOutcomeId, market.outcomes[0]!.outcomeId);
  assert.ok(draft.confidence >= 0.35);
});

test("YONO points trading creates and cancels orders without real-money settlement", () => {
  const repository = new YonoRepository();
  const market = new YonoMarketService(repository).createMarket({
    title: "Will benchmark X be beaten?",
    description: "Resolves YES if benchmark X is beaten by the stated deadline.",
    creatorId: "user_001",
    closeAt: "2026-06-01T00:00:00.000Z",
    resolutionDeadline: "2026-06-07T00:00:00.000Z",
  });
  const trading = new YonoTradingService(repository);
  const order = trading.createOrder({
    marketId: market.marketId,
    outcomeId: market.outcomes[0]!.outcomeId,
    userId: "user_001",
    side: "buy",
    quantity: 10,
  });

  assert.equal(order.status, "accepted");
  assert.equal(trading.cancelOrder(order.orderId).status, "cancelled");
});

test("YONO signal extraction does not treat plain source word as evidence and supports low confidence", () => {
  const repository = new YonoRepository();
  const signal = new YonoCommentSignalService(repository).extractSignal({
    commentId: "comment-1",
    marketId: "market-1",
    userId: "user-1",
    text: "this source seems mixed",
    createdAt: "2026-05-01T00:00:00.000Z",
    engagement: { likes: 0, replies: 0, shares: 0, reports: 0 },
    source: "market_comment",
    visibility: "public",
    moderationStatus: "visible",
  });
  assert.equal(signal.evidenceBacked, false);
  assert.equal(signal.confidence, "low");
});

test("YONO signal probability scales with matched evidence instead of fixed yes/no constants", () => {
  const repository = new YonoRepository();
  const service = new YonoCommentSignalService(repository);
  const weakerYes = service.extractSignal({
    commentId: "comment-weak",
    marketId: "market-1",
    userId: "user-1",
    text: "yes",
    createdAt: "2026-05-01T00:00:00.000Z",
    engagement: { likes: 0, replies: 0, shares: 0, reports: 0 },
    source: "market_comment",
    visibility: "public",
    moderationStatus: "visible",
  });
  const strongerYes = service.extractSignal({
    commentId: "comment-strong",
    marketId: "market-1",
    userId: "user-1",
    text: "yes bullish likely will confirmed",
    createdAt: "2026-05-01T00:00:00.000Z",
    engagement: { likes: 0, replies: 0, shares: 0, reports: 0 },
    source: "market_comment",
    visibility: "public",
    moderationStatus: "visible",
  });

  assert.ok(weakerYes.probability > 0.5);
  assert.ok(strongerYes.probability > weakerYes.probability);
});

test("YONO market and order validation fail closed for invalid timing and negative orders", () => {
  const repository = new YonoRepository();
  const marketService = new YonoMarketService(repository);
  const trading = new YonoTradingService(repository);

  assert.throws(
    () => marketService.createMarket({
      title: "Invalid timing",
      description: "Resolves in the wrong order.",
      creatorId: "user_001",
      closeAt: "2020-01-01T00:00:00.000Z",
      resolutionDeadline: "2020-01-02T00:00:00.000Z",
    }),
    /yono\.market\.invalid_close_at/,
  );

  const market = marketService.createMarket({
    title: "Valid market",
    description: "Resolves YES if valid evidence is published after launch.",
    creatorId: "user_001",
    closeAt: "2026-06-01T00:00:00.000Z",
    resolutionDeadline: "2026-06-07T00:00:00.000Z",
  });
  assert.throws(
    () => trading.createOrder({
      marketId: market.marketId,
      outcomeId: market.outcomes[0]!.outcomeId,
      userId: "user_001",
      side: "buy",
      quantity: -1,
    }),
    /yono\.order\.invalid_quantity/,
  );
});

test("YONO resolution assist can select matching no outcome from evidence refs", () => {
  const repository = new YonoRepository();
  const market = new YonoMarketService(repository).createMarket({
    title: "Will rollout fail?",
    description: "Resolves NO if no official outage report is published before the deadline.",
    creatorId: "user_001",
    closeAt: "2026-06-01T00:00:00.000Z",
    resolutionDeadline: "2026-06-07T00:00:00.000Z",
  });
  const noOutcome = market.outcomes.find((outcome) => outcome.type === "no");
  const draft = new YonoResolutionAssistAgent().draft(market, ["evidence:official:no"]);
  assert.equal(draft.proposedOutcomeId, noOutcome?.outcomeId);
});
