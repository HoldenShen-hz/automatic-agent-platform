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
// R29-32: Incident ID format validation - must be non-empty string
const incidentIdSchema = z.string().trim().min(1).max(128);

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
        const incidents: IncidentCase[] = deps.incidentService.listIncidents(limit, tenantId);

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
        // R29-32: Validate incidentId before use to prevent injection attacks
        const rawIncidentId = segments[2]!;
        const parsedIncidentId = incidentIdSchema.safeParse(rawIncidentId);
        if (!parsedIncidentId.success) {
          throw new ApiError(400, "incident.invalid_id", "Invalid incident ID format.");
        }
        const incidentId = parsedIncidentId.data;
        const tenantId = resolveTenantScope(principal, undefined);

        const incident = deps.incidentService.getIncident(incidentId, tenantId);
        if (!incident) {
          throw new ApiError(404, "incident.not_found", "Incident not found.");
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
        const tenantId = resolveTenantScope(principal, undefined) ?? null;

        const incident = deps.incidentService.openIncident({
          severity: payload.severity as IncidentSeverity,
          title: payload.title,
          ...(payload.linkedEvidenceRefs !== undefined ? { linkedEvidenceRefs: payload.linkedEvidenceRefs } : {}),
          tenantId,
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
        // R29-32: Validate incidentId before use to prevent injection attacks
        const rawIncidentId = segments[2]!;
        const parsedIncidentId = incidentIdSchema.safeParse(rawIncidentId);
        if (!parsedIncidentId.success) {
          throw new ApiError(400, "incident.invalid_id", "Invalid incident ID format.");
        }
        const incidentId = parsedIncidentId.data;
        const tenantId = resolveTenantScope(principal, undefined);
        const payload = readValidatedJsonBody(ctx.request.body, updateIncidentSchema.parse);

        void principal;
        const incident = deps.incidentService.getIncident(incidentId, tenantId);
        if (!incident) {
          throw new ApiError(404, "incident.not_found", "Incident not found.");
        }

        let updated: IncidentCase;
        if (payload.status === "acknowledged" && incident.status === "open") {
          updated = deps.incidentService.acknowledge(incidentId, payload.owner ?? "unknown");
        } else if (payload.status === "mitigating") {
          updated = deps.incidentService.startMitigation(incidentId);
        } else if (payload.status === "resolved") {
          updated = deps.incidentService.resolve(incidentId);
        } else {
          throw new ApiError(400, "incident.invalid_transition", `Cannot transition from ${incident.status} to ${payload.status}.`);
        }

        return buildJsonResponse(ctx.requestId, 200, updated);
      },
    },
  ];
}
