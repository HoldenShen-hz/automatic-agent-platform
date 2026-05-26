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
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";
import {
  buildHashedCredentialFingerprint,
  createZeroableCredentialSecret,
  type ZeroableCredentialSecret,
} from "./credential-hygiene.js";

export interface CrmAdapterPluginOptions {
  apiBaseUrl?: string;
  crmType?: "salesforce" | "hubspot";
  policy?: NetworkEgressPolicyService;
  fetchImplementation?: typeof fetch;
}

const MUTATING_ACTIONS = new Set(["upsert_contact", "upsert_company", "append_note"]);
const READ_ACTIONS = new Set(["contacts", "companies", "deals", "contact", "company", "deal", "campaigns"]);
const ACTION_ALIASES: Readonly<Record<string, string>> = {
  get_contacts: "contacts",
  get_companies: "companies",
  get_deals: "deals",
  get_contact: "contact",
  get_company: "company",
  get_deal: "deal",
  get_campaigns: "campaigns",
};
const ALLOWED_ACTIONS = new Set([...READ_ACTIONS, ...MUTATING_ACTIONS]);

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
  let credentialSecret: ZeroableCredentialSecret | null = null;

  async function crmRequest(endpoint: string, method: string = "GET", body?: Record<string, unknown>): Promise<unknown> {
    if (credentialFingerprint == null || credentialSecret == null) {
      throw new Error("crm_adapter.not_authenticated");
    }
    const url = `${apiBaseUrl}/crm/v3/objects/${endpoint}`;
    const requestInit: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${credentialSecret.reveal()}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }
    const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new Error("crm_adapter.fetch_unavailable");
    }
    const response = await fetchImplementation(url, requestInit);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(`crm_adapter.api_error:${response.status}:${errorBody}`);
    }
    return response.json();
  }

  return {
    pluginId: "plugin.growth.crm_adapter",
    spiType: "adapter",
    adapterType: "crm_analytics",
    capabilityIds: [`external.${crmType}`, `external.${crmType}.contacts`, `external.${crmType}.campaigns`],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      if (credentialFingerprint == null) {
        return false;
      }
      const decision = await policy.evaluate(`${apiBaseUrl}/crm/v3/objects/contacts`);
      return decision.allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
      credentialSecret?.clear();
      credentialSecret = null;
    },
    async authenticate(credentials): Promise<void> {
      const token = requireString(credentials["token"] ?? credentials["managedSecretRef"], "token");
      credentialSecret?.clear();
      credentialSecret = createZeroableCredentialSecret(token);
      credentialFingerprint = buildHashedCredentialFingerprint(`crm_${crmType}`, token);
    },
    async execute(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
      if (credentialFingerprint == null || credentialSecret == null) {
        throw new Error("crm_adapter.not_authenticated");
      }
      const normalizedAction = ACTION_ALIASES[action] ?? action;
      if (!ALLOWED_ACTIONS.has(normalizedAction)) {
        throw new Error("crm_adapter.invalid_action");
      }
      const decision = await policy.evaluate(`${apiBaseUrl}/crm/v3/objects/${normalizedAction}`);
      if (!decision.allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, `CRM adapter: action "${action}" denied by egress policy`);
      }

      const startTime = Date.now();
      try {
        let result: unknown;
        switch (normalizedAction) {
          case "contacts":
          case "companies":
          case "deals": {
            const limit = typeof params.limit === "number" ? params.limit : 100;
            const after = typeof params.after === "string" ? params.after : undefined;
            const properties = typeof params.properties === "string" ? params.properties : undefined;
            const query = new URLSearchParams();
            query.set("limit", String(limit));
            if (after) query.set("after", after);
            if (properties) query.set("properties", properties);
            result = await crmRequest(`${action}?${query.toString()}`);
            break;
          }
          case "contact":
          case "company":
          case "deal": {
            const id = requireString(params.id, "id");
            result = await crmRequest(`${action}/${id}`);
            break;
          }
          case "campaigns": {
            result = await crmRequest("campaigns", "GET");
            break;
          }
          default: {
            if (!MUTATING_ACTIONS.has(normalizedAction)) {
              throw new Error("crm_adapter.invalid_action");
            }
            result = await crmRequest(normalizedAction, "POST", params);
          }
        }
        return {
          ok: true,
          data: { action, params, crmType, result },
          latencyMs: Date.now() - startTime,
        };
      } catch (err) {
        return {
          ok: false,
          data: { action, params, crmType, error: err instanceof Error ? err.message : String(err) },
          latencyMs: Date.now() - startTime,
        };
      }
    },
  };
}
