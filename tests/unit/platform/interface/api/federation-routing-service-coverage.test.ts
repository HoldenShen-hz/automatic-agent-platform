import test from "node:test";
import assert from "node:assert/strict";

import {
  FederationRoutingService,
  DEFAULT_FEDERATION_MIDDLEWARE_CONFIG,
  type FederationPartner,
  type FederationRouteRequest,
} from "../../../../../src/platform/five-plane-interface/api/federation-routing-service.js";

test("FederationRoutingService registers partner", () => {
  const service = new FederationRoutingService();

  const partner: FederationPartner = {
    partnerId: "partner-1",
    partnerName: "Test Partner",
    endpoint: "https://partner.example.com/api",
    capabilities: ["tasks", "events"],
    status: "active",
  };

  service.registerPartner(partner);

  const retrieved = service.getPartner("partner-1");

  assert.ok(retrieved != null);
  assert.equal(retrieved!.partnerName, "Test Partner");
  assert.deepStrictEqual(retrieved!.capabilities, ["tasks", "events"]);
});

test("FederationRoutingService registers partner with defaults", () => {
  const service = new FederationRoutingService();

  const partner: FederationPartner = {
    partnerId: "partner-min",
    partnerName: "Minimal Partner",
    endpoint: "https://minimal.example.com",
  };

  service.registerPartner(partner);

  const retrieved = service.getPartner("partner-min");

  assert.ok(retrieved != null);
  assert.equal(retrieved!.status, "active");
  assert.deepStrictEqual(retrieved!.capabilities, []);
  assert.deepStrictEqual(retrieved!.retryPolicy, { maxRetries: 3, timeoutMs: 30000 });
});

test("FederationRoutingService getPartner returns undefined for unknown", () => {
  const service = new FederationRoutingService();

  const result = service.getPartner("unknown-partner");

  assert.equal(result, undefined);
});

test("FederationRoutingService listActivePartners returns only active", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "active-1",
    partnerName: "Active Partner 1",
    endpoint: "https://active1.example.com",
    status: "active",
  });

  service.registerPartner({
    partnerId: "inactive-1",
    partnerName: "Inactive Partner",
    endpoint: "https://inactive1.example.com",
    status: "inactive",
  });

  service.registerPartner({
    partnerId: "suspended-1",
    partnerName: "Suspended Partner",
    endpoint: "https://suspended1.example.com",
    status: "suspended",
  });

  const activePartners = service.listActivePartners();

  assert.equal(activePartners.length, 1);
  assert.equal(activePartners[0]!.partnerId, "active-1");
});

test("FederationRoutingService updatePartnerStatus updates status", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner-status",
    partnerName: "Status Test Partner",
    endpoint: "https://status.example.com",
    status: "active",
  });

  const updated = service.updatePartnerStatus("partner-status", "suspended");

  assert.equal(updated, true);

  const partner = service.getPartner("partner-status");
  assert.equal(partner!.status, "suspended");
});

test("FederationRoutingService updatePartnerStatus returns false for unknown", () => {
  const service = new FederationRoutingService();

  const result = service.updatePartnerStatus("unknown", "active");

  assert.equal(result, false);
});

test("FederationRoutingService route allows active partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "route-test",
    partnerName: "Route Test Partner",
    endpoint: "https://route.example.com",
    status: "active",
  });

  const request: FederationRouteRequest = {
    partnerId: "route-test",
    path: "/v1/tasks",
    method: "GET",
  };

  const decision = service.route(request);

  assert.equal(decision.allowed, true);
  assert.ok(decision.partner != null);
  assert.ok(decision.targetUrl != null);
  assert.ok(decision.targetUrl!.includes("/v1/tasks"));
});

test("FederationRoutingService route denies unknown partner", () => {
  const service = new FederationRoutingService();

  const request: FederationRouteRequest = {
    partnerId: "unknown-partner",
    path: "/v1/tasks",
    method: "GET",
  };

  const decision = service.route(request);

  assert.equal(decision.allowed, false);
  assert.equal(decision.partner, null);
  assert.equal(decision.targetUrl, null);
  assert.ok(decision.reason!.includes("not found"));
});

test("FederationRoutingService route denies inactive partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "inactive-route",
    partnerName: "Inactive Route Partner",
    endpoint: "https://inactive.example.com",
    status: "inactive",
  });

  const request: FederationRouteRequest = {
    partnerId: "inactive-route",
    path: "/v1/tasks",
    method: "GET",
  };

  const decision = service.route(request);

  assert.equal(decision.allowed, false);
  assert.ok(decision.partner != null);
  assert.equal(decision.partner!.status, "inactive");
});

test("FederationRoutingService route builds correct target URL", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "url-test",
    partnerName: "URL Test Partner",
    endpoint: "https://api.partner.com/",
    status: "active",
  });

  const request: FederationRouteRequest = {
    partnerId: "url-test",
    path: "/v1/events",
    method: "POST",
  };

  const decision = service.route(request);

  assert.equal(decision.targetUrl, "https://api.partner.com/v1/events");
});

test("FederationRoutingService route handles path without leading slash", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "slash-test",
    partnerName: "Slash Test Partner",
    endpoint: "https://slash.example.com",
    status: "active",
  });

  const request: FederationRouteRequest = {
    partnerId: "slash-test",
    path: "v1/tasks", // No leading slash
    method: "GET",
  };

  const decision = service.route(request);

  assert.equal(decision.targetUrl, "https://slash.example.com/v1/tasks");
});

test("FederationRoutingService partnerSupportsCapability returns true for known capability", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "cap-test",
    partnerName: "Capability Test Partner",
    endpoint: "https://cap.example.com",
    capabilities: ["tasks", "events", "artifacts"],
    status: "active",
  });

  const result = service.partnerSupportsCapability("cap-test", "tasks");

  assert.equal(result, true);
});

test("FederationRoutingService partnerSupportsCapability returns false for unknown capability", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "cap-test-2",
    partnerName: "Capability Test Partner 2",
    endpoint: "https://cap2.example.com",
    capabilities: ["tasks"],
    status: "active",
  });

  const result = service.partnerSupportsCapability("cap-test-2", "unknown-capability");

  assert.equal(result, false);
});

test("FederationRoutingService partnerSupportsCapability returns false for unknown partner", () => {
  const service = new FederationRoutingService();

  const result = service.partnerSupportsCapability("unknown-partner", "tasks");

  assert.equal(result, false);
});

test("FederationRoutingService getRoutingInfo returns routing info for active partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "routing-info-test",
    partnerName: "Routing Info Test",
    endpoint: "https://routing.example.com",
    retryPolicy: {
      maxRetries: 5,
      timeoutMs: 60000,
    },
    status: "active",
  });

  const info = service.getRoutingInfo("routing-info-test");

  assert.ok(info != null);
  assert.equal(info!.targetUrl, "https://routing.example.com");
  assert.equal(info!.maxRetries, 5);
  assert.equal(info!.timeout, 60000);
});

test("FederationRoutingService getRoutingInfo returns null for inactive partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "routing-info-inactive",
    partnerName: "Routing Info Inactive",
    endpoint: "https://routing-inactive.example.com",
    status: "inactive",
  });

  const info = service.getRoutingInfo("routing-info-inactive");

  assert.equal(info, null);
});

test("FederationRoutingService getRoutingInfo returns null for unknown partner", () => {
  const service = new FederationRoutingService();

  const info = service.getRoutingInfo("unknown-partner");

  assert.equal(info, null);
});

test("FederationRoutingService checkRateLimit allows under limit", () => {
  const service = new FederationRoutingService();

  const result = service.checkRateLimit("any-partner", 500);

  assert.equal(result, true);
});

test("FederationRoutingService checkRateLimit denies at limit", () => {
  const service = new FederationRoutingService();

  const result = service.checkRateLimit("any-partner", 1000);

  assert.equal(result, false);
});

test("FederationRoutingService uses custom config", () => {
  const service = new FederationRoutingService({
    defaultTimeout: 60000,
    maxRetries: 5,
    enableFallback: false,
    rateLimitPerPartner: 500,
  });

  service.registerPartner({
    partnerId: "custom-config-test",
    partnerName: "Custom Config Test",
    endpoint: "https://custom.example.com",
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
    status: "active",
  });

  const info = service.getRoutingInfo("custom-config-test");

  assert.ok(info != null);
  assert.equal(info!.timeout, 30000);
  assert.equal(info!.maxRetries, 3);
});

test("DEFAULT_FEDERATION_MIDDLEWARE_CONFIG has correct defaults", () => {
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.federationEnabled, true);
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.partnerIdHeader, "X-Federation-Partner-ID");
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.authHeader, "Authorization");
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.traceHeader, "X-Federation-Trace-ID");
});

test("FederationRoutingService route includes fallbackEnabled from config", () => {
  const serviceWithFallback = new FederationRoutingService({ enableFallback: true });
  serviceWithFallback.registerPartner({
    partnerId: "fb-test-1",
    partnerName: "Fallback Test",
    endpoint: "https://fb.example.com",
    status: "inactive",
  });

  const decision1 = serviceWithFallback.route({ partnerId: "fb-test-1", path: "/test", method: "GET" });
  assert.equal(decision1.fallbackEnabled, true);

  const serviceNoFallback = new FederationRoutingService({ enableFallback: false });
  serviceNoFallback.registerPartner({
    partnerId: "fb-test-2",
    partnerName: "No Fallback Test",
    endpoint: "https://nofb.example.com",
    status: "inactive",
  });

  const decision2 = serviceNoFallback.route({ partnerId: "fb-test-2", path: "/test", method: "GET" });
  assert.equal(decision2.fallbackEnabled, false);
});

test("FederationRoutingService partner with custom retry policy uses partner values", () => {
  const service = new FederationRoutingService({
    defaultTimeout: 30000,
    maxRetries: 3,
  });

  service.registerPartner({
    partnerId: "custom-retry",
    partnerName: "Custom Retry Partner",
    endpoint: "https://custom-retry.example.com",
    retryPolicy: {
      maxRetries: 10,
      timeoutMs: 120000,
    },
    status: "active",
  });

  const info = service.getRoutingInfo("custom-retry");

  assert.ok(info != null);
  assert.equal(info!.maxRetries, 10); // Partner's custom value
  assert.equal(info!.timeout, 120000); // Partner's custom value
});
