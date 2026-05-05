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
import { globalIdempotencyMiddleware } from "../middleware/sanitize.js";
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

function readRequiredIdempotencyKey(headers: Record<string, string | undefined>): string {
  const raw = headers["x-idempotency-key"];
  const idempotencyKey = typeof raw === "string" ? raw.trim() : "";
  if (idempotencyKey.length === 0) {
    throw new ApiError(400, "api.idempotency_key_required", "Incident creation requires x-idempotency-key.");
  }
  return idempotencyKey;
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
        if (tenantId === undefined) {
          throw new ApiError(403, "api.tenant_scope_required", "Cannot list incidents without a tenant scope.");
        }
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
        // #2353: Validate incidentId format to prevent arbitrary string injection
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(incidentId)) {
          throw new ApiError(400, "incident.invalid_id", "Incident ID contains invalid characters or is too long.");
        }
        const tenantId = resolveTenantScope(principal, undefined);
        if (tenantId === undefined) {
          throw new ApiError(403, "api.tenant_scope_required", "Cannot get incident without a tenant scope.");
        }

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

        const idempotencyKey = readRequiredIdempotencyKey(ctx.request.headers);
        const idempotencyCheck = globalIdempotencyMiddleware.check(idempotencyKey);
        if (idempotencyCheck.isDuplicate && idempotencyCheck.result !== undefined) {
          return buildJsonResponse(ctx.requestId, 200, idempotencyCheck.result);
        }

        const payload = readValidatedJsonBody(ctx.request.body, createIncidentSchema.parse);
        const tenantId = resolveTenantScope(principal, undefined);

        const incident = deps.incidentService.openIncident({
          tenantId: tenantId ?? null,
          severity: payload.severity as IncidentSeverity,
          title: payload.title,
          ...(payload.linkedEvidenceRefs !== undefined ? { linkedEvidenceRefs: payload.linkedEvidenceRefs } : {}),
        });

        globalIdempotencyMiddleware.complete(idempotencyKey, incident);

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
        // #2353: Validate incidentId format to prevent arbitrary string injection
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(incidentId)) {
          throw new ApiError(400, "incident.invalid_id", "Incident ID contains invalid characters or is too long.");
        }
        const payload = readValidatedJsonBody(ctx.request.body, updateIncidentSchema.parse);
        const tenantId = resolveTenantScope(principal, undefined);
        if (tenantId === undefined) {
          throw new ApiError(403, "api.tenant_scope_required", "Cannot update incident without a tenant scope.");
        }

        const incident = deps.incidentService.getIncident(tenantId, incidentId);
        if (!incident) {
          throw new ApiError(404, "incident.not_found", `Incident ${incidentId} not found.`);
        }

        // If only owner is being updated (no status change), handle as owner update
        if (payload.status === undefined && payload.owner !== undefined) {
          // §213-2358: Owner-only update without status transition is not a valid incident update
          // but the error message should be clear about the actual problem (not "transition to undefined")
          throw new ApiError(400, "incident.owner_only_not_supported", "Updating only the owner without a status transition is not supported. Include a status field to transition the incident.");
        }

        // If status is undefined but owner is also undefined, nothing to do
        if (payload.status === undefined) {
          throw new ApiError(400, "incident.no_update_fields", "No valid update fields provided. At minimum, a status transition is required.");
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
