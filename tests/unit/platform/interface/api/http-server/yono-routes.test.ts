import assert from "node:assert/strict";
import test from "node:test";

import { createYonoRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/yono-routes.js";
import { YonoRepository } from "../../../../../../src/domains/yono/index.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "operator-1", roles: ["operator"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceViewer(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "viewer-1", roles: ["viewer"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/yono/markets", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  const routePathname = pathname.split("?")[0] ?? pathname;
  return {
    requestId: "req-123",
    request: { method: "GET", url: pathname, headers, body } as never,
    route: { pathname: routePathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext, method = "GET"): Promise<ApiResponsePayload | null> {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === ctx.route.pathname) {
        return route.handler(ctx);
      }
    } else if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

test("createYonoRoutes - POST /v1/yono/markets creates a new market", async () => {
  const routes = createYonoRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Will ETH hit $5000 by end of year?",
    description: "Predict whether Ethereum will reach $5000 USD equivalent.",
    category: "tech",
    tags: ["ethereum", "price-prediction"],
  }));

  const result = await callRoute(routes, ctx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(body.data.market.marketId.startsWith("ymkt_"));
  assert.strictEqual(body.data.market.title, "Will ETH hit $5000 by end of year?");
  assert.strictEqual(body.data.market.category, "tech");
  assert.strictEqual(body.data.market.status, "draft");
});

test("createYonoRoutes - GET /v1/yono/markets returns empty list initially", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  const ctx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.markets, []);
});

test("createYonoRoutes - GET /v1/yono/markets returns created market", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market first
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Test Market",
    description: "Test market description for get test.",
  }));
  await callRoute(routes, createCtx, "POST");

  // Get markets
  const getCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"]);
  const result = await callRoute(routes, getCtx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.strictEqual(body.data.markets.length, 1);
  assert.strictEqual(body.data.markets[0].title, "Test Market");
});

test("createYonoRoutes - GET /v1/yono/markets/:marketId returns market", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Single Market Test",
    description: "Testing getting a single market.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Get single market
  const getCtx = createMockContext(
    `/v1/yono/markets/${marketId}`,
    ["v1", "yono", "markets", marketId],
    ["v1", "yono", "markets", marketId]
  );
  const result = await callRoute(routes, getCtx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.strictEqual(body.data.market.marketId, marketId);
});

test("createYonoRoutes - GET /v1/yono/markets/:marketId/comments returns comments", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Comments Test Market",
    description: "Testing comments endpoint.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Get comments (should be empty)
  const commentsCtx = createMockContext(
    `/v1/yono/markets/${marketId}/comments`,
    ["v1", "yono", "markets", marketId, "comments"],
    ["v1", "yono", "markets", marketId, "comments"]
  );
  const result = await callRoute(routes, commentsCtx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.comments, []);
});

test("createYonoRoutes - POST /v1/yono/markets/:marketId/comments creates comment", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Comment Creation Test",
    description: "Testing comment creation.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Create a comment
  const commentCtx = createMockContext(
    `/v1/yono/markets/${marketId}/comments`,
    ["v1", "yono", "markets", marketId, "comments"],
    {},
    JSON.stringify({ text: "This market looks promising!" })
  );
  const result = await callRoute(routes, commentCtx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(body.data.comment.commentId.startsWith("ycmt_"));
  assert.strictEqual(body.data.comment.text, "This market looks promising!");
  assert.ok(body.data.signal != null);
});

test("createYonoRoutes - GET /v1/yono/markets/:marketId/consensus returns consensus", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Consensus Test Market",
    description: "Testing consensus endpoint.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Get consensus
  const consensusCtx = createMockContext(
    `/v1/yono/markets/${marketId}/consensus`,
    ["v1", "yono", "markets", marketId, "consensus"],
    ["v1", "yono", "markets", marketId, "consensus"]
  );
  const result = await callRoute(routes, consensusCtx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(typeof body.data.yonoConsensusProbability === "number");
});

test("createYonoRoutes - POST /v1/yono/markets/:marketId/forecasts submits forecast", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Forecast Test Market",
    description: "Testing forecast submission.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;
  const outcomeId = JSON.parse(createResult!.body).data.market.outcomes[0].outcomeId;

  // Submit forecast
  const forecastCtx = createMockContext(
    `/v1/yono/markets/${marketId}/forecasts`,
    ["v1", "yono", "markets", marketId, "forecasts"],
    {},
    JSON.stringify({ outcomeId, probability: 0.75 })
  );
  const result = await callRoute(routes, forecastCtx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(body.data.forecast.forecastId.startsWith("yfct_"));
  assert.strictEqual(body.data.forecast.probability, 0.75);
});

test("createYonoRoutes - GET /v1/yono/markets/:marketId/forecasts returns forecasts", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Get Forecasts Test",
    description: "Testing get forecasts.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Get forecasts
  const forecastsCtx = createMockContext(
    `/v1/yono/markets/${marketId}/forecasts`,
    ["v1", "yono", "markets", marketId, "forecasts"],
    ["v1", "yono", "markets", marketId, "forecasts"]
  );
  const result = await callRoute(routes, forecastsCtx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.forecasts, []);
});

test("createYonoRoutes - POST /v1/yono/orders creates order", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market first
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Order Test Market",
    description: "Testing order creation.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;
  const outcomeId = JSON.parse(createResult!.body).data.market.outcomes[0].outcomeId;

  // Create order
  const orderCtx = createMockContext("/v1/yono/orders", ["v1", "yono", "orders"], {}, JSON.stringify({
    marketId,
    outcomeId,
    side: "buy",
    quantity: 100,
  }));
  const result = await callRoute(routes, orderCtx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(body.data.order.orderId.startsWith("yord_"));
  assert.strictEqual(body.data.order.side, "buy");
});

test("createYonoRoutes - GET /v1/yono/orders returns orders", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  const ctx = createMockContext("/v1/yono/orders", ["v1", "yono", "orders"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.orders, []);
});

test("createYonoRoutes - GET /v1/yono/positions returns positions", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  const ctx = createMockContext("/v1/yono/positions", ["v1", "yono", "positions"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.positions, []);
});

test("createYonoRoutes - GET /v1/yono/trades returns trades", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  const ctx = createMockContext("/v1/yono/trades", ["v1", "yono", "trades"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.trades, []);
});

test("createYonoRoutes - POST /v1/yono/markets/:marketId/disputes submits dispute", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Dispute Test Market",
    description: "Testing dispute submission.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Submit dispute
  const disputeCtx = createMockContext(
    `/v1/yono/markets/${marketId}/disputes`,
    ["v1", "yono", "markets", marketId, "disputes"],
    {},
    JSON.stringify({ reason: "wrong_evidence" })
  );
  const result = await callRoute(routes, disputeCtx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(body.data.dispute.disputeId.startsWith("ydsp_"));
  assert.strictEqual(body.data.dispute.reason, "wrong_evidence");
});

test("createYonoRoutes - GET /v1/yono/markets/:marketId/disputes returns disputes", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthServiceViewer(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Get Disputes Test",
    description: "Testing get disputes.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Get disputes
  const disputesCtx = createMockContext(
    `/v1/yono/markets/${marketId}/disputes`,
    ["v1", "yono", "markets", marketId, "disputes"],
    ["v1", "yono", "markets", marketId, "disputes"]
  );
  const result = await callRoute(routes, disputesCtx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.deepStrictEqual(body.data.disputes, []);
});

test("createYonoRoutes - POST /v1/yono/markets/:marketId/review triggers review agent", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market with valid data for review
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Review Test Market with Sufficient Description",
    description: "This is a test market with enough description length for review.",
    category: "tech",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Trigger review action
  const reviewCtx = createMockContext(
    `/v1/yono/markets/${marketId}/review`,
    ["v1", "yono", "markets", marketId, "review"],
    ["v1", "yono", "markets", marketId, "review"]
  );
  const result = await callRoute(routes, reviewCtx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(body.data.review != null);
  assert.ok(["approve", "needs_revision", "manual_review"].includes(body.data.review.decision));
});

test("createYonoRoutes - POST /v1/yono/markets/:marketId/open transitions market to open", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Transition Test Market",
    description: "Testing market transitions.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Open market
  const openCtx = createMockContext(
    `/v1/yono/markets/${marketId}/open`,
    ["v1", "yono", "markets", marketId, "open"],
    ["v1", "yono", "markets", marketId, "open"]
  );
  const result = await callRoute(routes, openCtx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.strictEqual(body.data.market.status, "open");
});

test("createYonoRoutes - market action returns null for unknown action", async () => {
  const repository = new YonoRepository();
  const routes = createYonoRoutes({ authService: createMockAuthService(), repository });

  // Create a market
  const createCtx = createMockContext("/v1/yono/markets", ["v1", "yono", "markets"], {}, JSON.stringify({
    title: "Unknown Action Test",
    description: "Testing unknown action handling.",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const marketId = JSON.parse(createResult!.body).data.market.marketId;

  // Try unknown action
  const unknownCtx = createMockContext(
    `/v1/yono/markets/${marketId}/unknown-action`,
    ["v1", "yono", "markets", marketId, "unknown-action"],
    ["v1", "yono", "markets", marketId, "unknown-action"]
  );
  const result = await callRoute(routes, unknownCtx, "POST");

  // Should return null (route not matched)
  assert.strictEqual(result, null);
});