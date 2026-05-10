/**
 * CRM adapter plugin for the Growth domain.
 *
 * Integrates with CRM platforms (e.g., Salesforce, HubSpot) to fetch
 * customer data, segment information, and campaign attribution for growth tasks.
 *
 * §G8: Growth domain M2 Phase 2 — Ad Platforms + CRM required.
 */

import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError, type ErrorCode } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/control-plane/iam/network-egress-policy.js";

export interface CrmAdapterPluginOptions {
  apiBaseUrl?: string;
  crmType?: "salesforce" | "hubspot";
  policy?: NetworkEgressPolicyService;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`crm_adapter.missing_${field}`);
  }
  return value.trim();
}

export function createCrmAdapterPlugin(options: CrmAdapterPluginOptions = {}): ExternalAdapterPlugin {
  const apiBaseUrl = (options.apiBaseUrl ?? "https://api.hubspot.com").replace(/\/+$/, "");
  const crmType = options.crmType ?? "hubspot";
  const policy = options.policy ?? new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["api.hubspot.com", "api.salesforce.com"],
  });
  let credentialFingerprint: string | null = null;

  return {
    pluginId: "plugin.growth.crm_adapter",
    spiType: "adapter",
    adapterType: "crm_analytics",
    capabilityIds: [`external.${crmType}`, `external.${crmType}.contacts`, `external.${crmType}.campaigns`],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      return policy.evaluate(`${apiBaseUrl}/crm/v3/objects/contacts`).allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials): Promise<void> {
      const token = requireString(credentials["token"] ?? credentials["managedSecretRef"], "token");
      credentialFingerprint = `crm_${crmType}_${token.slice(0, 8)}`;
      // Return void — fingerprint is stored in credentialFingerprint for later retrieval
    },
    async execute(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
      if (!/^[a-zA-Z0-9_]+$/.test(action)) {
        throw new Error("crm_adapter.invalid_action");
      }
      const decision = policy.evaluate(`${apiBaseUrl}/crm/v3/objects/${action}`);
      if (!decision.allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, `CRM adapter: action "${action}" denied by egress policy`);
      }

      // Stub: in production this would call the CRM REST API.
      // Return a structured response matching the expected adapter output schema.
      return {
        ok: true,
        data: {
          action,
          params,
          crmType,
          result: `CRM ${action} stub — implement ${crmType} API integration`,
        },
        latencyMs: 0,
      };
    },
  };
}
