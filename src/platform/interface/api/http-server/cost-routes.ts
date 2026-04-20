/**
 * Cost Routes - REST API for cost reporting and budgets.
 *
 * Routes:
 * - POST /v1/cost-reports - Submit cost report
 * - GET /v1/cost-reports - List cost reports
 *
 * Part of §6 API Endpoints (REST Endpoints)
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { buildJsonResponse, requirePrincipal, resolveTenantScope } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { AppError } from "../../../contracts/errors.js";
import { z } from "zod";

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

const createCostReportSchema = z.object({
  tenantId: nonEmptyStringSchema.optional(),
  periodStart: nonEmptyStringSchema,
  periodEnd: nonEmptyStringSchema,
  resourceCosts: z.array(z.object({
    resourceId: nonEmptyStringSchema,
    resourceType: z.enum(["compute", "storage", "network", "api"]),
    costUsd: z.number().positive(),
    currency: z.string().default("USD"),
    metadata: z.record(z.unknown()).optional(),
  })),
  totalCostUsd: z.number().positive(),
  currency: z.string().default("USD"),
  submittedAt: nonEmptyStringSchema.optional(),
}).strict();

export interface CostReportPayload {
  tenantId?: string;
  periodStart: string;
  periodEnd: string;
  resourceCosts: Array<{
    resourceId: string;
    resourceType: "compute" | "storage" | "network" | "api";
    costUsd: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  }>;
  totalCostUsd: number;
  currency?: string;
  submittedAt?: string;
}

// ─── Route Deps ─────────────────────────────────────────────────────────────

export interface CostRouteDeps {
  authService: ApiAuthService | null;
}

// ─── Route Factory ─────────────────────────────────────────────────────────

export function createCostRoutes(deps: CostRouteDeps): RouteDefinition[] {
  return [
    {
      method: "POST",
      pathname: "/v1/cost-reports",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, createCostReportSchema);
        const tenantId = resolveTenantScope(principal, payload.tenantId);

        // In production, would store and process the cost report
        const report = {
          reportId: `cost-${Date.now()}`,
          tenantId,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          totalCostUsd: payload.totalCostUsd,
          currency: payload.currency ?? "USD",
          resourceCount: payload.resourceCosts.length,
          submittedBy: principal.subjectId,
          submittedAt: payload.submittedAt ?? new Date().toISOString(),
        };

        return buildJsonResponse(ctx.requestId, 201, report);
      },
    },
    {
      method: "GET",
      pathname: "/v1/cost-reports",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const tenantId = resolveTenantScope(principal);

        void tenantId;

        // Return empty cost reports - in production would query cost service
        return buildJsonResponse(ctx.requestId, 200, {
          costReports: [],
          total: 0,
        });
      },
    },
  ];
}
