/**
 * @fileoverview HTTP Server Route Modules - Barrel export.
 *
 * All route factory functions exported for use by HttpApiServer.
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

export { createHealthRoutes, type HealthRouteDeps } from "./health-routes.js";
export { createMetricsRoutes, type MetricsRouteDeps } from "./metrics-routes.js";
export { createAuthRoutes, type AuthRouteDeps } from "./auth-routes.js";
export { createBillingRoutes, type BillingRouteDeps } from "./billing-routes.js";
export { createDivisionRoutes, type DivisionRouteDeps } from "./division-routes.js";
export { createDashboardRoutes, type DashboardRouteDeps } from "./dashboard-routes.js";
export { createGatewayRoutes, type GatewayRouteDeps } from "./gateway-routes.js";
export { createTaskRoutes, type TaskRouteDeps } from "./task-routes.js";
export { createWebhookRoutes, type WebhookRouteDeps } from "./webhook-routes.js";
export { createApprovalRoutes, type ApprovalRouteDeps } from "./approval-routes.js";
export { createAdminRoutes, type AdminRouteDeps } from "./admin-routes.js";
export { createConsoleRoutes, type ConsoleRouteDeps } from "./console-routes.js";
export { createPlaneRoutes, type PlaneRouteDeps } from "./plane-routes.js";
export { createIncidentRoutes, type IncidentRouteDeps } from "./incident-routes.js";
export { createPackRoutes, type PackRouteDeps } from "./pack-routes.js";
export { createCostRoutes, type CostRouteDeps } from "./cost-routes.js";

export type { RouteContext, RouteDefinition, RouteMatch, ApiRequestLike, ApiResponsePayload, RouteHandler } from "./types.js";
