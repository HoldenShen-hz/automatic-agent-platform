import assert from "node:assert/strict";
import test from "node:test";

import { IncidentCaseService } from "../../../../../../src/platform/five-plane-state-evidence/incident/index.js";
import { createIncidentRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/incident-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/incidents", segments: string[] = [], body: string | null = null): RouteContext {
  return {
    requestId: "req-incident-123",
    request: { method: body != null ? "POST" : "GET", url: pathname, headers: {}, body } as never,
    route: { pathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  const pathname = ctx.route.pathname;
  const method = ctx.request.method ?? "GET";
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === pathname) {
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

test("IncidentCaseService opens incident", () => {
  const service = new IncidentCaseService();

  const incident = service.openIncident({
    severity: "high",
    title: "Test incident",
    linkedEvidenceRefs: ["ref-1"],
  });

  assert.ok(incident.incidentId);
  assert.equal(incident.severity, "high");
  assert.equal(incident.status, "open");
  assert.equal(incident.title, "Test incident");
  assert.equal(incident.linkedEvidenceRefs.length, 1);
});

test("IncidentCaseService acknowledges incident", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  const acknowledged = service.acknowledge(incident.incidentId, "operator-1");

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.owner, "operator-1");
});

test("IncidentCaseService resolves incident", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({ severity: "high", title: "Test" });
  service.acknowledge(incident.incidentId, "operator-1");
  service.startMitigation(incident.incidentId);
  service.review(incident.incidentId);

  const resolved = service.resolve(incident.incidentId);

  assert.equal(resolved.status, "resolved");
  assert.ok(resolved.resolvedAt);
});

test("IncidentCaseService startMitigation requires acknowledge first", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  assert.throws(() => {
    service.startMitigation(incident.incidentId);
  }, /must be acknowledged/);
});

test("IncidentCaseService getIncident returns null for unknown", () => {
  const service = new IncidentCaseService();

  const result = service.getIncident("unknown");

  assert.equal(result, null);
});

test("IncidentCaseService listIncidents returns newest incidents first", () => {
  const service = new IncidentCaseService();
  service.openIncident({ severity: "low", title: "first" });
  service.openIncident({ severity: "critical", title: "second" });

  const incidents = service.listIncidents();

  assert.equal(incidents.length, 2);
  assert.equal(incidents[0]?.title, "second");
});

test("GET /v1/incidents lists incidents from service", async () => {
  const incidentService = new IncidentCaseService();
  incidentService.openIncident({ severity: "high", title: "Database latency" });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(),
    incidentService,
  });

  const response = await callRoute(routes, createMockContext("/v1/incidents", ["v1", "incidents"]));
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("Database latency"));
});

test("POST /v1/incidents creates a new incident", async () => {
  const incidentService = new IncidentCaseService();
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"]),
    incidentService,
  });

  const response = await callRoute(
    routes,
    createMockContext(
      "/v1/incidents",
      ["v1", "incidents"],
      JSON.stringify({ severity: "critical", title: "Provider outage" }),
    ),
  );
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 201);
  assert.ok(response.body.includes("Provider outage"));
});
