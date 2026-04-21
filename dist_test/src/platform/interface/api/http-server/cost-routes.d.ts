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
import type { ApiAuthService } from "../api-auth-service.js";
import type { CostReportService } from "../cost-report-service.js";
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
export interface CostRouteDeps {
    authService: ApiAuthService | null;
    costReportService: CostReportService;
}
export declare function createCostRoutes(deps: CostRouteDeps): RouteDefinition[];
