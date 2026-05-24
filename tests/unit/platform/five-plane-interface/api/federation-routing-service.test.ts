import assert from "node:assert/strict";
import test from "node:test";

import {
  FederationRoutingService,
  type FederationPartner,
  type FederationRouteRequest,
} from "../../../../../src/platform/five-plane-interface/api/federation-routing-service.js";

function createPartner(overrides: Partial<FederationPartner> = {}): FederationPartner {
  return {
    partnerId: "partner-1",
    partnerName: "Test Partner",
    endpoint: "https://api.testpartner.com",
    capabilities: ["tasks"],
    status: "active",
    retryPolicy: { maxRetries: 3, timeoutMs: 30_000 },
    metadata: {},
    ...overrides,
  };
}

function createRequest(overrides: Partial<FederationRouteRequest> = {}): FederationRouteRequest {
  return {
    partnerId: "partner-1",
    path: "/tasks",
    method: "GET",
    ...overrides,
  };
}

test("FederationRoutingService registers and retrieves fully-specified partners", () => {
  const service = new FederationRoutingService();
  service.registerPartner(createPartner());

  const partner = service.getPartner("partner-1");
  assert.ok(partner);
  assert.equal(partner.partnerName, "Test Partner");
  assert.deepEqual(partner.capabilities, ["tasks"]);
});

test("FederationRoutingService routes active partners and rejects inactive ones", () => {
  const service = new FederationRoutingService({ enableFallback: true });
  service.registerPartner(createPartner());
  service.registerPartner(createPartner({
    partnerId: "partner-2",
    endpoint: "https://api.partner2.com",
    status: "inactive",
  }));

  const allowed = service.route(createRequest());
  const denied = service.route(createRequest({ partnerId: "partner-2" }));

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.targetUrl, "https://api.testpartner.com/tasks");
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "Partner status is inactive");
});

test("FederationRoutingService reports routing info and capability support from the canonical partner schema", () => {
  const service = new FederationRoutingService({
    defaultTimeout: 10_000,
    maxRetries: 1,
    rateLimitPerPartner: 5,
  });
  service.registerPartner(createPartner({
    capabilities: ["tasks", "workflows"],
    retryPolicy: { maxRetries: 5, timeoutMs: 45_000 },
  }));

  const info = service.getRoutingInfo("partner-1");

  assert.deepEqual(info, {
    targetUrl: "https://api.testpartner.com",
    timeout: 45_000,
    maxRetries: 5,
  });
  assert.equal(service.partnerSupportsCapability("partner-1", "workflows"), true);
  assert.equal(service.checkRateLimit("partner-1", 4), true);
  assert.equal(service.checkRateLimit("partner-1", 5), false);
});

test("FederationRoutingService normalizes request paths when building target URLs", () => {
  const service = new FederationRoutingService();
  service.registerPartner(createPartner({ endpoint: "https://api.testpartner.com/" }));

  const withSlash = service.route(createRequest({ path: "/workflows/execute" }));
  const withoutSlash = service.route(createRequest({ path: "workflows/execute" }));

  assert.equal(withSlash.targetUrl, "https://api.testpartner.com/workflows/execute");
  assert.equal(withoutSlash.targetUrl, "https://api.testpartner.com/workflows/execute");
});
