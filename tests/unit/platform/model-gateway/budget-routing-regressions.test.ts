import assert from "node:assert/strict";
import test from "node:test";

import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetExecutionSessionManager } from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { CircuitBreaker } from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";
import { ModelRoutingService } from "../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";

test("budget execution session manager enforces reserve-execute-settle lifecycle", () => {
  const manager = new BudgetExecutionSessionManager();
  const session = manager.reserveAndCreateSession(
    {
      tenantId: "tenant-1",
      harnessRunId: "hrn_test_1",
      traceId: "trace-1",
      emittedBy: "test",
      ledger: createBudgetLedger({
        tenantId: "tenant-1",
        harnessRunId: "hrn_test_1",
        currency: "USD",
        hardCap: 100,
        softCap: 80,
      }),
      policy: {
        maxTaskCostUsd: 100,
        maxPackCostUsd: 100,
        maxPlatformCostUsd: 1000,
        maxDailyCostUsd: 1000,
        maxMonthlyCostUsd: 5000,
        maxModelTokens: 10_000,
        maxSteps: 20,
        maxDurationMs: 60_000,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
    },
    12.5,
  );

  assert.equal(session.state, "reserved");
  const executing = manager.markExecuting(session.sessionId);
  assert.equal(executing.state, "executing");
  const settledLedger = manager.settle(session.sessionId, 11.25);
  assert.equal(settledLedger.version > session.ledger.version, true);
  assert.equal(manager.getSession(session.sessionId)?.state, "settled");
});

test("model routing persists latency and residency evidence for the final decision", () => {
  const persisted: unknown[] = [];
  const service = new ModelRoutingService({
    registry: {
      version: "test",
      profiles: {
        "balanced-eu": {
          provider: "provider-a",
          modelId: "model-balanced-eu",
          tier: "balanced",
          capabilities: ["function_calling"],
          contextWindowTokens: 128000,
          maxOutputTokens: 8192,
          pricing: { inputPer1kUsd: 0.2, outputPer1kUsd: 0.4 },
          metadataSource: "bundled_snapshot",
          latencyP99Ms: 3200,
          region: "eu-west-1",
        },
      },
      providers: {
        "provider-a": {
          status: "active",
          authMethods: ["api_key"],
          region: "eu-west-1",
          latencyP99Ms: 3300,
        },
      },
    } as never,
    persistence: {
      persistRoutingDecision(decision) {
        persisted.push(decision);
      },
    },
  });

  const decision = service.route({
    routeClass: "classification",
    riskLevel: "high",
    requiredCapabilities: ["function_calling"],
    data_residency: "eu-west-1",
  });

  assert.equal(decision.profileName, "balanced-eu");
  assert.equal(persisted.length, 1);
  const record = persisted[0] as Record<string, unknown>;
  assert.equal(record.dataResidencyMet, true);
  assert.equal(record.latencySloTargetMs, 1500);
  assert.equal(record.latencyP99Ms, 3200);
});

test("model routing enforces residency, pii, training opt-out, judge independence and latency SLO constraints", () => {
  const service = new ModelRoutingService({
    registry: {
      version: "test",
      profiles: {
        "fast-us": {
          provider: "provider-fast-us",
          modelId: "model-fast-us",
          tier: "fast",
          capabilities: ["function_calling"],
          contextWindowTokens: 64000,
          maxOutputTokens: 4096,
          pricing: { inputPer1kUsd: 0.05, outputPer1kUsd: 0.1 },
          metadataSource: "bundled_snapshot",
          latencyP99Ms: 900,
          region: "us-east-1",
          piiSafe: true,
          trainingOptOutSupported: true,
          judgeIndependent: true,
        },
        "fast-eu-unsafe": {
          provider: "provider-fast-eu",
          modelId: "model-fast-eu-unsafe",
          tier: "fast",
          capabilities: ["function_calling"],
          contextWindowTokens: 64000,
          maxOutputTokens: 4096,
          pricing: { inputPer1kUsd: 0.03, outputPer1kUsd: 0.06 },
          metadataSource: "bundled_snapshot",
          latencyP99Ms: 850,
          region: "eu-west-1",
          piiSafe: false,
          trainingOptOutSupported: false,
          judgeIndependent: false,
        },
        "balanced-eu-safe": {
          provider: "provider-balanced-eu",
          modelId: "model-balanced-eu-safe",
          tier: "balanced",
          capabilities: ["function_calling"],
          contextWindowTokens: 128000,
          maxOutputTokens: 8192,
          pricing: { inputPer1kUsd: 0.12, outputPer1kUsd: 0.24 },
          metadataSource: "bundled_snapshot",
          latencyP99Ms: 1800,
          region: "eu-west-1",
          piiSafe: true,
          trainingOptOutSupported: true,
          judgeIndependent: true,
        },
      },
      providers: {
        "provider-fast-us": {
          status: "active",
          authMethods: ["api_key"],
          region: "us-east-1",
          latencyP99Ms: 900,
        },
        "provider-fast-eu": {
          status: "active",
          authMethods: ["api_key"],
          region: "eu-west-1",
          latencyP99Ms: 850,
        },
        "provider-balanced-eu": {
          status: "active",
          authMethods: ["api_key"],
          region: "eu-west-1",
          latencyP99Ms: 1800,
        },
      },
    } as never,
  });

  const decision = service.route({
    routeClass: "classification",
    riskLevel: "medium",
    requiredCapabilities: ["function_calling"],
    data_residency: "eu-west-1",
    pii_input_detected: true,
    model_training_opt_out: true,
    judge_independence: true,
  });

  assert.equal(decision.profileName, "balanced-eu-safe");
});

test("circuit breaker failure rate uses failures over total requests", () => {
  const breaker = new CircuitBreaker({
    name: "provider-a",
    failureThreshold: 99,
    minSampleSize: 10,
  });

  for (let index = 0; index < 5; index += 1) {
    breaker.onFailure();
  }
  for (let index = 0; index < 4; index += 1) {
    breaker.onSuccess();
  }
  breaker.onFailure();

  assert.equal(breaker.getState(), "open");
});
