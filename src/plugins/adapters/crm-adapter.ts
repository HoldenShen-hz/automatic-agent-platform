/**
 * CRM adapter plugin for the Growth domain.
 *
 * Integrates with CRM platforms (e.g., Salesforce, HubSpot) to fetch
 * customer data, segment information, and campaign attribution for growth tasks.
 *
 * §G8: Growth domain M2 Phase 2 — Ad Platforms + CRM required.
 */

import type { ExternalAdapterPlugin, PluginLifecycleContext } from "../../domains/registry/plugin-spi.js";
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

    // §22.4 Complete lifecycle hooks
    async onLoad(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being loaded - perform any initialization
      return;
    },

    async onActivate(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being activated - verify credentials
      if (!credentialFingerprint) {
        throw new Error("crm_adapter.not_authenticated: authenticate() must be called before activation");
      }
      return;
    },

    async onDeactivate(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being deactivated - clean up resources
      credentialFingerprint = null;
      return;
    },

    async onUnload(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being unloaded - release all resources
      credentialFingerprint = null;
      return;
    },

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
      // Use a SHA-256 hash prefix (first 8 hex chars) for fingerprinting instead of storing
      // plaintext token fragments, which could leak credential data
      let tokenHash: string;
      if (typeof globalThis.crypto?.subtle?.digest === "function") {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
      } else {
        tokenHash = `fallback_${Date.now()}`;
      }
      credentialFingerprint = `crm_${crmType}_${tokenHash}`;
      // Return void — fingerprint is stored in credentialFingerprint for later retrieval
    },
    async execute(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
      const decision = policy.evaluate(`${apiBaseUrl}/crm/v3/objects/${action}`);
      if (!decision.allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, `CRM adapter: action "${action}" denied by egress policy`);
      }

      if (!credentialFingerprint) {
        throw new Error("crm_adapter.not_authenticated: authenticate() must be called before execute()");
      }

      // Build the CRM API endpoint based on action
      const endpoint = `${apiBaseUrl}/crm/v3/objects/${action}`;
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${credentialFingerprint}`,
        "Content-Type": "application/json",
      };

      // Make the actual CRM API call - POST for mutating actions, GET for reads
      const isMutatingAction = ["contacts", "companies", "deals", "tickets", "line_items"].includes(action);
      let response: Response;
      try {
        if (isMutatingAction && params) {
          // Mutating actions POST to create/update
          response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(params),
          });
        } else {
          // Read actions use GET with query params
          const queryString = new URLSearchParams(
            Object.entries(params).reduce((acc, [k, v]) => {
              if (v != null) acc[k] = String(v);
              return acc;
            }, {} as Record<string, string>)
          ).toString();
          response = await fetch(`${endpoint}${queryString ? `?${queryString}` : ""}`, {
            method: "GET",
            headers,
          });
        }
      } catch (networkErr) {
        throw new Error(`crm_adapter.network_error: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`crm_adapter.api_error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const responseData = await response.json() as Record<string, unknown>;
      return {
        ok: true,
        data: responseData,
        action,
        params,
        crmType,
        result: `CRM ${action} completed`,
        latencyMs: 0,
      };
    },
  };
}
