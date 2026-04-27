/**
 * Integration tests for Federation Routing Service
 *
 * Tests the federation routing service in a realistic multi-partner scenario.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FederationRoutingService,
  DEFAULT_FEDERATION_MIDDLEWARE_CONFIG,
  type FederationPartner,
  type FederationRouteRequest,
} from "../../../../../src/platform/interface/api/federation-routing-service.js";

test("integration: federation routing with multiple partners", () => {
  const service = new FederationRoutingService();

  // Register multiple partners
  const partners: FederationPartner[] = [
    {
      partnerId: "partner-alpha",
      partnerName: "Alpha Corporation",
      endpoint: "https://api.alpha.example.com",
      capabilities: ["task_management", "reporting", "analytics"],
      status: "active",
      retryPolicy: { maxRetries: 5, timeoutMs: 30000 },
      metadata: { region: "us-east-1" },
    },
    {
      partnerId: "partner-beta",
      partnerName: "Beta Industries",
      endpoint: "https://api.beta.example.com",
      capabilities: ["task_management", "notifications"],
      status: "active",
      retryPolicy: { maxRetries: 3, timeoutMs: 45000 },
      metadata: { region: "eu-west-1" },
    },
    {
      partnerId: "partner-gamma",
      partnerName: "Gamma Systems",
      endpoint: "https://api.gamma.example.com",
      capabilities: ["reporting"],
      status: "inactive",
      retryPolicy: { maxRetries: 2, timeoutMs: 20000 },
      metadata: { region: "ap-south-1" },
    },
  ];

  for (const partner of partners) {
    service.registerPartner(partner);
  }

  // Verify all partners are retrievable
  for (const partner of partners) {
    const retrieved = service.getPartner(partner.partnerId);
    assert.ok(retrieved !== undefined);
    assert.equal(retrieved!.partnerName, partner.partnerName);
  }

  // Only alpha and beta should be active
  const activePartners = service.listActivePartners();
  assert.equal(activePartners.length, 2);
  assert.ok(activePartners.some((p) => p.partnerId === "partner-alpha"));
  assert.ok(activePartners.some((p) => p.partnerId === "partner-beta"));
  assert.ok(!activePartners.some((p) => p.partnerId === "partner-gamma"));
});

test("integration: federation routing decisions for different scenarios", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner-active",
    partnerName: "Active Partner",
    endpoint: "https://api.active.example.com",
    capabilities: ["tasks"],
    status: "active",
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
    metadata: {},
  });

  service.registerPartner({
    partnerId: "partner-suspended",
    partnerName: "Suspended Partner",
    endpoint: "https://api.suspended.example.com",
    capabilities: ["tasks"],
    status: "suspended",
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
    metadata: {},
  });

  // Active partner - should be allowed
  const activeRoute = service.route({
    partnerId: "partner-active",
    path: "/api/v1/tasks",
    method: "POST",
    body: { title: "Test Task" },
  });
  assert.equal(activeRoute.allowed, true);
  assert.ok(activeRoute.targetUrl !== null);
  assert.equal(activeRoute.targetUrl, "https://api.active.example.com/api/v1/tasks");
  assert.ok(activeRoute.fallbackEnabled);

  // Suspended partner - should be denied
  const suspendedRoute = service.route({
    partnerId: "partner-suspended",
    path: "/api/v1/tasks",
    method: "GET",
  });
  assert.equal(suspendedRoute.allowed, false);
  assert.equal(suspendedRoute.reason, "Partner status is suspended");
  assert.ok(suspendedRoute.targetUrl === null);

  // Unknown partner - should be denied
  const unknownRoute = service.route({
    partnerId: "unknown-partner",
    path: "/api/v1/tasks",
    method: "GET",
  });
  assert.equal(unknownRoute.allowed, false);
  assert.equal(unknownRoute.reason, "Partner not found");
});

test("integration: federation capability checking across partners", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner-full",
    partnerName: "Full Featured Partner",
    endpoint: "https://api.full.example.com",
    capabilities: ["tasks", "reports", "analytics", "notifications"],
    status: "active",
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
    metadata: {},
  });

  service.registerPartner({
    partnerId: "partner-minimal",
    partnerName: "Minimal Partner",
    endpoint: "https://api.minimal.example.com",
    capabilities: ["tasks"],
    status: "active",
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
    metadata: {},
  });

  // Full partner supports all capabilities
  assert.equal(service.partnerSupportsCapability("partner-full", "tasks"), true);
  assert.equal(service.partnerSupportsCapability("partner-full", "reports"), true);
  assert.equal(service.partnerSupportsCapability("partner-full", "analytics"), true);
  assert.equal(service.partnerSupportsCapability("partner-full", "notifications"), true);

  // Minimal partner only supports tasks
  assert.equal(service.partnerSupportsCapability("partner-minimal", "tasks"), true);
  assert.equal(service.partnerSupportsCapability("partner-minimal", "reports"), false);
  assert.equal(service.partnerSupportsCapability("partner-minimal", "unknown"), false);

  // Unknown partner supports nothing
  assert.equal(service.partnerSupportsCapability("unknown", "tasks"), false);
});

test("integration: federation routing info retrieval", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner-custom-timeout",
    partnerName: "Custom Timeout Partner",
    endpoint: "https://api.custom.example.com",
    capabilities: [],
    status: "active",
    retryPolicy: {
      maxRetries: 10,
      timeoutMs: 120000,
    },
    metadata: {},
  });

  const info = service.getRoutingInfo("partner-custom-timeout");
  assert.ok(info !== null);
  assert.equal(info!.targetUrl, "https://api.custom.example.com");
  assert.equal(info!.maxRetries, 10);
  assert.equal(info!.timeout, 120000);

  // Inactive partner returns null
  service.updatePartnerStatus("partner-custom-timeout", "inactive");
  const inactiveInfo = service.getRoutingInfo("partner-custom-timeout");
  assert.equal(inactiveInfo, null);
});

test("integration: federation rate limiting behavior", () => {
  const service = new FederationRoutingService({ rateLimitPerPartner: 100 });

  // Under limit
  assert.equal(service.checkRateLimit("any-partner", 0), true);
  assert.equal(service.checkRateLimit("any-partner", 50), true);
  assert.equal(service.checkRateLimit("any-partner", 99), true);

  // At and over limit
  assert.equal(service.checkRateLimit("any-partner", 100), false);
  assert.equal(service.checkRateLimit("any-partner", 150), false);
  assert.equal(service.checkRateLimit("any-partner", 1000), false);
});

test("integration: default middleware config is correct", () => {
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.federationEnabled, true);
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.partnerIdHeader, "X-Federation-Partner-ID");
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.authHeader, "Authorization");
  assert.equal(DEFAULT_FEDERATION_MIDDLEWARE_CONFIG.traceHeader, "X-Federation-Trace-ID");
});

test("integration: federation partner status transitions", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner-transition",
    partnerName: "Transition Partner",
    endpoint: "https://api.transition.example.com",
    capabilities: [],
    status: "active",
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
    metadata: {},
  });

  // Initially active
  let partner = service.getPartner("partner-transition");
  assert.equal(partner!.status, "active");
  assert.equal(service.listActivePartners().length, 1);

  // Suspend
  const suspendResult = service.updatePartnerStatus("partner-transition", "suspended");
  assert.equal(suspendResult, true);
  partner = service.getPartner("partner-transition");
  assert.equal(partner!.status, "suspended");
  assert.equal(service.listActivePartners().length, 0);

  // Reactivate
  const reactivateResult = service.updatePartnerStatus("partner-transition", "active");
  assert.equal(reactivateResult, true);
  partner = service.getPartner("partner-transition");
  assert.equal(partner!.status, "active");
  assert.equal(service.listActivePartners().length, 1);

  // Deactivate
  const deactivateResult = service.updatePartnerStatus("partner-transition", "inactive");
  assert.equal(deactivateResult, true);
  partner = service.getPartner("partner-transition");
  assert.equal(partner!.status, "inactive");
  assert.equal(service.listActivePartners().length, 0);
});

test("integration: URL building with various endpoint formats", () => {
  const service = new FederationRoutingService();

  // Endpoint with trailing slash, path with leading slash
  service.registerPartner({
    partnerId: "partner-slash-both",
    partnerName: "Slash Both",
    endpoint: "https://api.both.example.com/",
    status: "active",
    partnerName: "Slash Both",
  });

  const decision1 = service.route({ partnerId: "partner-slash-both", path: "/tasks", method: "GET" });
  assert.equal(decision1.targetUrl, "https://api.both.example.com/tasks");

  // Endpoint without trailing slash, path without leading slash
  service.registerPartner({
    partnerId: "partner-no-slash",
    partnerName: "No Slash",
    endpoint: "https://api.noslash.example.com",
    status: "active",
    partnerName: "No Slash",
  });

  const decision2 = service.route({ partnerId: "partner-no-slash", path: "tasks", method: "GET" });
  assert.equal(decision2.targetUrl, "https://api.noslash.example.com/tasks");

  // Deep path
  const decision3 = service.route({ partnerId: "partner-slash-both", path: "/api/v2/resources/list", method: "GET" });
  assert.equal(decision3.targetUrl, "https://api.both.example.com/api/v2/resources/list");
});
