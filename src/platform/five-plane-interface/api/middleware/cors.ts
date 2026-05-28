import { SECONDS_PER_HOUR } from "../../../contracts/constants/time.js";
import { ValidationError } from "../../../contracts/errors.js";
import {
  buildPreflightHeaders,
  isOriginAllowed as isOriginAllowedForResponseHardening,
  normalizeCorsConfig,
  type CorsConfig as ResponseHardeningCorsConfig,
} from "../http-server/response-hardening.js";

/**
 * CORS Middleware
 *
 * Implements secure CORS handling per §9.2.
 * Fixes insecure defaults:拒绝了 ["*"] + credentials:true security anti-pattern.
 */

export interface CorsConfig {
  /** Allowed origins - must NOT be wildcard when credentials enabled */
  allowedOrigins: readonly string[];
  /** Allowed HTTP methods */
  allowedMethods: readonly string[];
  /** Allowed HTTP headers */
  allowedHeaders: readonly string[];
  /** Whether to allow credentials */
  allowCredentials: boolean;
  /** Max age in seconds for preflight cache */
  maxAgeSeconds: number;
  /** Whether to expose X-Trace-Id header */
  exposeTraceId: boolean;
}

/**
 * Default secure CORS configuration per §9.2.
 * Note: Does NOT use wildcard origins - credentials require explicit origin list.
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [], // Must be explicitly configured - no wildcards
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Trace-Id", "X-Idempotency-Key", "X-Tenant-Id"],
  allowCredentials: false,
  maxAgeSeconds: SECONDS_PER_HOUR,
  exposeTraceId: true,
};

function validateCorsConfigInternal(config: CorsConfig): void {
  const hasWildcard = config.allowedOrigins.some(
    (origin) => origin === "*" || origin === "*.*",
  );
  if (hasWildcard && config.allowCredentials) {
    throw new ValidationError(
      "cors.security_wildcard_credentials_forbidden",
      "cors.security: Wildcard origin '*' is not allowed when credentials are enabled. Specify explicit origins.",
    );
  }
  for (const origin of config.allowedOrigins) {
    if (origin === "*" || origin === "*.*") {
      continue;
    }
    if (/[\u0000-\u001f\u007f]/u.test(origin)) {
      throw new ValidationError(
        "cors.invalid_origin",
        `cors.security: Invalid origin '${origin}'. Use explicit http(s) origins only.`,
        { field: "allowedOrigins" },
      );
    }
    if (origin === "null" || origin.startsWith("*.")) {
      throw new ValidationError(
        "cors.invalid_origin",
        `cors.security: Invalid origin '${origin}'. Use explicit http(s) origins only.`,
        { field: "allowedOrigins" },
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ValidationError(
        "cors.invalid_origin",
        `cors.security: Invalid origin '${origin}'. Use explicit http(s) origins only.`,
        { field: "allowedOrigins" },
      );
    }
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.origin !== origin) {
      throw new ValidationError(
        "cors.invalid_origin",
        `cors.security: Invalid origin '${origin}'. Use explicit http(s) origins only.`,
        { field: "allowedOrigins" },
      );
    }
  }
}

/**
 * CORS middleware that enforces secure CORS policy.
 * Rejects insecure configurations (wildcard origin with credentials).
 */
export class CorsMiddleware {
  private readonly config: CorsConfig;
  private readonly normalizedConfig: ResponseHardeningCorsConfig;

  public constructor(config: Partial<CorsConfig> = {}) {
    this.config = CorsMiddleware.resolveConfig(config);
    this.normalizedConfig = normalizeCorsConfig({
      allowedOrigins: [...this.config.allowedOrigins],
      allowedMethods: [...this.config.allowedMethods],
      allowedHeaders: this.config.allowedHeaders.map((header) => header.toLowerCase()),
      exposedHeaders: this.config.exposeTraceId ? ["x-trace-id"] : [],
      maxAgeSeconds: this.config.maxAgeSeconds,
      credentials: this.config.allowCredentials,
    });
  }

  private static resolveConfig(config: Partial<CorsConfig>): CorsConfig {
    const resolved = { ...DEFAULT_CORS_CONFIG, ...config };
    validateCorsConfigInternal(resolved);
    return resolved;
  }

  /**
   * Check if origin is allowed.
   */
  public isOriginAllowed(origin: string): boolean {
    return isOriginAllowedForResponseHardening(origin, this.normalizedConfig);
  }

  /**
   * Generate CORS headers for request.
   */
  public getHeaders(origin: string | null): Record<string, string> {
    const preflight = buildPreflightHeaders(origin ?? undefined, this.normalizedConfig);
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": preflight["access-control-allow-methods"] ?? this.config.allowedMethods.join(", "),
      "Access-Control-Allow-Headers": preflight["access-control-allow-headers"] ?? this.config.allowedHeaders.join(", "),
      "Access-Control-Max-Age": preflight["access-control-max-age"] ?? String(this.config.maxAgeSeconds),
      Vary: preflight.vary ?? "Origin",
    };
    if (preflight["access-control-allow-credentials"] != null) {
      headers["Access-Control-Allow-Credentials"] = preflight["access-control-allow-credentials"];
    }
    if (this.config.exposeTraceId) {
      headers["Access-Control-Expose-Headers"] = "X-Trace-Id";
    }
    if (preflight["access-control-allow-origin"] != null) {
      headers["Access-Control-Allow-Origin"] = preflight["access-control-allow-origin"];
    }
    return headers;
  }

  /**
   * Handle CORS preflight request.
   */
  public handlePreflight(requestOrigin: string | null): {
    allowed: boolean;
    headers: Record<string, string>;
  } {
    if (requestOrigin == null) {
      return { allowed: false, headers: {} };
    }

    if (!this.isOriginAllowed(requestOrigin)) {
      return { allowed: false, headers: {} };
    }

    return {
      allowed: true,
      headers: this.getHeaders(requestOrigin),
    };
  }
}

/**
 * ValidateOriginList validates that origins don't mix wildcards with credentials.
 */
export function validateCorsConfig(config: CorsConfig): void {
  validateCorsConfigInternal(config);
}
