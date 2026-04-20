import test from "node:test";
import assert from "node:assert/strict";
import {
  FederationRoutingService,
  type FederationPartner,
} from "../../../../../src/platform/interface/api/federation-routing-service.js";

test("FederationRoutingService registers and retrieves partner", () => {
  const service = new FederationRoutingService();

  const partner: FederationPartner = {
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    capabilities: ["task_management", "reporting"],
    status: "active",
  };

  service.registerPartner(partner);

  const retrieved = service.getPartner("partner_acme");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.partnerName, "Acme Corp");
  assert.equal(retrieved?.endpoint, "https://api.acme.example.com");
});

test("FederationRoutingService lists active partners", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_1",
    partnerName: "Partner 1",
    endpoint: "https://p1.example.com",
    status: "active",
  });

  service.registerPartner({
    partnerId: "partner_2",
    partnerName: "Partner 2",
    endpoint: "https://p2.example.com",
    status: "inactive",
  });

  const activePartners = service.listActivePartners();
  assert.equal(activePartners.length, 1);
  assert.equal(activePartners[0].partnerId, "partner_1");
});

test("FederationRoutingService routes request to active partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    status: "active",
  });

  const decision = service.route({
    partnerId: "partner_acme",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.targetUrl !== null);
  assert.ok(decision.targetUrl?.includes("api.acme.example.com"));
});

test("FederationRoutingService blocks request to inactive partner", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    status: "inactive",
  });

  const decision = service.route({
    partnerId: "partner_acme",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Partner status is inactive");
});

test("FederationRoutingService blocks request to unknown partner", () => {
  const service = new FederationRoutingService();

  const decision = service.route({
    partnerId: "unknown_partner",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Partner not found");
});

test("FederationRoutingService builds correct target URL", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    status: "active",
  });

  const decision = service.route({
    partnerId: "partner_acme",
    path: "/api/v1/tasks",
    method: "GET",
  });

  assert.equal(decision.targetUrl, "https://api.acme.example.com/api/v1/tasks");
});

test("FederationRoutingService handles path with leading slash", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com/",
    status: "active",
  });

  const decision = service.route({
    partnerId: "partner_acme",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.targetUrl, "https://api.acme.example.com/tasks");
});

test("FederationRoutingService checks partner capability", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    capabilities: ["task_management", "reporting"],
    status: "active",
  });

  assert.equal(service.partnerSupportsCapability("partner_acme", "task_management"), true);
  assert.equal(service.partnerSupportsCapability("partner_acme", "analytics"), false);
  assert.equal(service.partnerSupportsCapability("unknown_partner", "task_management"), false);
});

test("FederationRoutingService gets routing info", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    status: "active",
    retryPolicy: {
      maxRetries: 5,
      timeoutMs: 60000,
    },
  });

  const info = service.getRoutingInfo("partner_acme");
  assert.ok(info !== null);
  assert.equal(info?.targetUrl, "https://api.acme.example.com");
  assert.equal(info?.maxRetries, 5);
  assert.equal(info?.timeout, 60000);
});

test("FederationRoutingService returns null for inactive partner routing info", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    status: "suspended",
  });

  const info = service.getRoutingInfo("partner_acme");
  assert.equal(info, null);
});

test("FederationRoutingService checks rate limit", () => {
  const service = new FederationRoutingService({ rateLimitPerPartner: 100 });

  assert.equal(service.checkRateLimit("partner_acme", 50), true);
  assert.equal(service.checkRateLimit("partner_acme", 100), false);
  assert.equal(service.checkRateLimit("partner_acme", 150), false);
});

test("FederationRoutingService updates partner status", () => {
  const service = new FederationRoutingService();

  service.registerPartner({
    partnerId: "partner_acme",
    partnerName: "Acme Corp",
    endpoint: "https://api.acme.example.com",
    status: "active",
  });

  assert.equal(service.updatePartnerStatus("partner_acme", "suspended"), true);

  const partner = service.getPartner("partner_acme");
  assert.equal(partner?.status, "suspended");
});

test("FederationRoutingService returns false for unknown partner status update", () => {
  const service = new FederationRoutingService();

  assert.equal(service.updatePartnerStatus("unknown_partner", "suspended"), false);
});
