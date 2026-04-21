/**
 * CRM adapter plugin for the Growth domain.
 *
 * Integrates with CRM platforms (e.g., Salesforce, HubSpot) to fetch
 * customer data, segment information, and campaign attribution for growth tasks.
 *
 * §G8: Growth domain M2 Phase 2 — Ad Platforms + CRM required.
 */
import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { NetworkEgressPolicyService } from "../../platform/control-plane/iam/network-egress-policy.js";
export interface CrmAdapterPluginOptions {
    apiBaseUrl?: string;
    crmType?: "salesforce" | "hubspot";
    policy?: NetworkEgressPolicyService;
}
export declare function createCrmAdapterPlugin(options?: CrmAdapterPluginOptions): ExternalAdapterPlugin;
