import assert from "node:assert/strict";
import test from "node:test";

import { IncidentCaseService } from "../../../../../../src/platform/state-evidence/incident/index.js";
import { createIncidentRoutes } from "../../../../../../src/platform/interface/api/http-server/incident-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { ApiResponsePayload, RouteContext, RouteDefinition } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockAuthService(
  roles: string[] = ["viewer"],
  tenantId: string | null = "tenant-a",
): ApiAuthService {
  return {
    requireRole: () => ({
      actorId: "actor-1",
      roles: roles as ("viewer" | "operator" | "admin")[],
      authMethod: "api_key",
      tenantId,
    }),
  } as unknown as ApiAuthService;
}

function createMockContext(
  pathname = "/v1/incidents",
  method = "GET",
  segments: string[] = [],
  body: string | null = null,
  headers: Record<string, string | undefined> = {},
): RouteContext {
  return {
    requestId: "req-incident-123",
    request: { method, url: pathname, headers, body } as never,
    route: { pathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  for (const route of routes) {
    if (route.method !== (ctx.request.method ?? "GET")) {
      continue;
    }
    if (route.pathname !== null) {
      if (route.pathname === ctx.route.pathname) {
        return route.handler(ctx);
      }
      continue;
    }
    if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

test("IncidentCaseService enforces tenant scope on acknowledge and resolve", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant-a",
    severity: "high",
    title: "Database latency",
  });

  const acknowledged = service.acknowledge("tenant-a", incident.incidentId, "operator-1");
  const resolved = service.resolve("tenant-a", incident.incidentId);

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.owner, "operator-1");
  assert.equal(resolved.status, "resolved");
  assert.ok(resolved.resolvedAt);
  assert.equal(service.getIncident("tenant-b", incident.incidentId), null);
});

test("IncidentCaseService startMitigation requires acknowledged status within tenant scope", () => {
  const service = new IncidentCaseService();
  const incident = service.openIncident({
    tenantId: "tenant-a",
    severity: "high",
    title: "Mitigation required",
  });

  assert.throws(
    () => service.startMitigation("tenant-a", incident.incidentId),
    /must be acknowledged/i,
  );
});

test("GET /v1/incidents lists only incidents inside tenant scope", async () => {
  const incidentService = new IncidentCaseService();
  incidentService.openIncident({ tenantId: "tenant-a", severity: "high", title: "Tenant A incident" });
  incidentService.openIncident({ tenantId: "tenant-b", severity: "high", title: "Tenant B incident" });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["viewer"], "tenant-a"),
    incidentService,
  });

  const response = await callRoute(routes, createMockContext("/v1/incidents", "GET", ["v1", "incidents"]));
  if (!response) {
    throw new Error("handler returned null");
  }

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Tenant A incident/);
  assert.doesNotMatch(response.body, /Tenant B incident/);
});

test("GET /v1/incidents/:id rejects invalid incident id format", async () => {
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["viewer"], "tenant-a"),
    incidentService: new IncidentCaseService(),
  });

  await assert.rejects(
    async () => callRoute(routes, createMockContext("/v1/incidents/../../bad", "GET", ["v1", "incidents", "../../bad"])),
    /invalid characters|invalid_id/i,
  );
});

test("PATCH /v1/incidents/:id rejects owner-only updates", async () => {
  const incidentService = new IncidentCaseService();
  const incident = incidentService.openIncident({
    tenantId: "tenant-a",
    severity: "critical",
    title: "Provider outage",
  });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"], "tenant-a"),
    incidentService,
  });

  await assert.rejects(
    async () =>
      callRoute(
        routes,
        createMockContext(
          `/v1/incidents/${incident.incidentId}`,
          "PATCH",
          ["v1", "incidents", incident.incidentId],
          JSON.stringify({ owner: "operator-2" }),
        ),
      ),
    /owner-only|status transition/i,
  );
});

test("PATCH /v1/incidents/:id rejects cross-tenant access", async () => {
  const incidentService = new IncidentCaseService();
  const incident = incidentService.openIncident({
    tenantId: "tenant-a",
    severity: "critical",
    title: "Cross-tenant test",
  });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"], "tenant-b"),
    incidentService,
  });

  await assert.rejects(
    async () =>
      callRoute(
        routes,
        createMockContext(
          `/v1/incidents/${incident.incidentId}`,
          "PATCH",
          ["v1", "incidents", incident.incidentId],
          JSON.stringify({ status: "acknowledged", owner: "operator-9" }),
        ),
      ),
    /not found/i,
  );
});

test("POST /v1/incidents creates a tenant-scoped incident", async () => {
  const incidentService = new IncidentCaseService();
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"], "tenant-a"),
    incidentService,
  });

  const response = await callRoute(
    routes,
    createMockContext(
      "/v1/incidents",
      "POST",
      ["v1", "incidents"],
      JSON.stringify({ severity: "critical", title: "Provider outage" }),
      { "x-idempotency-key": "incident-create-1" },
    ),
  );
  if (!response) {
    throw new Error("handler returned null");
  }

  assert.equal(response.statusCode, 201);
  assert.match(response.body, /Provider outage/);
  assert.equal(incidentService.listIncidents("tenant-a").length, 1);
  assert.equal(incidentService.listIncidents("tenant-b").length, 0);
});

test("POST /v1/incidents rejects missing idempotency key", async () => {
  const incidentService = new IncidentCaseService();
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"], "tenant-a"),
    incidentService,
  });

  await assert.rejects(
    async () =>
      callRoute(
        routes,
        createMockContext(
          "/v1/incidents",
          "POST",
          ["v1", "incidents"],
          JSON.stringify({ severity: "critical", title: "Provider outage" }),
        ),
      ),
    /idempotency/i,
  );
});
