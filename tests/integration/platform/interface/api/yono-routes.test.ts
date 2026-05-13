import test from "node:test";
import assert from "node:assert/strict";

import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { createYonoRoutes } from "../../../../../src/platform/five-plane-interface/api/http-server/yono-routes.js";
import { YonoRepository } from "../../../../../src/domains/yono/index.js";

const authService = new ApiAuthService({
  jwtSecret: "test-secret",
  apiKeys: [{ apiKey: "yono_key", actorId: "user_001", roles: ["admin", "operator", "viewer"], tenantId: "tenant_001" }],
});

function headers() {
  return {
    authorization: `Bearer ${authService.exchangeApiKey("yono_key").accessToken}`,
    "content-type": "application/json",
  };
}

test("YONO routes create market, comment, forecast and consensus", async () => {
  const routes = createYonoRoutes({ authService, repository: new YonoRepository() });
  const createMarket = routes.find((route) => route.method === "POST" && route.pathname === "/v1/yono/markets");
  assert.ok(createMarket);
  const marketResponse = await createMarket.handler({
    requestId: "req_001",
    principal: null,
    route: { pathname: "/v1/yono/markets", segments: ["v1", "yono", "markets"] },
    request: {
      method: "POST",
      url: "/v1/yono/markets",
      headers: headers(),
      body: JSON.stringify({
        title: "Will YONO launch?",
        description: "Resolves YES if YONO launch announcement is published before deadline.",
      }),
    },
  });
  assert.equal(marketResponse.statusCode, 201);
  const market = JSON.parse(marketResponse.body).data.market;

  const postComment = routes[4];
  assert.ok(postComment);
  const commentResponse = await postComment.handler({
    requestId: "req_002",
    principal: null,
    route: { pathname: `/v1/yono/markets/${market.marketId}/comments`, segments: ["v1", "yono", "markets", market.marketId, "comments"] },
    request: {
      method: "POST",
      url: `/v1/yono/markets/${market.marketId}/comments`,
      headers: headers(),
      body: JSON.stringify({ text: "YES likely based on official source https://example.com" }),
    },
  });
  assert.equal(commentResponse.statusCode, 201);
  assert.equal(JSON.parse(commentResponse.body).data.signal.stance, "yes");

  const forecastRoute = routes[7];
  assert.ok(forecastRoute);
  const forecastResponse = await forecastRoute.handler({
    requestId: "req_003",
    principal: null,
    route: { pathname: `/v1/yono/markets/${market.marketId}/forecasts`, segments: ["v1", "yono", "markets", market.marketId, "forecasts"] },
    request: {
      method: "POST",
      url: `/v1/yono/markets/${market.marketId}/forecasts`,
      headers: headers(),
      body: JSON.stringify({ outcomeId: market.outcomes[0].outcomeId, probability: 0.72 }),
    },
  });
  assert.equal(forecastResponse.statusCode, 201);

  const consensusRoute = routes[6];
  assert.ok(consensusRoute);
  const consensusResponse = await consensusRoute.handler({
    requestId: "req_004",
    principal: null,
    route: { pathname: `/v1/yono/markets/${market.marketId}/consensus`, segments: ["v1", "yono", "markets", market.marketId, "consensus"] },
    request: {
      method: "GET",
      url: `/v1/yono/markets/${market.marketId}/consensus`,
      headers: headers(),
      body: null,
    },
  });
  assert.equal(consensusResponse.statusCode, 200);
  assert.ok(JSON.parse(consensusResponse.body).data.yonoConsensusProbability > 0.5);
});
