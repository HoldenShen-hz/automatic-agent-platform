/**
 * Incident Routes - REST API for incident management.
 *
 * Routes:
 * - GET /v1/incidents - List incidents
 * - GET /v1/incidents/:id - Get incident
 * - POST /v1/incidents - Create incident
 * - PATCH /v1/incidents/:id - Update incident
 *
 * Part of §6 API Endpoints (REST Endpoints)
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { buildJsonResponse, requirePrincipal, resolveTenantScope, readLimit } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { IncidentFacadeService, IncidentCase, IncidentSeverity } from "../facade-interfaces.js";
import { z } from "zod";
import { AppError } from "../../../contracts/errors.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const nonEmptyStringSchema = z.string().trim().min(1);

const createIncidentSchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: nonEmptyStringSchema,
  linkedEvidenceRefs: z.array(z.string()).optional(),
}).strict();

const updateIncidentSchema = z.object({
  status: z.enum(["open", "acknowledged", "mitigating", "resolved"]).optional(),
  owner: z.string().optional(),
}).strict();

// ─── Route Deps ─────────────────────────────────────────────────────────────

export interface IncidentRouteDeps {
  authService: ApiAuthService | null;
  incidentService: IncidentFacadeService;
}

// ─── Route Factory ─────────────────────────────────────────────────────────

export function createIncidentRoutes(deps: IncidentRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/incidents",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const tenantId = resolveTenantScope(principal, undefined);
        const limit = readLimit(ctx.request, 50);
        const incidents: IncidentCase[] = deps.incidentService.listIncidents(tenantId, limit);

        return buildJsonResponse(ctx.requestId, 200, {
          incidents,
          total: incidents.length,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "v1" || segments[1] !== "incidents" || segments.length !== 3) {
          return null;
        }

        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const incidentId = segments[2]!;
        const tenantId = resolveTenantScope(principal, undefined);

        const incident = deps.incidentService.getIncident(tenantId, incidentId);
        if (!incident) {
          throw new ApiError(404, "incident.not_found", `Incident ${incidentId} not found.`);
        }

        return buildJsonResponse(ctx.requestId, 200, incident);
      },
    },
    {
      method: "POST",
      pathname: "/v1/incidents",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, createIncidentSchema.parse);
        const tenantId = resolveTenantScope(principal, undefined);

        const incident = deps.incidentService.openIncident({
          tenantId,
          severity: payload.severity as IncidentSeverity,
          title: payload.title,
          ...(payload.linkedEvidenceRefs !== undefined ? { linkedEvidenceRefs: payload.linkedEvidenceRefs } : {}),
        });

        return buildJsonResponse(ctx.requestId, 201, incident);
      },
    },
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "v1" || segments[1] !== "incidents" || segments.length !== 3) {
          return null;
        }

        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const incidentId = segments[2]!;
        const payload = readValidatedJsonBody(ctx.request.body, updateIncidentSchema.parse);
        const tenantId = resolveTenantScope(principal, undefined);

        const incident = deps.incidentService.getIncident(tenantId, incidentId);
        if (!incident) {
          throw new ApiError(404, "incident.not_found", `Incident ${incidentId} not found.`);
        }

        let updated: IncidentCase;
        if (payload.status === "acknowledged" && incident.status === "open") {
          // R14-17: Pass tenantId to enforce tenant scoping on state transitions
          updated = deps.incidentService.acknowledge(tenantId, incidentId, payload.owner ?? "unknown");
        } else if (payload.status === "mitigating") {
          // R14-17: Pass tenantId to enforce tenant scoping on state transitions
          updated = deps.incidentService.startMitigation(tenantId, incidentId);
        } else if (payload.status === "resolved") {
          // R14-17: Pass tenantId to enforce tenant scoping on state transitions
          updated = deps.incidentService.resolve(tenantId, incidentId);
        } else {
          throw new ApiError(400, "incident.invalid_transition", `Cannot transition from ${incident.status} to ${payload.status}.`);
        }

        return buildJsonResponse(ctx.requestId, 200, updated);
      },
    },
  ];
}
