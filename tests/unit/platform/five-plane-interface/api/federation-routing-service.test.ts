import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  FederationRoutingService,
  type FederationRouteRequest,
  type FederationPartner,
} from "../../../../../src/platform/five-plane-interface/api/federation-routing-service.js";

describe("FederationRoutingService", () => {
  let service: FederationRoutingService;

  beforeEach(() => {
    service = new FederationRoutingService({
      defaultTimeout: 30000,
      maxRetries: 3,
      enableFallback: true,
      rateLimitPerPartner: 100,
    });
  });

  describe("registerPartner", () => {
    it("should register a valid federation partner", () => {
      const partner: FederationPartner = {
        partnerId: "partner-1",
        partnerName: "Test Partner",
        endpoint: "https://api.testpartner.com",
        capabilities: ["tasks", "workflows"],
        status: "active",
      };

      service.registerPartner(partner);

      const retrieved = service.getPartner("partner-1");
      assert.ok(retrieved);
      assert.strictEqual(retrieved.partnerId, "partner-1");
      assert.strictEqual(retrieved.partnerName, "Test Partner");
      assert.deepStrictEqual(retrieved.capabilities, ["tasks", "workflows"]);
    });

    it("should throw on invalid partner data", () => {
      assert.throws(() => {
        service.registerPartner({
          partnerId: "",
          partnerName: "Test",
          endpoint: "https://invalid",
        } as FederationPartner);
      });
    });
  });

  describe("getPartner", () => {
    it("should return undefined for non-existent partner", () => {
      const result = service.getPartner("non-existent");
      assert.strictEqual(result, undefined);
    });

    it("should return registered partner", () => {
      const partner: FederationPartner = {
        partnerId: "partner-2",
        partnerName: "Partner Two",
        endpoint: "https://api.partner2.com",
        status: "active",
      };
      service.registerPartner(partner);

      const result = service.getPartner("partner-2");
      assert.ok(result);
      assert.strictEqual(result.partnerId, "partner-2");
    });
  });

  describe("listActivePartners", () => {
    it("should only list active partners", () => {
      service.registerPartner({
        partnerId: "active-1",
        partnerName: "Active Partner",
        endpoint: "https://api.active1.com",
        status: "active",
      });
      service.registerPartner({
        partnerId: "inactive-1",
        partnerName: "Inactive Partner",
        endpoint: "https://api.inactive1.com",
        status: "inactive",
      });
      service.registerPartner({
        partnerId: "suspended-1",
        partnerName: "Suspended Partner",
        endpoint: "https://api.suspended1.com",
        status: "suspended",
      });

      const active = service.listActivePartners();
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].partnerId, "active-1");
    });
  });

  describe("updatePartnerStatus", () => {
    it("should return false when partner not found", () => {
      const result = service.updatePartnerStatus("non-existent", "inactive");
      assert.strictEqual(result, false);
    });

    it("should update partner status", () => {
      service.registerPartner({
        partnerId: "partner-to-update",
        partnerName: "Partner To Update",
        endpoint: "https://api.update.com",
        status: "active",
      });

      const result = service.updatePartnerStatus("partner-to-update", "suspended");
      assert.strictEqual(result, true);

      const partner = service.getPartner("partner-to-update");
      assert.strictEqual(partner?.status, "suspended");
    });
  });

  describe("route", () => {
    it("should return not allowed for unknown partner", () => {
      const request: FederationRouteRequest = {
        partnerId: "unknown-partner",
        path: "/tasks",
        method: "GET",
      };

      const decision = service.route(request);

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.partner, null);
      assert.strictEqual(decision.targetUrl, null);
      assert.strictEqual(decision.reason, "Partner not found");
    });

    it("should return not allowed for inactive partner", () => {
      service.registerPartner({
        partnerId: "inactive-partner",
        partnerName: "Inactive",
        endpoint: "https://api.inactive.com",
        status: "inactive",
      });

      const request: FederationRouteRequest = {
        partnerId: "inactive-partner",
        path: "/tasks",
        method: "GET",
      };

      const decision = service.route(request);

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.partner?.status, "inactive");
      assert.strictEqual(decision.reason, "Partner status is inactive");
    });

    it("should return allowed with target URL for active partner", () => {
      service.registerPartner({
        partnerId: "active-partner",
        partnerName: "Active",
        endpoint: "https://api.active.com",
        status: "active",
      });

      const request: FederationRouteRequest = {
        partnerId: "active-partner",
        path: "/tasks",
        method: "GET",
      };

      const decision = service.route(request);

      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.partner?.partnerId, "active-partner");
      assert.strictEqual(decision.targetUrl, "https://api.active.com/tasks");
    });

    it("should build correct URL with leading slash", () => {
      service.registerPartner({
        partnerId: "slash-test",
        partnerName: "Slash Test",
        endpoint: "https://api.slashtest.com",
        status: "active",
      });

      const decision = service.route({
        partnerId: "slash-test",
        path: "/workflows/execute",
        method: "POST",
      });

      assert.strictEqual(decision.targetUrl, "https://api.slashtest.com/workflows/execute");
    });

    it("should handle path without leading slash", () => {
      service.registerPartner({
        partnerId: "no-slash",
        partnerName: "No Slash",
        endpoint: "https://api.noslash.com",
        status: "active",
      });

      const decision = service.route({
        partnerId: "no-slash",
        path: "tasks",
        method: "GET",
      });

      assert.strictEqual(decision.targetUrl, "https://api.noslash.com/tasks");
    });
  });

  describe("partnerSupportsCapability", () => {
    it("should return false for unknown partner", () => {
      const result = service.partnerSupportsCapability("unknown", "tasks");
      assert.strictEqual(result, false);
    });

    it("should return true for supported capability", () => {
      service.registerPartner({
        partnerId: "capable-partner",
        partnerName: "Capable",
        endpoint: "https://api.capable.com",
        capabilities: ["tasks", "workflows", "approvals"],
        status: "active",
      });

      assert.strictEqual(service.partnerSupportsCapability("capable-partner", "tasks"), true);
      assert.strictEqual(service.partnerSupportsCapability("capable-partner", "workflows"), true);
      assert.strictEqual(service.partnerSupportsCapability("capable-partner", "approvals"), true);
    });

    it("should return false for unsupported capability", () => {
      service.registerPartner({
        partnerId: "limited-partner",
        partnerName: "Limited",
        endpoint: "https://api.limited.com",
        capabilities: ["tasks"],
        status: "active",
      });

      assert.strictEqual(service.partnerSupportsCapability("limited-partner", "workflows"), false);
    });
  });

  describe("getRoutingInfo", () => {
    it("should return null for unknown partner", () => {
      const result = service.getRoutingInfo("unknown");
      assert.strictEqual(result, null);
    });

    it("should return null for inactive partner", () => {
      service.registerPartner({
        partnerId: "inactive-info",
        partnerName: "Inactive Info",
        endpoint: "https://api.inactiveinfo.com",
        status: "inactive",
      });

      const result = service.getRoutingInfo("inactive-info");
      assert.strictEqual(result, null);
    });

    it("should return routing info for active partner", () => {
      service.registerPartner({
        partnerId: "info-partner",
        partnerName: "Info Partner",
        endpoint: "https://api.infopartner.com",
        retryPolicy: { maxRetries: 5, timeoutMs: 15000 },
        status: "active",
      });

      const result = service.getRoutingInfo("info-partner");

      assert.ok(result);
      assert.strictEqual(result.targetUrl, "https://api.infopartner.com");
      assert.strictEqual(result.timeout, 15000);
      assert.strictEqual(result.maxRetries, 5);
    });

    it("should use default timeout when not specified in partner config", () => {
      service.registerPartner({
        partnerId: "default-timeout-partner",
        partnerName: "Default Timeout",
        endpoint: "https://api.defaulttimeout.com",
        retryPolicy: {},
        status: "active",
      });

      const result = service.getRoutingInfo("default-timeout-partner");

      assert.ok(result);
      assert.strictEqual(result.timeout, 30000); // from config
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests under limit", () => {
      const result = service.checkRateLimit("any-partner", 50);
      assert.strictEqual(result, true);
    });

    it("should deny requests at or over limit", () => {
      const result = service.checkRateLimit("any-partner", 100);
      assert.strictEqual(result, false);
    });

    it("should deny requests over limit", () => {
      const result = service.checkRateLimit("any-partner", 150);
      assert.strictEqual(result, false);
    });
  });

  describe("constructor with defaults", () => {
    it("should use default config values", () => {
      const defaultService = new FederationRoutingService();

      defaultService.registerPartner({
        partnerId: "test-partner",
        partnerName: "Test",
        endpoint: "https://api.test.com",
        status: "active",
      });

      const routingInfo = defaultService.getRoutingInfo("test-partner");
      assert.ok(routingInfo);
      assert.strictEqual(routingInfo.timeout, 30000);
      assert.strictEqual(routingInfo.maxRetries, 3);
    });
  });
});