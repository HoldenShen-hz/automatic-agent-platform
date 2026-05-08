import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const repoRoot = "/Users/holden/Project/automatic_agent/automatic_agent_platform";

function readJson(path: string): Record<string, unknown> {
  return Function(`"use strict"; return (${readFileSync(path, "utf8")});`)() as Record<string, unknown>;
}

test("runtime default config includes configVersion for version tracking", () => {
  const runtimeConfig = readJson(`${repoRoot}/config/runtime/default.json`);
  assert.equal(typeof runtimeConfig["configVersion"], "string");
  assert.ok(String(runtimeConfig["configVersion"]).length > 0);
  assert.equal(typeof runtimeConfig["configSchemaVersion"], "string");
  assert.equal(runtimeConfig["retryMax"], 3);
  assert.equal(typeof runtimeConfig["circuitBreaker"], "object");
  assert.equal((runtimeConfig["circuitBreaker"] as Record<string, unknown>)["threshold"], 5);
  assert.equal(typeof runtimeConfig["rateLimit"], "object");
  assert.equal((runtimeConfig["rateLimit"] as Record<string, unknown>)["requestsPerMinute"], 120);
  assert.equal(typeof runtimeConfig["configDriftReconciler"], "object");
  assert.equal((runtimeConfig["configDriftReconciler"] as Record<string, unknown>)["interval"], 300000);
});

test("gateway default config includes rate limit, cors, auth, and request limits", () => {
  const gatewayConfig = readJson(`${repoRoot}/config/gateways/default.json`);
  assert.equal(gatewayConfig["timeout"], 30000);
  assert.equal(typeof gatewayConfig["circuitBreaker"], "object");
  assert.equal((gatewayConfig["circuitBreaker"] as Record<string, unknown>)["fallbackMode"], "fail_closed");
  assert.equal(typeof gatewayConfig["rateLimit"], "object");
  assert.equal(typeof gatewayConfig["cors"], "object");
  assert.equal(typeof gatewayConfig["auth"], "object");
  assert.equal(typeof gatewayConfig["websocket"], "object");
  assert.equal((gatewayConfig["websocket"] as Record<string, unknown>)["heartbeatIntervalMs"], 30000);
  assert.equal(typeof gatewayConfig["requestLimits"], "object");
});

test("bootstrap default config includes dependency order, readiness gates, and degradation policy", () => {
  const bootstrapConfig = readJson(`${repoRoot}/config/bootstrap/default.json`);
  assert.equal(bootstrapConfig["phase"], "ring_1");
  assert.ok(Array.isArray(bootstrapConfig["dependencyOrder"]));
  assert.ok(Array.isArray(bootstrapConfig["readinessGates"]));
  assert.equal(typeof bootstrapConfig["degradationPolicy"], "object");
  assert.equal(typeof bootstrapConfig["healthCheckTimeoutMs"], "number");
  assert.equal(typeof bootstrapConfig["readinessProbe"], "object");
  assert.equal((bootstrapConfig["readinessProbe"] as Record<string, unknown>)["timeoutMs"], 3000);
});

test("operations output schema uses the shared 2020-12 JSON Schema baseline", () => {
  const operationsOutputSchema = readJson(`${repoRoot}/divisions/operations/schemas/ops-output.json`);
  assert.equal(operationsOutputSchema["$schema"], "https://json-schema.org/draft/2020-12/schema");
});

test("coding domain default status is active", () => {
  const domainsConfig = readJson(`${repoRoot}/config/domains/default.json`);
  const codingDomain = ((domainsConfig["domains"] as Array<Record<string, unknown>> | undefined) ?? [])
    .find((domain) => domain["domainId"] === "coding");
  assert.ok(codingDomain !== undefined);
  assert.equal(codingDomain["status"], "active");
});
