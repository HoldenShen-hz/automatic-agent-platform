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
  const draft = resolutionAgent.draft(market, ["evidence:official-announcement"]);

  assert.equal(review.decision, "approve");
  assert.equal(draft.requiresHumanReview, false);
  assert.equal(draft.proposedOutcomeId, market.outcomes[0]!.outcomeId);
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
