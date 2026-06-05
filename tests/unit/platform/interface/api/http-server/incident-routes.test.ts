import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { IncidentCaseService } from "../../../../../../src/platform/five-plane-state-evidence/incident/index.js";
import { createIncidentRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/incident-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { IncidentCase as FacadeIncidentCase, IncidentFacadeService } from "../../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createIncidentService(): IncidentCaseService {
  return new IncidentCaseService({
    persistencePath: join(tmpdir(), `aa-incident-routes-${randomUUID()}.json`),
  });
}

function createMockAuthService(roles: string[] = ["viewer"], tenantId: string | null = null): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId }),
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

function toFacadeIncident(incident: ReturnType<IncidentCaseService["openIncident"]>): FacadeIncidentCase {
  return {
    incidentId: incident.incidentId,
    severity: incident.severity,
    status:
      incident.status === "open"
        ? "open"
        : incident.status === "acknowledged" || incident.status === "triaged"
          ? "acknowledged"
          : incident.status === "closed"
            ? "closed"
            : incident.status === "resolved"
            ? "resolved"
            : "mitigating",
    title: incident.title,
    linkedEvidenceRefs: incident.linkedEvidenceRefs,
    owner: incident.owner,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    resolvedAt: incident.resolvedAt,
    snoozedUntil: incident.snoozedUntil,
  };
}

function createIncidentFacade(service: IncidentCaseService): IncidentFacadeService {
  return {
    listIncidents: (limit, tenantId) => service.listIncidents(limit, tenantId).map(toFacadeIncident),
    listIncidentsPaginated: (limit, tenantId, cursor) => {
      const result = service.listIncidentsPaginated(limit, tenantId, cursor);
      return {
        incidents: result.incidents.map(toFacadeIncident),
        nextToken: result.nextToken,
      };
    },
    getIncident: (incidentId, tenantId) => {
      const incident = service.getIncident(incidentId, tenantId);
      return incident == null ? null : toFacadeIncident(incident);
    },
    openIncident: (input) => toFacadeIncident(service.openIncident(input)),
    acknowledge: (incidentId, owner, tenantId) => toFacadeIncident(service.acknowledge(incidentId, owner, tenantId)),
    startMitigation: (incidentId, tenantId) => toFacadeIncident(service.startMitigation(incidentId, tenantId)),
    resolve: (incidentId, tenantId) => toFacadeIncident(service.resolve(incidentId, tenantId)),
    close: (incidentId, tenantId) => toFacadeIncident(service.close(incidentId, tenantId)),
    snooze: (incidentId, snoozedUntil, tenantId) => toFacadeIncident(service.snooze(incidentId, snoozedUntil, tenantId)),
  };
}

test("IncidentCaseService opens incident", () => {
  const service = createIncidentService();

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
  const service = createIncidentService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  const acknowledged = service.acknowledge(incident.incidentId, "operator-1");

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(acknowledged.owner, "operator-1");
});

test("IncidentCaseService resolves incident", () => {
  const service = createIncidentService();
  const incident = service.openIncident({ severity: "high", title: "Test" });
  service.acknowledge(incident.incidentId, "operator-1");
  service.startMitigation(incident.incidentId);
  service.review(incident.incidentId);

  const resolved = service.resolve(incident.incidentId);

  assert.equal(resolved.status, "resolved");
  assert.ok(resolved.resolvedAt);
});

test("IncidentCaseService snoozes incident until a concrete deadline", () => {
  const service = createIncidentService();
  const incident = service.openIncident({ severity: "high", title: "Test" });
  const snoozedUntil = "2026-06-05T12:00:00.000Z";

  const snoozed = service.snooze(incident.incidentId, snoozedUntil);

  assert.equal(snoozed.snoozedUntil, snoozedUntil);
});

test("IncidentCaseService closes active incident", () => {
  const service = createIncidentService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  const closed = service.close(incident.incidentId);

  assert.equal(closed.status, "closed");
});

test("IncidentCaseService startMitigation requires acknowledge first", () => {
  const service = createIncidentService();
  const incident = service.openIncident({ severity: "high", title: "Test" });

  assert.throws(() => {
    service.startMitigation(incident.incidentId);
  }, /must be acknowledged/);
});

test("IncidentCaseService getIncident returns null for unknown", () => {
  const service = createIncidentService();

  const result = service.getIncident("unknown");

  assert.equal(result, null);
});

test("IncidentCaseService listIncidents returns newest incidents first", () => {
  const service = createIncidentService();
  service.openIncident({ severity: "low", title: "first" });
  service.openIncident({ severity: "critical", title: "second" });

  const incidents = service.listIncidents();

  assert.equal(incidents.length, 2);
  assert.equal(incidents[0]?.title, "second");
});

test("GET /v1/incidents lists incidents from service", async () => {
  const incidentService = createIncidentService();
  incidentService.openIncident({ severity: "high", title: "Database latency" });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(),
    incidentService: createIncidentFacade(incidentService),
  });

  const response = await callRoute(routes, createMockContext("/v1/incidents", ["v1", "incidents"]));
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("Database latency"));
});

test("GET /v1/incidents only returns incidents for the caller tenant", async () => {
  const incidentService = createIncidentService();
  incidentService.openIncident({ severity: "high", title: "Tenant A latency", tenantId: "tenant-a" });
  incidentService.openIncident({ severity: "critical", title: "Tenant B outage", tenantId: "tenant-b" });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["viewer"], "tenant-a"),
    incidentService: createIncidentFacade(incidentService),
  });

  const response = await callRoute(routes, createMockContext("/v1/incidents", ["v1", "incidents"]));
  if (!response) throw new Error("handler returned null");
  const body = JSON.parse(response.body) as { data: { incidents: Array<{ title: string }> } };
  assert.deepEqual(body.data.incidents.map((incident) => incident.title), ["Tenant A latency"]);
});

test("GET /v1/incidents maps facade incidents into frontend incident dto shape", async () => {
  const incidentService = createIncidentService();
  const opened = incidentService.openIncident({ severity: "high", title: "Mapped incident", linkedEvidenceRefs: ["evidence-1"] });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(),
    incidentService: createIncidentFacade(incidentService),
  });

  const response = await callRoute(routes, createMockContext("/v1/incidents", ["v1", "incidents"]));
  if (!response) throw new Error("handler returned null");
  const body = JSON.parse(response.body) as {
    data: {
      incidents: Array<{
        id: string;
        title: string;
        summary: string;
        status: string;
      owner: string | null;
      snoozedUntil: string | null;
      linkedEvidenceRefs: string[];
      }>;
    };
  };
  assert.equal(body.data.incidents[0]?.id, opened.incidentId);
  assert.equal(body.data.incidents[0]?.title, "Mapped incident");
  assert.match(body.data.incidents[0]?.summary ?? "", /open/);
  assert.equal(body.data.incidents[0]?.snoozedUntil, null);
  assert.deepEqual(body.data.incidents[0]?.linkedEvidenceRefs, ["evidence-1"]);
});

test("POST /v1/incidents creates a new incident", async () => {
  const incidentService = createIncidentService();
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"]),
    incidentService: createIncidentFacade(incidentService),
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

test("PATCH /v1/incidents/:id accepts snooze deadlines", async () => {
  const incidentService = createIncidentService();
  const incident = incidentService.openIncident({ severity: "high", title: "Snooze me" });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"]),
    incidentService: createIncidentFacade(incidentService),
  });

  const response = await callRoute(
    routes,
    {
      ...createMockContext(`/v1/incidents/${incident.incidentId}`, ["v1", "incidents", incident.incidentId], JSON.stringify({
        snoozedUntil: "2026-06-05T12:00:00.000Z",
      })),
      request: {
        method: "PATCH",
        url: `/v1/incidents/${incident.incidentId}`,
        headers: {},
        body: JSON.stringify({ snoozedUntil: "2026-06-05T12:00:00.000Z" }),
      } as never,
    },
  );
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /2026-06-05T12:00:00.000Z/);
});

test("PATCH /v1/incidents/:id can close an incident from the operator console", async () => {
  const incidentService = createIncidentService();
  const incident = incidentService.openIncident({ severity: "high", title: "Dismiss me" });
  const routes = createIncidentRoutes({
    authService: createMockAuthService(["operator"]),
    incidentService: createIncidentFacade(incidentService),
  });

  const response = await callRoute(
    routes,
    {
      ...createMockContext(`/v1/incidents/${incident.incidentId}`, ["v1", "incidents", incident.incidentId], JSON.stringify({
        status: "closed",
      })),
      request: {
        method: "PATCH",
        url: `/v1/incidents/${incident.incidentId}`,
        headers: {},
        body: JSON.stringify({ status: "closed" }),
      } as never,
    },
  );
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /closed/);
});
