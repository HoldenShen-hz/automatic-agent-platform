import { describe, it, mock, beforeEach } from "node:test";
import assert, { strictEqual, deepStrictEqual, throws, ok } from "node:assert";
import {
  CorsMiddleware,
  DEFAULT_CORS_CONFIG,
  validateCorsConfig,
  type CorsConfig,
} from "../../../../../../src/platform/interface/api/middleware/cors.js";

describe("CorsMiddleware", () => {
  describe("constructor", () => {
    it("should use default config when no config provided", () => {
      const middleware = new CorsMiddleware();
      strictEqual(middleware.isOriginAllowed("https://example.com"), false);
    });

    it("should merge provided config with defaults", () => {
      const middleware = new CorsMiddleware({ allowedOrigins: ["https://app.example.com"] });
      ok(middleware.isOriginAllowed("https://app.example.com"));
    });

    it("should throw error when wildcard origin used with credentials", () => {
      assert.throws(
        () =>
          new CorsMiddleware({
            allowedOrigins: ["*"],
            allowCredentials: true,
          }),
        /Wildcard origin/,
      );
    });

    it("should allow wildcard subdomain pattern with credentials", () => {
      const middleware = new CorsMiddleware({
        allowedOrigins: ["*.example.com"],
        allowCredentials: true,
      });
      ok(middleware.isOriginAllowed("app.example.com"));
      ok(middleware.isOriginAllowed("api.example.com"));
    });

    it("should allow wildcard origin without credentials", () => {
      const middleware = new CorsMiddleware({
        allowedOrigins: ["*"],
        allowCredentials: false,
      });
      ok(middleware.isOriginAllowed("https://any-origin.com"));
    });
  });

  describe("isOriginAllowed", () => {
    it("should return true for exact match origin", () => {
      const middleware = new CorsMiddleware({ allowedOrigins: ["https://app.example.com"] });
      ok(middleware.isOriginAllowed("https://app.example.com"));
    });

    it("should return false for non-matching origin", () => {
      const middleware = new CorsMiddleware({ allowedOrigins: ["https://app.example.com"] });
      strictEqual(middleware.isOriginAllowed("https://other.com"), false);
    });

    it("should return true for subdomain match with wildcard pattern", () => {
      const middleware = new CorsMiddleware({ allowedOrigins: ["*.example.com"] });
      ok(middleware.isOriginAllowed("app.example.com"));
    });

    it("should return false for non-subdomain with wildcard pattern", () => {
      const middleware = new CorsMiddleware({ allowedOrigins: ["*.example.com"] });
      strictEqual(middleware.isOriginAllowed("notexample.com"), false);
    });

    it("should return false when subdomain has intermediate parts", () => {
      const middleware = new CorsMiddleware({ allowedOrigins: ["*.example.com"] });
      strictEqual(middleware.isOriginAllowed("deep.app.example.com"), false);
    });

    it("should return true for multiple allowed origins", () => {
      const middleware = new CorsMiddleware({
        allowedOrigins: ["https://a.com", "https://b.com"],
      });
      ok(middleware.isOriginAllowed("https://a.com"));
      ok(middleware.isOriginAllowed("https://b.com"));
      strictEqual(middleware.isOriginAllowed("https://c.com"), false);
    });
  });

  describe("getHeaders", () => {
    it("should return CORS headers with allowed origin", () => {
      const middleware = new CorsMiddleware({
        allowedOrigins: ["https://app.example.com"],
      });
      const headers = middleware.getHeaders("https://app.example.com");
      deepStrictEqual(headers["Access-Control-Allow-Origin"], "https://app.example.com");
    });

    it("should not set Access-Control-Allow-Origin for null origin", () => {
      const middleware = new CorsMiddleware();
      const headers = middleware.getHeaders(null);
      strictEqual(headers["Access-Control-Allow-Origin"], undefined);
    });

    it("should include Access-Control-Allow-Credentials when enabled", () => {
      const middleware = new CorsMiddleware({ allowCredentials: true });
      const headers = middleware.getHeaders("https://example.com");
      strictEqual(headers["Access-Control-Allow-Credentials"], "true");
    });

    it("should expose X-Trace-Id header when enabled", () => {
      const middleware = new CorsMiddleware({ exposeTraceId: true });
      const headers = middleware.getHeaders("https://example.com");
      ok(headers["Access-Control-Expose-Headers"].includes("X-Trace-Id"));
    });

    it("should include allowed methods and headers", () => {
      const middleware = new CorsMiddleware();
      const headers = middleware.getHeaders("https://example.com");
      ok(headers["Access-Control-Allow-Methods"].includes("GET"));
      ok(headers["Access-Control-Allow-Headers"].includes("Content-Type"));
    });
  });

  describe("handlePreflight", () => {
    it("should return allowed=true with headers for allowed origin", () => {
      const middleware = new CorsMiddleware({
        allowedOrigins: ["https://app.example.com"],
      });
      const result = middleware.handlePreflight("https://app.example.com");
      strictEqual(result.allowed, true);
      ok(result.headers["Access-Control-Allow-Origin"]);
    });

    it("should return allowed=false for null origin", () => {
      const middleware = new CorsMiddleware();
      const result = middleware.handlePreflight(null);
      strictEqual(result.allowed, false);
    });

    it("should return allowed=false for non-allowed origin", () => {
      const middleware = new CorsMiddleware({
        allowedOrigins: ["https://app.example.com"],
      });
      const result = middleware.handlePreflight("https://other.com");
      strictEqual(result.allowed, false);
    });
  });
});

describe("validateCorsConfig", () => {
  it("should not throw for valid config without wildcard", () => {
    const config: CorsConfig = {
      allowedOrigins: ["https://a.com", "https://b.com"],
      allowedMethods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      allowCredentials: true,
      maxAgeSeconds: 3600,
      exposeTraceId: false,
    };
    validateCorsConfig(config);
  });

  it("should throw for wildcard origin with credentials", () => {
    const config: CorsConfig = {
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      allowCredentials: true,
      maxAgeSeconds: 3600,
      exposeTraceId: false,
    };
    assert.throws(() => validateCorsConfig(config), /Wildcard origin/);
  });

  it("should not throw for wildcard without credentials", () => {
    const config: CorsConfig = {
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      allowCredentials: false,
      maxAgeSeconds: 3600,
      exposeTraceId: false,
    };
    validateCorsConfig(config);
  });
});

describe("DEFAULT_CORS_CONFIG", () => {
  it("should have secure defaults", () => {
    strictEqual(DEFAULT_CORS_CONFIG.allowCredentials, true);
    strictEqual(DEFAULT_CORS_CONFIG.allowedOrigins.length, 0);
    strictEqual(DEFAULT_CORS_CONFIG.maxAgeSeconds, 3600);
    strictEqual(DEFAULT_CORS_CONFIG.exposeTraceId, true);
  });

  it("should include standard headers", () => {
    ok(DEFAULT_CORS_CONFIG.allowedHeaders.includes("Content-Type"));
    ok(DEFAULT_CORS_CONFIG.allowedHeaders.includes("Authorization"));
    ok(DEFAULT_CORS_CONFIG.allowedHeaders.includes("X-Idempotency-Key"));
  });

  it("should include common HTTP methods", () => {
    ok(DEFAULT_CORS_CONFIG.allowedMethods.includes("GET"));
    ok(DEFAULT_CORS_CONFIG.allowedMethods.includes("POST"));
    ok(DEFAULT_CORS_CONFIG.allowedMethods.includes("OPTIONS"));
  });
});
