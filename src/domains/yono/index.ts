import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { DomainDefinition } from "../registry/domain-model.js";
import type { DomainRegistryService } from "../registry/domain-registry-service.js";
import {
  YONO_DOMAIN_ID,
  YonoCommentSchema,
  YonoCommentSignalSchema,
  YonoDisputeSchema,
  YonoForecastSchema,
  YonoMarketSchema,
  YonoOrderSchema,
  YonoOutcomeSchema,
  YonoPositionSchema,
  YonoTradeSchema,
  type MarketReviewResult,
  type ResolutionDraft,
  type SocialForecastOutput,
  type YonoCategory,
  type YonoComment,
  type YonoCommentSignal,
  type YonoDispute,
  type YonoEventEnvelope,
  type YonoEventType,
  type YonoForecast,
  type YonoMarket,
  type YonoOrder,
  type YonoOutcome,
  type YonoPosition,
  type YonoTrade,
} from "./yono-model.js";
export * from "./yono-model.js";

export class YonoRepository {
  private readonly markets = new Map<string, YonoMarket>();
  private readonly comments = new Map<string, YonoComment>();
  private readonly signals = new Map<string, YonoCommentSignal>();
  private readonly forecasts = new Map<string, YonoForecast>();
  private readonly orders = new Map<string, YonoOrder>();
  private readonly trades = new Map<string, YonoTrade>();
  private readonly positions = new Map<string, YonoPosition>();
  private readonly disputes = new Map<string, YonoDispute>();
  private readonly events: YonoEventEnvelope[] = [];

  public saveMarket(market: YonoMarket): YonoMarket {
    const parsed = YonoMarketSchema.parse(market);
    this.markets.set(parsed.marketId, parsed);
    return parsed;
  }

  public getMarket(marketId: string): YonoMarket | null {
    return this.markets.get(marketId) ?? null;
  }

  public listMarkets(): YonoMarket[] {
    return [...this.markets.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  public saveComment(comment: YonoComment): YonoComment {
    const parsed = YonoCommentSchema.parse(comment);
    this.comments.set(parsed.commentId, parsed);
    return parsed;
  }

  public listComments(marketId: string): YonoComment[] {
    return [...this.comments.values()].filter((comment) => comment.marketId === marketId);
  }

  public saveSignal(signal: YonoCommentSignal): YonoCommentSignal {
    const parsed = YonoCommentSignalSchema.parse(signal);
    this.signals.set(parsed.signalId, parsed);
    return parsed;
  }

  public listSignals(marketId: string): YonoCommentSignal[] {
    return [...this.signals.values()].filter((signal) => signal.marketId === marketId);
  }

  public saveForecast(forecast: YonoForecast): YonoForecast {
    const parsed = YonoForecastSchema.parse(forecast);
    this.forecasts.set(parsed.forecastId, parsed);
    return parsed;
  }

  public listForecasts(marketId: string): YonoForecast[] {
    return [...this.forecasts.values()].filter((forecast) => forecast.marketId === marketId);
  }

  public saveOrder(order: YonoOrder): YonoOrder {
    const parsed = YonoOrderSchema.parse(order);
    this.orders.set(parsed.orderId, parsed);
    return parsed;
  }

  public getOrder(orderId: string): YonoOrder | null {
    return this.orders.get(orderId) ?? null;
  }

  public listOrders(userId?: string): YonoOrder[] {
    return [...this.orders.values()].filter((order) => userId == null || order.userId === userId);
  }

  public saveTrade(trade: YonoTrade): YonoTrade {
    const parsed = YonoTradeSchema.parse(trade);
    this.trades.set(parsed.tradeId, parsed);
    return parsed;
  }

  public listTrades(marketId?: string): YonoTrade[] {
    return [...this.trades.values()].filter((trade) => marketId == null || trade.marketId === marketId);
  }

  public savePosition(position: YonoPosition): YonoPosition {
    const parsed = YonoPositionSchema.parse(position);
    this.positions.set(parsed.positionId, parsed);
    return parsed;
  }

  public listPositions(userId?: string): YonoPosition[] {
    return [...this.positions.values()].filter((position) => userId == null || position.userId === userId);
  }

  public saveDispute(dispute: YonoDispute): YonoDispute {
    const parsed = YonoDisputeSchema.parse(dispute);
    this.disputes.set(parsed.disputeId, parsed);
    return parsed;
  }

  public getDispute(disputeId: string): YonoDispute | null {
    return this.disputes.get(disputeId) ?? null;
  }

  public listDisputes(marketId: string): YonoDispute[] {
    return [...this.disputes.values()].filter((dispute) => dispute.marketId === marketId);
  }

  public appendEvent<TPayload>(eventType: YonoEventType, aggregateId: string, payload: TPayload): YonoEventEnvelope<TPayload> {
    const event = { eventId: newId("yevt"), eventType, aggregateId, occurredAt: nowIso(), payload };
    this.events.push(event);
    return event;
  }

  public listEvents(): readonly YonoEventEnvelope[] {
    return [...this.events];
  }
}

export class YonoMarketService {
  public constructor(private readonly repository: YonoRepository) {}

  public createMarket(input: {
    readonly title: string;
    readonly description: string;
    readonly category?: YonoCategory;
    readonly creatorId: string;
    readonly closeAt: string;
    readonly resolutionDeadline: string;
    readonly tags?: readonly string[];
    readonly outcomes?: readonly { readonly label: string; readonly type: YonoOutcome["type"] }[];
  }): YonoMarket {
    const marketId = newId("ymkt");
    const timestamp = nowIso();
    const outcomeSpecs = input.outcomes ?? [{ label: "YES", type: "yes" }, { label: "NO", type: "no" }];
    const outcomes = outcomeSpecs.map((outcome) => YonoOutcomeSchema.parse({
      outcomeId: newId("yout"),
      marketId,
      label: outcome.label,
      type: outcome.type,
      currentPrice: 0.5,
      impliedProbability: 0.5,
      liquidityUsd: 0,
    }));
    const market = this.repository.saveMarket({
      marketId,
      title: input.title,
      description: input.description,
      category: input.category ?? "web3",
      outcomeType: outcomes.length === 2 && outcomes.some((item) => item.type === "yes") ? "binary" : "multi_choice",
      outcomes,
      openAt: timestamp,
      closeAt: input.closeAt,
      resolutionDeadline: input.resolutionDeadline,
      status: "draft",
      creatorId: input.creatorId,
      resolverPolicyId: "yono.default.resolution-policy",
      liquidity: { totalLiquidityUsd: 0, volume24hUsd: 0, volumeTotalUsd: 0 },
      probability: { marketProbability: 0.5, updatedAt: timestamp },
      risk: { manipulationRisk: "low", resolutionRisk: "medium", ambiguityRisk: "medium", regulatoryRisk: "medium" },
      tags: [...(input.tags ?? [])],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.repository.appendEvent("yono.market.created", market.marketId, { marketId: market.marketId });
    return market;
  }

  public transitionMarket(marketId: string, status: YonoMarket["status"]): YonoMarket {
    const current = this.requireMarket(marketId);
    const updated = this.repository.saveMarket({ ...current, status, updatedAt: nowIso() });
    const eventType = status === "open"
      ? "yono.market.opened"
      : status === "paused"
        ? "yono.market.paused"
        : status === "closed"
          ? "yono.market.closed"
          : status === "resolved"
            ? "yono.market.resolved"
            : "yono.market.review_requested";
    this.repository.appendEvent(eventType, marketId, { marketId, status });
    return updated;
  }

  public resolveMarket(marketId: string, outcomeId: string): YonoMarket {
    const current = this.requireMarket(marketId);
    if (!current.outcomes.some((outcome) => outcome.outcomeId === outcomeId)) {
      throw new Error("yono.market.invalid_outcome");
    }
    return this.transitionMarket(marketId, "resolved");
  }

  public requireMarket(marketId: string): YonoMarket {
    const market = this.repository.getMarket(marketId);
    if (market == null) {
      throw new Error("yono.market.not_found");
    }
    return market;
  }
}

export class YonoCommentService {
  public constructor(private readonly repository: YonoRepository) {}

  public createComment(input: { readonly marketId: string; readonly userId: string; readonly text: string; readonly parentCommentId?: string }): YonoComment {
    const comment = this.repository.saveComment({
      commentId: newId("ycmt"),
      marketId: input.marketId,
      userId: input.userId,
      ...(input.parentCommentId != null ? { parentCommentId: input.parentCommentId } : {}),
      text: input.text,
      createdAt: nowIso(),
      engagement: { likes: 0, replies: 0, shares: 0, reports: 0 },
      source: "market_comment",
      visibility: "public",
      moderationStatus: "visible",
    });
    this.repository.appendEvent("yono.comment.created", comment.marketId, { commentId: comment.commentId });
    return comment;
  }
}

export class YonoCommentSignalService {
  public constructor(private readonly repository: YonoRepository) {}

  public extractSignal(comment: YonoComment): YonoCommentSignal {
    const text = comment.text.toLowerCase();
    const yesScore = scoreWords(text, ["yes", "bullish", "likely", "will", "confirmed"]);
    const noScore = scoreWords(text, ["no", "bearish", "unlikely", "wont", "won't", "fake"]);
    const stance = yesScore > noScore ? "yes" : noScore > yesScore ? "no" : "neutral";
    const probability = stance === "yes" ? 0.65 : stance === "no" ? 0.35 : 0.5;
    const signal = this.repository.saveSignal({
      signalId: newId("ysig"),
      commentId: comment.commentId,
      marketId: comment.marketId,
      stance,
      probability,
      evidenceBacked: /https?:\/\/|source|evidence|announcement|onchain|data/.test(text),
      confidence: Math.abs(yesScore - noScore) >= 2 ? "high" : "medium",
      extractedAt: nowIso(),
    });
    this.repository.appendEvent("yono.comment.signal_extracted", comment.marketId, { signalId: signal.signalId });
    return signal;
  }
}

export class YonoForecastService {
  public constructor(private readonly repository: YonoRepository) {}

  public submitForecast(input: { readonly marketId: string; readonly userId: string; readonly outcomeId: string; readonly probability: number; readonly rationale?: string }): YonoForecast {
    const timestamp = nowIso();
    const forecastInput = {
      forecastId: newId("yfct"),
      marketId: input.marketId,
      userId: input.userId,
      probability: input.probability,
      outcomeId: input.outcomeId,
      forecastType: "explicit_probability" as const,
      createdAt: timestamp,
      ...(input.rationale != null ? { rationale: input.rationale } : {}),
    };
    const forecast = this.repository.saveForecast(forecastInput);
    this.repository.appendEvent("yono.forecast.submitted", input.marketId, { forecastId: forecast.forecastId });
    return forecast;
  }
}

export class YonoConsensusProbabilityService {
  public constructor(private readonly repository: YonoRepository) {}

  public calculate(marketId: string): { readonly marketId: string; readonly yonoConsensusProbability: number; readonly commentSignalProbability: number; readonly forecastProbability: number } {
    const market = this.repository.getMarket(marketId);
    if (market == null) {
      throw new Error("yono.market.not_found");
    }
    const signals = this.repository.listSignals(marketId).filter((signal) => signal.probability != null);
    const forecasts = this.repository.listForecasts(marketId);
    const commentSignalProbability = average(signals.map((signal) => signal.probability ?? 0.5), market.probability.marketProbability);
    const forecastProbability = average(forecasts.map((forecast) => forecast.probability), market.probability.marketProbability);
    const yonoConsensusProbability = clamp01(
      market.probability.marketProbability * 0.4 + commentSignalProbability * 0.3 + forecastProbability * 0.3,
    );
    const updated = this.repository.saveMarket({
      ...market,
      probability: {
        ...market.probability,
        yonoConsensusProbability,
        commentSignalProbability,
        updatedAt: nowIso(),
      },
      updatedAt: nowIso(),
    });
    this.repository.appendEvent("yono.consensus_probability.updated", marketId, { probability: updated.probability });
    return { marketId, yonoConsensusProbability, commentSignalProbability, forecastProbability };
  }
}

export class YonoSocialForecastAgent {
  public constructor(private readonly repository: YonoRepository) {}

  public run(marketId: string): SocialForecastOutput {
    const signals = this.repository.listSignals(marketId);
    const yesSignals = signals.filter((signal) => signal.stance === "yes");
    const noSignals = signals.filter((signal) => signal.stance === "no");
    const total = Math.max(1, yesSignals.length + noSignals.length);
    const weightedYesSignal = yesSignals.length / total;
    const weightedNoSignal = noSignals.length / total;
    const firstSignalStance = signals[0]?.stance;
    const manipulationRisk = firstSignalStance != null && signals.length >= 5 && signals.every((signal) => signal.stance === firstSignalStance)
      ? "high"
      : "low";
    return {
      marketId,
      commentSignalProbability: clamp01(0.5 + (weightedYesSignal - weightedNoSignal) * 0.3),
      weightedYesSignal,
      weightedNoSignal,
      highReputationYesRatio: weightedYesSignal,
      highReputationNoRatio: weightedNoSignal,
      evidenceBackedCommentRatio: signals.filter((signal) => signal.evidenceBacked).length / Math.max(1, signals.length),
      manipulationRisk,
      trend: weightedYesSignal > weightedNoSignal ? "bullish" : weightedNoSignal > weightedYesSignal ? "bearish" : "neutral",
      confidence: signals.length >= 10 ? "high" : signals.length >= 3 ? "medium" : "low",
      explanation: `YONO social forecast analyzed ${signals.length} structured comment signals.`,
      evidenceRefs: signals.filter((signal) => signal.evidenceBacked).map((signal) => `comment:${signal.commentId}`),
    };
  }
}

export class YonoMarketReviewAgent {
  public review(market: YonoMarket): MarketReviewResult {
    const issues: string[] = [];
    const requiredChanges: string[] = [];
    if (market.outcomes.length < 2) {
      issues.push("outcome_count_too_low");
      requiredChanges.push("Add at least two clear outcomes.");
    }
    if (market.description.length < 20) {
      issues.push("description_too_short");
      requiredChanges.push("Add objective resolution criteria.");
    }
    if (market.risk.regulatoryRisk === "high") {
      issues.push("regulatory_risk_high");
    }
    return {
      marketId: market.marketId,
      decision: issues.length === 0 ? "approve" : market.risk.regulatoryRisk === "high" ? "manual_review" : "needs_revision",
      riskLevel: market.risk.regulatoryRisk === "high" ? "high" : market.risk.manipulationRisk,
      issues,
      requiredChanges,
    };
  }
}

export class YonoResolutionAssistAgent {
  public draft(market: YonoMarket, evidenceRefs: readonly string[]): ResolutionDraft {
    const proposedOutcome = market.outcomes[0];
    if (proposedOutcome == null) {
      throw new Error("yono.resolution.no_outcomes");
    }
    return {
      marketId: market.marketId,
      proposedOutcomeId: proposedOutcome.outcomeId,
      confidence: evidenceRefs.length > 0 ? 0.72 : 0.42,
      evidenceRefs,
      reasoningSummary: evidenceRefs.length > 0
        ? "Resolution draft is based on provided evidence references."
        : "Resolution draft requires human review because no evidence references were provided.",
      ambiguityFlags: market.risk.ambiguityRisk === "high" ? ["high_ambiguity_risk"] : [],
      requiresHumanReview: evidenceRefs.length === 0 || market.risk.ambiguityRisk === "high",
    };
  }
}

export class YonoTradingService {
  public constructor(private readonly repository: YonoRepository) {}

  public createOrder(input: { readonly marketId: string; readonly outcomeId: string; readonly userId: string; readonly side: "buy" | "sell"; readonly orderType?: "market" | "limit"; readonly quantity: number; readonly limitPrice?: number }): YonoOrder {
    const timestamp = nowIso();
    const order = this.repository.saveOrder({
      orderId: newId("yord"),
      marketId: input.marketId,
      outcomeId: input.outcomeId,
      userId: input.userId,
      side: input.side,
      orderType: input.orderType ?? "market",
      quantity: input.quantity,
      ...(input.limitPrice != null ? { limitPrice: input.limitPrice } : {}),
      status: "accepted",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.repository.appendEvent("yono.order.created", input.marketId, { orderId: order.orderId });
    return order;
  }

  public cancelOrder(orderId: string): YonoOrder {
    const current = this.repository.getOrder(orderId);
    if (current == null) {
      throw new Error("yono.order.not_found");
    }
    return this.repository.saveOrder({ ...current, status: "cancelled", updatedAt: nowIso() });
  }
}

export class YonoDisputeService {
  public constructor(private readonly repository: YonoRepository) {}

  public submit(input: { readonly marketId: string; readonly raisedBy: string; readonly reason: YonoDispute["reason"]; readonly evidenceRefs?: readonly string[] }): YonoDispute {
    const dispute = this.repository.saveDispute({
      disputeId: newId("ydsp"),
      marketId: input.marketId,
      raisedBy: input.raisedBy,
      reason: input.reason,
      evidenceRefs: [...(input.evidenceRefs ?? [])],
      status: "submitted",
      createdAt: nowIso(),
    });
    this.repository.appendEvent("yono.market.disputed", input.marketId, { disputeId: dispute.disputeId });
    return dispute;
  }

  public decide(disputeId: string, decision: "accepted" | "rejected" | "resolved"): YonoDispute {
    const current = this.repository.getDispute(disputeId);
    if (current == null) {
      throw new Error("yono.dispute.not_found");
    }
    return this.repository.saveDispute({ ...current, status: decision, resolvedAt: nowIso() });
  }
}

export const YONO_DOMAIN_DEFINITION: DomainDefinition = {
  domainId: YONO_DOMAIN_ID,
  name: "YONO Business",
  description: "Web3 social prediction market domain with markets, comments, forecasts, point trading, resolution, reputation, and risk governance.",
  version: 1,
  workflows: [
    {
      workflowId: "yono.market.lifecycle",
      name: "YONO Market Lifecycle",
      triggerConditions: { domainId: YONO_DOMAIN_ID },
      steps: [
        createYonoWorkflowStep("review_market", ["yono_market_review_agent"], true),
        createYonoWorkflowStep("open_market", ["yono_market_service"], false),
        createYonoWorkflowStep("aggregate_social_forecast", ["yono_social_forecast_agent"], false),
        createYonoWorkflowStep("assist_resolution", ["yono_resolution_assist_agent"], true),
      ],
    },
  ],
  toolBundles: [
    {
      bundleId: "yono.core.tools",
      tools: [
        { toolName: "yono_market_service", enabled: true, configOverrides: {} },
        { toolName: "yono_comment_signal_service", enabled: true, configOverrides: {} },
        { toolName: "yono_consensus_probability_service", enabled: true, configOverrides: {} },
        { toolName: "yono_trading_service", enabled: true, configOverrides: { mode: "points_only" } },
      ],
    },
  ],
  outputContracts: [
    {
      contractId: "yono.market.contract",
      name: "YONO Market Contract",
      schema: { type: "object", required: ["marketId", "status", "probability"] },
      validationLevel: "strict",
    },
  ],
  promptOverrides: {},
  capabilities: {
    supportedTaskTypes: ["market_review", "social_forecast", "comment_moderation", "resolution_assist", "risk_detection"],
    requiredTools: ["yono_market_service", "yono_comment_signal_service", "yono_consensus_probability_service"],
    optionalTools: ["yono_trading_service", "yono_resolution_assist_agent"],
    modelPreferences: { default: "reasoning" },
    budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 20 },
    securityLevel: "elevated",
  },
  status: "active",
  executionProfile: {
    executionMode: {
      planningMode: "llm_assisted",
      hotPathMode: "deterministic_only",
      llmInHotPathAllowed: false,
      maxHotPathLatencyMs: 1000,
    },
    latencyTier: "interactive",
    compiledArtifactRef: null,
  },
  externalAdapters: ["wallet", "market-data", "onchain-indexer"],
  pluginBindings: [
    { bindingId: "yono.market-review", domainId: YONO_DOMAIN_ID, pluginType: "evaluator", pluginId: "yono_market_review_agent", priority: 10, enabled: true, config: {} },
    { bindingId: "yono.social-forecast", domainId: YONO_DOMAIN_ID, pluginType: "tool", pluginId: "yono_social_forecast_agent", priority: 9, enabled: true, config: {} },
  ],
};

export function registerYonoDomain(registry: DomainRegistryService): DomainDefinition {
  if (registry.get(YONO_DOMAIN_ID) != null) {
    return registry.get(YONO_DOMAIN_ID)!;
  }
  return registry.register(YONO_DOMAIN_DEFINITION, { skipSmokeTest: true });
}

function scoreWords(text: string, words: readonly string[]): number {
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

function average(values: readonly number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createYonoWorkflowStep(stepName: string, toolHints: readonly string[], requiresReview: boolean) {
  return {
    stepName,
    toolHints: [...toolHints],
    modelHints: {},
    outputSchema: null,
    retryPolicy: { maxRetries: 1, backoffMs: 1000 },
    requiresReview,
    timeoutMs: 60_000,
    dependsOn: [],
  };
}
