/**
 * @fileoverview Admin Routes - Stability, admin task takeover, control-plane, workers, config, rollouts, tenants, and budgets.
 *
 * Routes:
 * - GET /v1/stability
 * - GET /v1/admin/tasks/:id
 * - GET /v1/admin/control-plane/load-balancing
 * - POST /v1/admin/control-plane/load-balancing/select
 * - GET /v1/admin/workers
 * - POST /v1/admin/config
 * - GET /v1/admin/rollouts
 * - GET /v1/admin/tenants
 * - GET /v1/admin/budgets
 *
 * Part of §6 API Endpoints - Missing endpoints implementation
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { ApiDelegationService } from "../facade-interfaces.js";
import type { ConfigRolloutService } from "../../../control-plane/config-center/config-rollout-service.js";
import type { TenantBoundaryRegistryService } from "../../../control-plane/tenant/index.js";
import type { CostReportService } from "../cost-report-service.js";
import type { AdminConfigService } from "../admin-config-service.js";
export interface AdminConfigUpdatePayload {
    key: string;
    value: unknown;
    tenantId?: string;
}
export interface AdminRouteDeps {
    authService: ApiAuthService | null;
    missionControlService: MissionControlService;
    coordinatorLoadBalancingService: ApiDelegationService | null;
    configRolloutService?: ConfigRolloutService | null;
    tenantRegistryService?: TenantBoundaryRegistryService | null;
    costReportService?: CostReportService | null;
    adminConfigService?: AdminConfigService | null;
}
export declare function createAdminRoutes(deps: AdminRouteDeps): RouteDefinition[];
