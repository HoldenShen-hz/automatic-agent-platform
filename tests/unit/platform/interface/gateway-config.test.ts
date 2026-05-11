import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("gateway config has rate limit settings", () => {
  const config = JSON.parse(readFileSync("config/gateways/default.json", "utf8"));

  assert.ok("rateLimit" in config, "gateway config should have rateLimit");
  assert.equal(config.rateLimit.enabled, true);
  assert.equal(config.rateLimit.windowMs, 60000);
  assert.equal(config.rateLimit.maxRequests, 120);
});

test("gateway config has auth settings", () => {
  const config = JSON.parse(readFileSync("config/gateways/default.json", "utf8"));

  assert.ok("auth" in config, "gateway config should have auth");
  assert.equal(config.auth.required, true);
  assert.equal(config.auth.allowApiKey, true);
  assert.equal(config.auth.allowOidc, true);
});

test("gateway config has CORS settings", () => {
  const config = JSON.parse(readFileSync("config/gateways/default.json", "utf8"));

  assert.ok("cors" in config, "gateway config should have cors");
  assert.equal(config.cors.enabled, true);
  assert.deepEqual(config.cors.allowedOrigins, ["http://localhost:3000"]);
  assert.equal(config.cors.allowCredentials, true);
});

test("gateway config has TLS settings", () => {
  const config = JSON.parse(readFileSync("config/gateways/default.json", "utf8"));

  assert.ok("tls" in config, "gateway config should have tls");
  assert.equal(config.tls.enabled, true);
  assert.equal(config.tls.minVersion, "TLSv1.2");
  assert.ok(Array.isArray(config.tls.cipherSuites));
  assert.ok(config.tls.cipherSuites.length > 0);
  assert.equal(config.tls.requestCert, false);
  assert.equal(config.tls.rejectUnauthorized, true);
});