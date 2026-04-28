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
import { buildJsonResponse, requirePrincipal, resolveTenantScope, readLimit } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { AppError } from "../../../contracts/errors.js";
import { z } from "zod";
import type { CostReportService } from "../cost-report-service.js";

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
  costReportService: CostReportService;
}

// ─── Route Factory ─────────────────────────────────────────────────────────

export function createCostRoutes(deps: CostRouteDeps): RouteDefinition[] {
  return [
    {
      method: "POST",
      pathname: "/v1/cost-reports",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, createCostReportSchema.parse);
        const tenantId = resolveTenantScope(principal, payload.tenantId);

        const report = deps.costReportService.createReport({
          ...(tenantId !== undefined ? { tenantId } : {}),
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          totalCostUsd: payload.totalCostUsd,
          submittedBy: principal.actorId,
          ...(payload.submittedAt !== undefined ? { submittedAt: payload.submittedAt } : {}),
          ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
          resourceCosts: payload.resourceCosts.map((resourceCost) => ({
            resourceId: resourceCost.resourceId,
            resourceType: resourceCost.resourceType,
            costUsd: resourceCost.costUsd,
            currency: resourceCost.currency ?? "USD",
            ...(resourceCost.metadata !== undefined ? { metadata: resourceCost.metadata } : {}),
          })),
        });

        return buildJsonResponse(ctx.requestId, 201, report);
      },
    },
    {
      method: "GET",
      pathname: "/v1/cost-reports",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const tenantId = resolveTenantScope(principal, undefined);
        const limit = readLimit(ctx.request, 50);
        const costReports = deps.costReportService.listReports(limit, tenantId);
        return buildJsonResponse(ctx.requestId, 200, {
          costReports,
          total: costReports.length,
        });
      },
    },
  ];
}
