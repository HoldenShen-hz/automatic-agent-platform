import { ValidationError } from "../../platform/contracts/errors.js";

export interface ApiClientConfig {
  baseUrl: string;
  apiVersion: string;
  tenantId?: string;
  bearerToken?: string;
}

export interface ApiRequestSpec {
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export function buildApiUrl(config: ApiClientConfig, request: ApiRequestSpec): string {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const apiVersion = config.apiVersion.replace(/^\/+|\/+$/g, "");
  const path = request.path.replace(/^\/+/, "");
  const url = new URL(`${baseUrl}/${apiVersion}/${path}`);

  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
  if (config.tenantId?.trim()) {
    url.searchParams.set("tenantId", config.tenantId.trim());
  }
  return url.toString();
}

export function buildAuthHeaders(config: ApiClientConfig): Record<string, string> {
  if (!config.bearerToken?.trim()) {
    throw new ValidationError("client_sdk.missing_bearer_token", "Client SDK requests require a bearer token.");
  }
  return {
    authorization: `Bearer ${config.bearerToken.trim()}`,
  };
}
