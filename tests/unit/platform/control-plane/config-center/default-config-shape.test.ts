import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const repoRoot = "/Users/holden/Project/automatic_agent/automatic_agent_platform";

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

test("runtime default config includes configVersion for version tracking", () => {
  const runtimeConfig = readJson(`${repoRoot}/config/runtime/default.json`);
  assert.equal(typeof runtimeConfig["configVersion"], "string");
  assert.ok(String(runtimeConfig["configVersion"]).length > 0);
});

test("gateway default config includes rate limit, cors, auth, and request limits", () => {
  const gatewayConfig = readJson(`${repoRoot}/config/gateways/default.json`);
  assert.equal(typeof gatewayConfig["rateLimit"], "object");
  assert.equal(typeof gatewayConfig["cors"], "object");
  assert.equal(typeof gatewayConfig["auth"], "object");
  assert.equal(typeof gatewayConfig["requestLimits"], "object");
});

test("bootstrap default config includes dependency order, readiness gates, and degradation policy", () => {
  const bootstrapConfig = readJson(`${repoRoot}/config/bootstrap/default.json`);
  assert.ok(Array.isArray(bootstrapConfig["dependencyOrder"]));
  assert.ok(Array.isArray(bootstrapConfig["readinessGates"]));
  assert.equal(typeof bootstrapConfig["degradationPolicy"], "object");
  assert.equal(typeof bootstrapConfig["healthCheckTimeoutMs"], "number");
});
