import {
  YonoCommentService,
  YonoCommentSignalService,
  YonoConsensusProbabilityService,
  YonoDisputeService,
  YonoForecastService,
  YonoMarketReviewAgent,
  YonoMarketService,
  YonoRepository,
  YonoResolutionAssistAgent,
  YonoTradingService,
} from "../api-external-support.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, readJsonBody, readQueryParam, requirePrincipal } from "./utils.js";

export interface YonoRouteDeps {
  readonly authService: ApiAuthService | null;
  readonly repository?: YonoRepository | null;
}

const defaultRepository = new YonoRepository();

export function createYonoRoutes(deps: YonoRouteDeps): RouteDefinition[] {
  const repository = deps.repository ?? defaultRepository;
  const markets = new YonoMarketService(repository);
  const comments = new YonoCommentService(repository);
  const signals = new YonoCommentSignalService(repository);
  const forecasts = new YonoForecastService(repository);
  const consensus = new YonoConsensusProbabilityService(repository);
  const trading = new YonoTradingService(repository);
  const disputes = new YonoDisputeService(repository);
  const reviewAgent = new YonoMarketReviewAgent();
  const resolutionAgent = new YonoResolutionAssistAgent();

  return [
    {
      method: "POST",
      pathname: "/v1/yono/markets",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const market = markets.createMarket({
          title: stringBody(body, "title", "Untitled YONO market"),
          description: stringBody(body, "description", "YONO market pending detailed criteria."),
          category: categoryBody(body),
          creatorId: stringBody(body, "creatorId", principal.actorId),
          closeAt: stringBody(body, "closeAt", new Date(Date.now() + 86_400_000).toISOString()),
          resolutionDeadline: stringBody(body, "resolutionDeadline", new Date(Date.now() + 172_800_000).toISOString()),
          tags: arrayBody(body, "tags"),
        });
        return buildJsonResponse(ctx.requestId, 201, { market });
      },
    },
    {
      method: "GET",
      pathname: "/v1/yono/markets",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { markets: repository.listMarkets() });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId"]);
        if (marketId == null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { market: markets.requireMarket(marketId) });
      },
    },
    ...marketActionRoutes(deps, markets, reviewAgent, resolutionAgent),
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "comments"]);
        if (marketId == null) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const comment = comments.createComment({
          marketId,
          userId: stringBody(body, "userId", principal.actorId),
          text: stringBody(body, "text", ""),
        });
        const signal = signals.extractSignal(comment);
        return buildJsonResponse(ctx.requestId, 201, { comment, signal });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "comments"]);
        if (marketId == null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { comments: repository.listComments(marketId) });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "consensus"]);
        if (marketId == null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, consensus.calculate(marketId));
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "forecasts"]);
        if (marketId == null) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const market = markets.requireMarket(marketId);
        const defaultOutcomeId = market.outcomes[0]?.outcomeId;
        if (defaultOutcomeId == null) {
          throw new Error("yono.market.outcomes_missing");
        }
        const forecastInput = {
          marketId,
          userId: stringBody(body, "userId", principal.actorId),
          outcomeId: stringBody(body, "outcomeId", defaultOutcomeId),
          probability: numberBody(body, "probability", 0.5),
        };
        const forecast = forecasts.submitForecast(typeof body["rationale"] === "string"
          ? { ...forecastInput, rationale: body["rationale"] }
          : forecastInput);
        return buildJsonResponse(ctx.requestId, 201, { forecast });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "forecasts"]);
        if (marketId == null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { forecasts: repository.listForecasts(marketId) });
      },
    },
    {
      method: "POST",
      pathname: "/v1/yono/orders",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const orderInput = {
          marketId: stringBody(body, "marketId", ""),
          outcomeId: stringBody(body, "outcomeId", ""),
          userId: stringBody(body, "userId", principal.actorId),
          side: body["side"] === "sell" ? "sell" : "buy",
          orderType: body["orderType"] === "limit" ? "limit" : "market",
          quantity: numberBody(body, "quantity", 1),
        } as const;
        const order = trading.createOrder(typeof body["limitPrice"] === "number"
          ? { ...orderInput, limitPrice: body["limitPrice"] }
          : orderInput);
        return buildJsonResponse(ctx.requestId, 201, { order });
      },
    },
    {
      method: "GET",
      pathname: "/v1/yono/orders",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { orders: repository.listOrders(readQueryParam(ctx.request, "userId")) });
      },
    },
    {
      method: "GET",
      pathname: "/v1/yono/positions",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { positions: repository.listPositions(readQueryParam(ctx.request, "userId")) });
      },
    },
    {
      method: "GET",
      pathname: "/v1/yono/trades",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { trades: repository.listTrades(readQueryParam(ctx.request, "marketId")) });
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "disputes"]);
        if (marketId == null) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const dispute = disputes.submit({
          marketId,
          raisedBy: stringBody(body, "raisedBy", principal.actorId),
          reason: disputeReasonBody(body),
          evidenceRefs: arrayBody(body, "evidenceRefs"),
        });
        return buildJsonResponse(ctx.requestId, 201, { dispute });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const marketId = match(ctx.route.segments, ["v1", "yono", "markets", ":marketId", "disputes"]);
        if (marketId == null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, { disputes: repository.listDisputes(marketId) });
      },
    },
  ];
}

function marketActionRoutes(
  deps: YonoRouteDeps,
  markets: YonoMarketService,
  reviewAgent: YonoMarketReviewAgent,
  resolutionAgent: YonoResolutionAssistAgent,
): RouteDefinition[] {
  return [
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        if (segments[0] !== "v1" || segments[1] !== "yono" || segments[2] !== "markets" || segments.length !== 5) {
          return null;
        }
        const marketId = segments[3]!;
        const action = segments[4]!;
        requirePrincipal(ctx.request, deps.authService, "operator");
        if (action === "review") {
          return buildJsonResponse(ctx.requestId, 200, { review: reviewAgent.review(markets.requireMarket(marketId)) });
        }
        if (action === "open" || action === "pause" || action === "close") {
          return buildJsonResponse(ctx.requestId, 200, { market: markets.transitionMarket(marketId, action === "open" ? "open" : action === "pause" ? "paused" : "closed") });
        }
        if (action === "resolution-draft") {
          const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
          return buildJsonResponse(ctx.requestId, 200, { draft: resolutionAgent.draft(markets.requireMarket(marketId), arrayBody(body, "evidenceRefs")) });
        }
        if (action === "resolve") {
          const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
          return buildJsonResponse(ctx.requestId, 200, { market: markets.resolveMarket(marketId, stringBody(body, "outcomeId", "")) });
        }
        return null;
      },
    },
  ];
}

function match(segments: readonly string[], pattern: readonly string[]): string | null {
  if (segments.length !== pattern.length) {
    return null;
  }
  let captured: string | null = null;
  for (let index = 0; index < pattern.length; index += 1) {
    const expected = pattern[index]!;
    const actual = segments[index]!;
    if (expected.startsWith(":")) {
      captured = actual;
      continue;
    }
    if (actual !== expected) {
      return null;
    }
  }
  return captured;
}

function stringBody(body: Record<string, unknown>, key: string, fallback: string): string {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberBody(body: Record<string, unknown>, key: string, fallback: number): number {
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function arrayBody(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function categoryBody(body: Record<string, unknown>) {
  const value = body["category"];
  return value === "ai" || value === "macro" || value === "sports" || value === "tech" || value === "social" || value === "custom"
    ? value
    : "web3";
}

function disputeReasonBody(body: Record<string, unknown>) {
  const value = body["reason"];
  return value === "ambiguous_criteria" || value === "wrong_evidence" || value === "oracle_error" || value === "manipulation" || value === "other"
    ? value
    : "other";
}
