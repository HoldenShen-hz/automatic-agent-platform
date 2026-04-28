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
  allowCredentials: true,
  maxAgeSeconds: 3600,
  exposeTraceId: true,
};

/**
 * CORS middleware that enforces secure CORS policy.
 * Rejects insecure configurations (wildcard origin with credentials).
 */
export class CorsMiddleware {
  private readonly config: CorsConfig;

  public constructor(config: Partial<CorsConfig> = {}) {
    this.config = { ...DEFAULT_CORS_CONFIG, ...config };
    this.validateConfig();
  }

  /**
   * Validate CORS configuration for security.
   */
  private validateConfig(): void {
    const hasWildcard = this.config.allowedOrigins.some((origin) => origin === "*" || origin === "*.*");
    if (hasWildcard && this.config.allowCredentials) {
      throw new Error("cors.security: Wildcard origin '*' is not allowed when credentials are enabled. Specify explicit origins.");
    }
  }

  /**
   * Check if origin is allowed.
   */
  public isOriginAllowed(origin: string): boolean {
    return this.config.allowedOrigins.some(
      (allowed) => allowed === "*" || allowed === origin || this.matchSubdomain(origin, allowed),
    );
  }

  /**
   * Match subdomain pattern (e.g., *.example.com matches app.example.com).
   */
  private matchSubdomain(origin: string, pattern: string): boolean {
    if (!pattern.startsWith("*.")) {
      return false;
    }
    const domain = pattern.slice(2);
    return origin.endsWith(domain) && origin.slice(0, -domain.length).indexOf(".") === -1;
  }

  /**
   * Generate CORS headers for request.
   */
  public getHeaders(origin: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": this.config.allowedMethods.join(", "),
      "Access-Control-Allow-Headers": this.config.allowedHeaders.join(", "),
      "Access-Control-Max-Age": String(this.config.maxAgeSeconds),
    };

    if (this.config.allowCredentials) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }

    if (this.config.exposeTraceId) {
      headers["Access-Control-Expose-Headers"] = "X-Trace-Id";
    }

    // Only set allowed origin if it matches (not wildcard)
    if (origin != null && this.isOriginAllowed(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
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
  const hasWildcard = config.allowedOrigins.some((origin) => origin === "*" || origin === "*.*");
  if (hasWildcard && config.allowCredentials) {
    throw new Error("cors.security: Wildcard origin '*' is not allowed when credentials are enabled");
  }
}