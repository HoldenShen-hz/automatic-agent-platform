import test from "node:test";
import assert from "node:assert/strict";
import {
  FederationRoutingService,
  type FederationPartner,
} from "../../../../../src/platform/interface/api/federation-routing-service.js";

test("FederationRoutingService - register and retrieve partner", () => {
  const service = new FederationRoutingService();
  const partner: FederationPartner = {
    partnerId: "test-partner",
    partnerName: "Test Partner",
    endpoint: "https://api.test.example.com",
    status: "active",
  };

  service.registerPartner(partner);
  const retrieved = service.getPartner("test-partner");

  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.partnerName, "Test Partner");
});

test("FederationRoutingService - list active partners only", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "active-1",
    partnerName: "Active 1",
    endpoint: "https://a1.example.com",
    status: "active",
  });
  service.registerPartner({
    partnerId: "inactive-1",
    partnerName: "Inactive 1",
    endpoint: "https://i1.example.com",
    status: "inactive",
  });

  const active = service.listActivePartners();
  assert.equal(active.length, 1);
  assert.equal(active[0]?.partnerId, "active-1");
});

test("FederationRoutingService - route to active partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "my-partner",
    partnerName: "My Partner",
    endpoint: "https://api.partner.example.com",
    status: "active",
  });

  const decision = service.route({
    partnerId: "my-partner",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.targetUrl?.includes("api.partner.example.com"));
});

test("FederationRoutingService - block inactive partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "suspended-partner",
    partnerName: "Suspended",
    endpoint: "https://suspended.example.com",
    status: "suspended",
  });

  const decision = service.route({
    partnerId: "suspended-partner",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Partner status is suspended");
});

test("FederationRoutingService - block unknown partner", () => {
  const service = new FederationRoutingService();

  const decision = service.route({
    partnerId: "unknown",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Partner not found");
});

test("FederationRoutingService - rate limit check", () => {
  const service = new FederationRoutingService({ rateLimitPerPartner: 100 });

  assert.equal(service.checkRateLimit("any-partner", 99), true);
  assert.equal(service.checkRateLimit("any-partner", 100), false);
  assert.equal(service.checkRateLimit("any-partner", 101), false);
});
