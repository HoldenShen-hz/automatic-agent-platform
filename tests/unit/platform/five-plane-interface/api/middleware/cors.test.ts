import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CorsMiddleware,
  validateCorsConfig,
  DEFAULT_CORS_CONFIG,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/cors.js";

test("CorsMiddleware rejects wildcard origin with credentials", () => {
  assert.throws(
    () =>
      new CorsMiddleware({
        allowedOrigins: ["*"],
        allowCredentials: true,
      }),
    /Wildcard origin/,
  );
});

test("CorsMiddleware rejects *.* with credentials", () => {
  assert.throws(
    () =>
      new CorsMiddleware({
        allowedOrigins: ["*.*"],
        allowCredentials: true,
      }),
    /Wildcard origin/,
  );
});

test("CorsMiddleware accepts explicit origins with credentials", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["https://app.example.com", "https://admin.example.com"],
    allowCredentials: true,
  });
  assert.ok(middleware instanceof CorsMiddleware);
});

test("CorsMiddleware accepts wildcard without credentials", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["*"],
    allowCredentials: false,
  });
  assert.ok(middleware instanceof CorsMiddleware);
});

test("CorsMiddleware.isOriginAllowed returns true for exact match", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["https://app.example.com"],
  });
  assert.equal(middleware.isOriginAllowed("https://app.example.com"), true);
});

test("CorsMiddleware.isOriginAllowed returns false for non-match", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["https://app.example.com"],
  });
  assert.equal(middleware.isOriginAllowed("https://other.example.com"), false);
});

test("CorsMiddleware.isOriginAllowed matches subdomain wildcard pattern", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["*.example.com"],
  });
  assert.equal(middleware.isOriginAllowed("app.example.com"), true);
});

test("CorsMiddleware.getHeaders includes allow methods", () => {
  const middleware = new CorsMiddleware({});
  const headers = middleware.getHeaders("https://app.example.com");
  assert.ok(headers["Access-Control-Allow-Methods"]);
  assert.ok(headers["Access-Control-Allow-Methods"].includes("GET"));
  assert.ok(headers["Access-Control-Allow-Methods"].includes("POST"));
});

test("CorsMiddleware.getHeaders includes allow headers", () => {
  const middleware = new CorsMiddleware({});
  const headers = middleware.getHeaders("https://app.example.com");
  assert.ok(headers["Access-Control-Allow-Headers"]);
  assert.ok(headers["Access-Control-Allow-Headers"].includes("Content-Type"));
});

test("CorsMiddleware.getHeaders sets credentials when enabled", () => {
  const middleware = new CorsMiddleware({
    allowCredentials: true,
    allowedOrigins: ["https://app.example.com"],
  });
  const headers = middleware.getHeaders("https://app.example.com");
  assert.equal(headers["Access-Control-Allow-Credentials"], "true");
});

test("CorsMiddleware.getHeaders exposes trace ID when enabled", () => {
  const middleware = new CorsMiddleware({
    exposeTraceId: true,
    allowedOrigins: ["https://app.example.com"],
  });
  const headers = middleware.getHeaders("https://app.example.com");
  assert.ok(headers["Access-Control-Expose-Headers"]);
  assert.ok(headers["Access-Control-Expose-Headers"].includes("X-Trace-Id"));
});

test("CorsMiddleware.getHeaders sets max age", () => {
  const middleware = new CorsMiddleware({
    maxAgeSeconds: 7200,
    allowedOrigins: ["https://app.example.com"],
  });
  const headers = middleware.getHeaders("https://app.example.com");
  assert.equal(headers["Access-Control-Max-Age"], "7200");
});

test("CorsMiddleware.handlePreflight returns not allowed for null origin", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["https://app.example.com"],
  });
  const result = middleware.handlePreflight(null);
  assert.equal(result.allowed, false);
});

test("CorsMiddleware.handlePreflight returns not allowed for disallowed origin", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["https://app.example.com"],
  });
  const result = middleware.handlePreflight("https://other.example.com");
  assert.equal(result.allowed, false);
});

test("CorsMiddleware.handlePreflight returns allowed for valid origin", () => {
  const middleware = new CorsMiddleware({
    allowedOrigins: ["https://app.example.com"],
  });
  const result = middleware.handlePreflight("https://app.example.com");
  assert.equal(result.allowed, true);
  assert.ok(result.headers["Access-Control-Allow-Origin"]);
});

test("validateCorsConfig throws for wildcard with credentials", () => {
  assert.throws(
    () =>
      validateCorsConfig({
        allowedOrigins: ["*"],
        allowCredentials: true,
        allowedMethods: ["GET"],
        allowedHeaders: [],
        maxAgeSeconds: 3600,
        exposeTraceId: false,
      }),
    /Wildcard origin/,
  );
});

test("DEFAULT_CORS_CONFIG has secure defaults", () => {
  assert.equal(DEFAULT_CORS_CONFIG.allowedOrigins.length, 0);
  assert.equal(DEFAULT_CORS_CONFIG.allowCredentials, true);
});