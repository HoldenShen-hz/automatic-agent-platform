import type { ApiResponsePayload } from "./types.js";

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAgeSeconds: number;
  credentials: boolean;
}

export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [],
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "authorization", "x-request-id", "x-api-key"],
  exposedHeaders: ["x-request-id", "x-trace-id", "x-api-version", "x-app-version", "x-build-commit"],
  maxAgeSeconds: 86_400,
  credentials: false,
};

const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-resource-policy": "same-origin",
});

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [...DEFAULT_CORS_CONFIG.allowedOrigins];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function normalizeCorsConfig(config: Partial<CorsConfig> | null | undefined): CorsConfig {
  const normalized: CorsConfig = {
    allowedOrigins: config?.allowedOrigins != null && config.allowedOrigins.length > 0
      ? [...config.allowedOrigins]
      : [...DEFAULT_CORS_CONFIG.allowedOrigins],
    allowedMethods: config?.allowedMethods != null && config.allowedMethods.length > 0
      ? [...config.allowedMethods]
      : [...DEFAULT_CORS_CONFIG.allowedMethods],
    allowedHeaders: config?.allowedHeaders != null && config.allowedHeaders.length > 0
      ? config.allowedHeaders.map((header) => header.toLowerCase())
      : [...DEFAULT_CORS_CONFIG.allowedHeaders],
    exposedHeaders: config?.exposedHeaders != null && config.exposedHeaders.length > 0
      ? [...config.exposedHeaders]
      : [...DEFAULT_CORS_CONFIG.exposedHeaders],
    maxAgeSeconds: config?.maxAgeSeconds ?? DEFAULT_CORS_CONFIG.maxAgeSeconds,
    credentials: config?.credentials ?? DEFAULT_CORS_CONFIG.credentials,
  };
  if (normalized.credentials && normalized.allowedOrigins.includes("*")) {
    throw new Error("api.cors.invalid_wildcard_credentials");
  }
  return normalized;
}

export function isOriginAllowed(origin: string | undefined, config: CorsConfig): boolean {
  if (typeof origin !== "string" || origin.trim().length === 0) {
    return false;
  }
  if (config.allowedOrigins.includes("*")) {
    // Wildcard origin is never allowed when credentials are enabled (security violation)
    if (config.credentials) {
      return false;
    }
    return true;
  }
  return config.allowedOrigins.includes(origin.trim());
}

function resolveAllowOrigin(origin: string | undefined, config: CorsConfig): string | null {
  if (!isOriginAllowed(origin, config)) {
    return null;
  }
  if (config.allowedOrigins.includes("*")) {
    return "*";
  }
  return origin!.trim();
}

export function buildPreflightHeaders(origin: string | undefined, config: CorsConfig): Record<string, string> {
  const allowOrigin = resolveAllowOrigin(origin, config);
  const headers: Record<string, string> = {};
  if (allowOrigin == null) {
    return headers;
  }
  headers["access-control-allow-origin"] = allowOrigin;
  headers["access-control-allow-methods"] = config.allowedMethods.join(", ");
  headers["access-control-allow-headers"] = config.allowedHeaders.join(", ");
  headers["access-control-max-age"] = String(config.maxAgeSeconds);
  if (config.credentials) {
    headers["access-control-allow-credentials"] = "true";
  }
  headers.vary = "Origin";
  return headers;
}

export function decorateResponseHeaders(
  payload: ApiResponsePayload,
  origin: string | undefined,
  corsConfig: CorsConfig,
): ApiResponsePayload {
  const traceId = payload.headers["x-trace-id"]
    ?? payload.headers["x-correlation-id"]
    ?? payload.headers["x-request-id"];
  const headers: Record<string, string> = {
    ...payload.headers,
    ...DEFAULT_SECURITY_HEADERS,
    "x-api-version": payload.headers["x-api-version"] ?? "v1",
    "x-app-version": process.env["AA_BUILD_VERSION"] ?? "0.1.0",
    ...(process.env["AA_BUILD_COMMIT"] != null ? { "x-build-commit": process.env["AA_BUILD_COMMIT"] } : {}),
    "cache-control": payload.headers["cache-control"] ?? "private, no-store, max-age=0",
    pragma: payload.headers.pragma ?? "no-cache",
    ...(traceId != null ? { "x-trace-id": traceId } : {}),
  };
  const allowOrigin = resolveAllowOrigin(origin, corsConfig);
  if (allowOrigin != null) {
    headers["access-control-allow-origin"] = allowOrigin;
    if (corsConfig.credentials) {
      headers["access-control-allow-credentials"] = "true";
    }
    if (corsConfig.exposedHeaders.length > 0) {
      headers["access-control-expose-headers"] = corsConfig.exposedHeaders.join(", ");
    }
    headers.vary = appendVaryHeader(headers.vary, "Origin");
  }
  headers.vary = appendVaryHeader(headers.vary, "Accept-Encoding");
  if (
    headers["content-length"] == null
    && headers["content-encoding"] == null
    && headers["transfer-encoding"] == null
  ) {
    headers["content-length"] = Buffer.byteLength(payload.body, "utf8").toString();
  }
  return {
    ...payload,
    headers,
  };
}

function appendVaryHeader(existing: string | undefined, nextValue: string): string {
  const values = (existing ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (!values.includes(nextValue)) {
    values.push(nextValue);
  }
  return values.join(", ");
}
