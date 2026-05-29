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
import { parseSafeOutboundUrl } from "../../platform/five-plane-control-plane/iam/outbound-url-policy.js";
import {
  buildHashedCredentialFingerprint,
  createZeroableCredentialSecret,
  type ZeroableCredentialSecret,
} from "./credential-hygiene.js";

type CrmType = "salesforce" | "hubspot";
type CrmRequestMethod = "GET" | "POST";
type NormalizedCrmAction =
  | "contacts"
  | "companies"
  | "deals"
  | "contact"
  | "company"
  | "deal"
  | "campaigns"
  | "upsert_contact"
  | "upsert_company"
  | "append_note";

interface CrmAdapterRuntimeConfig {
  crmType: CrmType;
  defaultApiBaseUrl: string;
  allowedDomains: readonly string[];
  aliases: Readonly<Record<string, NormalizedCrmAction>>;
  buildListPath: (action: "contacts" | "companies" | "deals" | "campaigns", params: Record<string, unknown>) => string;
  buildItemPath: (action: "contact" | "company" | "deal", params: Record<string, unknown>) => string;
  buildMutationPath: (action: "upsert_contact" | "upsert_company" | "append_note") => string;
}

export interface CrmAdapterPluginOptions {
  apiBaseUrl?: string;
  crmType?: CrmType;
  policy?: NetworkEgressPolicyService;
  fetchImplementation?: typeof fetch;
  defaultTimeoutMs?: number;
  maxResponseSizeBytes?: number;
  salesforceApiVersion?: string;
}

const MUTATING_ACTIONS = new Set<NormalizedCrmAction>(["upsert_contact", "upsert_company", "append_note"]);
const READ_ACTIONS = new Set<NormalizedCrmAction>(["contacts", "companies", "deals", "contact", "company", "deal", "campaigns"]);

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`crm_adapter.missing_${field}`);
  }
  return value.trim();
}

function normalizeCrmApiBaseUrl(value: string | undefined, runtime: CrmAdapterRuntimeConfig): string {
  const parsed = parseSafeOutboundUrl((value ?? runtime.defaultApiBaseUrl).trim(), {
    invalid: "crm_adapter.invalid_api_base_url",
    blocked: "crm_adapter.blocked_api_base_url",
  });
  if (parsed.protocol !== "https:") {
    throw new Error("crm_adapter.invalid_api_base_url_protocol");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeLimit(value: unknown): number {
  if (value == null) {
    return 100;
  }
  const limit = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("crm_adapter.invalid_limit");
  }
  return Math.min(500, Math.floor(limit));
}

function maybeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

async function readResponseTextWithLimit(
  response: Partial<Pick<Response, "body" | "headers" | "text">>,
  maxResponseSizeBytes: number,
): Promise<string> {
  const headerLength = typeof response.headers?.get === "function"
    ? response.headers.get("content-length")
    : null;
  if (headerLength != null) {
    const parsedLength = Number(headerLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxResponseSizeBytes) {
      throw new Error("crm_adapter.response_too_large");
    }
  }
  if (response.body == null) {
    if (typeof response.text === "function") {
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxResponseSizeBytes) {
        throw new Error("crm_adapter.response_too_large");
      }
      return text;
    }
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let result = "";
  return reader.read().then(function pump(chunk): Promise<string> {
    if (chunk.done) {
      result += decoder.decode();
      return Promise.resolve(result);
    }
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxResponseSizeBytes) {
      void reader.cancel();
      throw new Error("crm_adapter.response_too_large");
    }
    result += decoder.decode(chunk.value, { stream: true });
    return reader.read().then(pump);
  });
}

async function performCrmFetch(params: {
  fetchImplementation: typeof fetch;
  url: string;
  method: CrmRequestMethod;
  body: Record<string, unknown> | undefined;
  credentialSecret: ZeroableCredentialSecret;
  defaultTimeoutMs: number;
  maxResponseSizeBytes: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error("crm_adapter.timeout")), params.defaultTimeoutMs);
  try {
    const response = await params.credentialSecret.withSecret((token) =>
      params.fetchImplementation(params.url, {
        method: params.method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(params.body === undefined ? {} : { body: JSON.stringify(params.body) }),
        signal: controller.signal,
      }),
    );
    const responseText = await readResponseTextWithLimit(response, params.maxResponseSizeBytes);
    if (!response.ok) {
      throw new Error(`crm_adapter.api_error:${response.status}:${responseText || "unknown"}`);
    }
    if (responseText.length > 0) {
      return JSON.parse(responseText) as unknown;
    }
    if (typeof response.json === "function") {
      return await response.json();
    }
    return {};
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function createHubspotRuntimeConfig(): CrmAdapterRuntimeConfig {
  return {
    crmType: "hubspot",
    defaultApiBaseUrl: "https://api.hubspot.com",
    allowedDomains: ["api.hubspot.com"],
    aliases: {
      get_contacts: "contacts",
      get_companies: "companies",
      get_deals: "deals",
      get_contact: "contact",
      get_company: "company",
      get_deal: "deal",
      get_campaigns: "campaigns",
    },
    buildListPath(action, params) {
      const query = new URLSearchParams();
      query.set("limit", String(normalizeLimit(params.limit)));
      const after = maybeString(params.after);
      const properties = maybeString(params.properties);
      if (after) {
        query.set("after", after);
      }
      if (properties) {
        query.set("properties", properties);
      }
      return `/crm/v3/objects/${action}?${query.toString()}`;
    },
    buildItemPath(action, params) {
      const id = encodeURIComponent(requireString(params.id, "id"));
      const resource = action === "contact" ? "contacts" : action === "company" ? "companies" : "deals";
      return `/crm/v3/objects/${resource}/${id}`;
    },
    buildMutationPath(action) {
      switch (action) {
        case "upsert_contact":
          return "/crm/v3/objects/contacts";
        case "upsert_company":
          return "/crm/v3/objects/companies";
        case "append_note":
          return "/crm/v3/objects/notes";
      }
    },
  };
}

function createSalesforceRuntimeConfig(apiVersion: string): CrmAdapterRuntimeConfig {
  const basePath = `/services/data/${encodeURIComponent(apiVersion)}`;
  return {
    crmType: "salesforce",
    defaultApiBaseUrl: "https://api.salesforce.com",
    allowedDomains: ["api.salesforce.com"],
    aliases: {
      get_contacts: "contacts",
      get_companies: "companies",
      get_deals: "deals",
      get_contact: "contact",
      get_company: "company",
      get_deal: "deal",
      get_campaigns: "campaigns",
      list_contacts: "contacts",
      list_companies: "companies",
      list_deals: "deals",
    },
    buildListPath(action, params) {
      const query = new URLSearchParams();
      query.set("limit", String(normalizeLimit(params.limit)));
      const after = maybeString(params.after);
      if (after) {
        query.set("offset", after);
      }
      const sobjectName = action === "contacts"
        ? "Contact"
        : action === "companies"
        ? "Account"
        : action === "deals"
        ? "Opportunity"
        : "Campaign";
      return `${basePath}/sobjects/${sobjectName}?${query.toString()}`;
    },
    buildItemPath(action, params) {
      const id = encodeURIComponent(requireString(params.id, "id"));
      const sobjectName = action === "contact" ? "Contact" : action === "company" ? "Account" : "Opportunity";
      return `${basePath}/sobjects/${sobjectName}/${id}`;
    },
    buildMutationPath(action) {
      switch (action) {
        case "upsert_contact":
          return `${basePath}/sobjects/Contact`;
        case "upsert_company":
          return `${basePath}/sobjects/Account`;
        case "append_note":
          return `${basePath}/sobjects/Note`;
      }
    },
  };
}

function buildCrmRuntimeConfig(options: CrmAdapterPluginOptions): CrmAdapterRuntimeConfig {
  if ((options.crmType ?? "hubspot") === "salesforce") {
    return createSalesforceRuntimeConfig(options.salesforceApiVersion ?? "v60.0");
  }
  return createHubspotRuntimeConfig();
}

export function createCrmAdapterPlugin(options: CrmAdapterPluginOptions = {}): ExternalAdapterPlugin {
  const runtime = buildCrmRuntimeConfig(options);
  const apiBaseUrl = normalizeCrmApiBaseUrl(options.apiBaseUrl, runtime);
  const policy = options.policy ?? new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: [...runtime.allowedDomains],
  });
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
  const maxResponseSizeBytes = options.maxResponseSizeBytes ?? 1024 * 1024;
  let credentialFingerprint: string | null = null;
  let credentialSecret: ZeroableCredentialSecret | null = null;

  async function crmRequest(
    action: NormalizedCrmAction,
    method: CrmRequestMethod,
    params: Record<string, unknown>,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    if (credentialFingerprint == null || credentialSecret == null) {
      throw new Error("crm_adapter.not_authenticated");
    }
    const path = READ_ACTIONS.has(action)
      ? action === "contact" || action === "company" || action === "deal"
        ? runtime.buildItemPath(action, params)
        : runtime.buildListPath(action as "contacts" | "companies" | "deals" | "campaigns", params)
      : runtime.buildMutationPath(action as "upsert_contact" | "upsert_company" | "append_note");
    const url = `${apiBaseUrl}${path}`;
    const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new Error("crm_adapter.fetch_unavailable");
    }
    return performCrmFetch({
      fetchImplementation,
      url,
      method,
      body,
      credentialSecret,
      defaultTimeoutMs,
      maxResponseSizeBytes,
    });
  }

  return {
    pluginId: "plugin.growth.crm_adapter",
    spiType: "adapter",
    adapterType: "crm_analytics",
    capabilityIds: [`external.${runtime.crmType}`, `external.${runtime.crmType}.contacts`, `external.${runtime.crmType}.campaigns`],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      const decision = await policy.evaluate(`${apiBaseUrl}${runtime.buildListPath("contacts", { limit: 1 })}`);
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
      credentialFingerprint = buildHashedCredentialFingerprint(`crm_${runtime.crmType}`, token);
    },
    async execute(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
      if (credentialFingerprint == null || credentialSecret == null) {
        throw new Error("crm_adapter.not_authenticated");
      }
      const normalizedAction = runtime.aliases[action] ?? (action as NormalizedCrmAction);
      if (!READ_ACTIONS.has(normalizedAction) && !MUTATING_ACTIONS.has(normalizedAction)) {
        throw new Error("crm_adapter.invalid_action");
      }

      const previewPath = READ_ACTIONS.has(normalizedAction)
        ? normalizedAction === "contact" || normalizedAction === "company" || normalizedAction === "deal"
          ? runtime.buildItemPath(normalizedAction, { ...params, id: params.id ?? "preview" })
          : runtime.buildListPath(normalizedAction as "contacts" | "companies" | "deals" | "campaigns", params)
        : runtime.buildMutationPath(normalizedAction as "upsert_contact" | "upsert_company" | "append_note");
      const decision = await policy.evaluate(`${apiBaseUrl}${previewPath}`);
      if (!decision.allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, `CRM adapter: action "${action}" denied by egress policy`);
      }

      const startTime = Date.now();
      try {
        const result = READ_ACTIONS.has(normalizedAction)
          ? await crmRequest(normalizedAction, "GET", params)
          : await crmRequest(normalizedAction, "POST", params, params);
        return {
          ok: true,
          data: { action, normalizedAction, params, crmType: runtime.crmType, result },
          latencyMs: Date.now() - startTime,
        };
      } catch (err) {
        return {
          ok: false,
          data: {
            action,
            normalizedAction,
            params,
            crmType: runtime.crmType,
            error: err instanceof Error ? err.message : String(err),
          },
          latencyMs: Date.now() - startTime,
        };
      }
    },
  };
}
