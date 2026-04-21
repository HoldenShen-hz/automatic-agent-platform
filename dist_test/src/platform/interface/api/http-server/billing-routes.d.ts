/**
 * @fileoverview Billing Routes - Billing webhook and reconciliation endpoints.
 *
 * Routes:
 * - POST /v1/billing/webhooks/reconcile
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { RouteDefinition } from "./types.js";
import type { BillingService } from "../../../../scale-ecosystem/marketplace/billing-service.js";
export interface BillingRouteDeps {
    billingService: BillingService | null;
    webhookSecret: string | null;
}
export declare function createBillingRoutes(deps: BillingRouteDeps): RouteDefinition[];
