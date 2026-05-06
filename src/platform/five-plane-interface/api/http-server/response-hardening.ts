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
  allowedMethods: ["GET", "POST", "OPTIONS"],
  // R7-47 FIX: Add accept-version header for API version negotiation per §6.4
  allowedHeaders: ["content-type", "authorization", "x-request-id", "x-api-key", "accept-version"],
  // R7-43 FIX: Add x-trace-id to exposed headers so CORS callers can access correlation IDs per §6.2
  exposedHeaders: ["x-request-id", "x-api-version", "x-app-version", "x-trace-id"],
  maxAgeSeconds: 86_400,
  credentials: false,
};

// R12-29 fix: Enhanced CSP for API responses that also serves UI content
// - default-src 'self' allows same-origin requests
// - frame-ancestors 'none' prevents clickjacking
// - base-uri 'self' restricts base element to same origin
// - form-action 'self' restricts form submissions to same origin
// - script-src 'self' allows scripts from same origin
// - style-src 'self' allows styles from same origin
// - img-src 'self' data: allows images from same origin and data URIs
// - connect-src 'self' ws: wss: allows WebSocket connections
// - object-src 'none' prevents plugin-based content
const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:; object-src 'none'",
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
  return {
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
}

export function isOriginAllowed(origin: string | undefined, config: CorsConfig): boolean {
  if (typeof origin !== "string" || origin.trim().length === 0) {
    return false;
  }
  // R14-16: Wildcard origin is only allowed when credentials are disabled.
  // When credentials are enabled, we must never allow wildcard - it creates
  // the ["*"] + credentials:true security anti-pattern where credentials
  // are sent to any origin.
  if (config.allowedOrigins.includes("*")) {
    return !config.credentials;
  }
  return config.allowedOrigins.includes(origin.trim());
}

function resolveAllowOrigin(origin: string | undefined, config: CorsConfig): string | null {
  if (!isOriginAllowed(origin, config)) {
    return null;
  }
  // When credentials are enabled, we must never use wildcard origin.
  // Echo the validated origin back to the client.
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
  traceId: string | undefined,
): ApiResponsePayload {
  const headers: Record<string, string> = {
    ...DEFAULT_SECURITY_HEADERS,
    "x-api-version": payload.headers["x-api-version"] ?? "v1",
    "x-app-version": process.env["AA_BUILD_VERSION"] ?? "0.1.0",
    ...payload.headers,
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
    headers.vary = headers.vary != null && headers.vary.length > 0 ? `${headers.vary}, Origin` : "Origin";
  }
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
