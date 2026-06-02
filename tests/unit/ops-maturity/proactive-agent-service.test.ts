import assert from "node:assert/strict";
import test from "node:test";

import { BehaviorFingerprintBuilder } from "../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";
import { DriftDetectorService } from "../../../src/ops-maturity/drift-detection/drift-detector-service.js";
import { CapacityPlanningService } from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { TimeTravelDebugService } from "../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import { putExplanationCacheEntry } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
import { OpsCapacityPredictorService } from "../../../src/ops-maturity/platform-ops-agent/capacity-predictor/index.js";

function isoOffsetFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

test("fingerprint builder produces deterministic ids, UTC windows, and stable hashes", () => {
  const builder = new BehaviorFingerprintBuilder(() => new Date("2026-05-20T12:00:00.000Z"));
  const first = builder.build({
    agentId: "agent-1",
    subjectType: "workflow",
    baselineRef: "baseline-a",
    tools: ["b", "a"],
    failureCategories: ["timeout"],
    averageLatencyMs: 200,
    averageCostUsd: 1,
    windowPreset: "24h",
    toolUsageDistribution: { z: 2, a: 1 },
    riskDistribution: { critical: 0, high: 1, low: 0, medium: 2 },
  });
  const second = builder.build({
    agentId: "agent-1",
    subjectType: "workflow",
    baselineRef: "baseline-a",
    tools: ["a", "b"],
    failureCategories: ["timeout"],
    averageLatencyMs: 200,
    averageCostUsd: 1,
    windowPreset: "24h",
    toolUsageDistribution: { a: 1, z: 2 },
    riskDistribution: { low: 0, medium: 2, high: 1, critical: 0 },
  });

  assert.equal(first.hash, second.hash);
  assert.equal(first.fingerprintId, "fingerprint:workflow:agent-1:baseline-a:24h");
  assert.equal(first.windowStart, "2026-05-19T12:00:00.000Z");
  assert.equal(first.windowEnd, "2026-05-20T12:00:00.000Z");
});

test("drift detector uses configurable thresholds, real baseline spans, and missing-feature fail-close", () => {
  const builder = new BehaviorFingerprintBuilder(() => new Date("2026-05-20T12:00:00.000Z"));
  const current = builder.build({
    agentId: "agent-1",
    tools: ["tool-a", "tool-b"],
    failureCategories: ["timeout"],
    averageLatencyMs: 1000,
    averageCostUsd: 1,
    windowPreset: "30d",
  });
  const baseline = builder.build({
    agentId: "agent-1",
    tools: [],
    failureCategories: [],
    averageLatencyMs: 100,
    averageCostUsd: 0.1,
    windowPreset: "7d",
  });

  const service = new DriftDetectorService({
    fingerprintDriftThresholds: { low: 0.01, medium: 0.02, high: 0.03 },
  });
  const drift = service.detectFingerprintDrift(current, baseline);
  assert.ok(drift != null);
  assert.equal(drift?.windowType, "30d");

  const missingFeatureDrift = service.detectFingerprintDrift({
    ...current,
    normalizedFeatures: [],
    hash: "changed",
  }, baseline);
  assert.equal(missingFeatureDrift?.reasonCode, "drift.fingerprint_features_missing");

  const detectResult = service.detect({
    currentFingerprint: current,
    baselineFingerprints: [baseline],
    driftSamples: [
      { observedAt: "2026-05-20T08:00:00.000Z", score: 0.4 },
      { observedAt: "2026-05-20T09:00:00.000Z", score: 0.5 },
      { observedAt: "2026-05-20T10:00:00.000Z", score: 0.7 },
    ],
  });
  assert.ok(detectResult.metadata.windowsAnalyzed.length > 0);
  assert.equal(detectResult.metadata.baselineWindowDays >= 7, true);

  const fingerprintOnlyResult = service.detect({
    currentFingerprint: current,
    baselineFingerprints: [baseline],
    driftSamples: [],
  });
  assert.equal(fingerprintOnlyResult.driftDetected, true);
  assert.ok(fingerprintOnlyResult.primarySignal != null);
});

test("drift detector scores feature drift by union size instead of raw difference count", () => {
  const service = new DriftDetectorService({
    fingerprintDriftThresholds: { low: 0.05, medium: 0.15, high: 0.5 },
  });
  const baseline = {
    fingerprintId: "fingerprint:agent:baseline",
    subjectType: "agent" as const,
    subjectId: "agent-1",
    generatedAt: "2026-05-20T00:00:00.000Z",
    hash: "baseline-hash",
    normalizedFeatures: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    window: "7d" as const,
    windowStart: "2026-05-13T00:00:00.000Z",
    windowEnd: "2026-05-20T00:00:00.000Z",
  };
  const current = {
    ...baseline,
    fingerprintId: "fingerprint:agent:current",
    hash: "current-hash",
    normalizedFeatures: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "z"],
  };

  const drift = service.detectFingerprintDrift(current, baseline);

  assert.ok(drift != null);
  assert.equal(drift.severity, "medium");
  assert.ok(Math.abs(drift.driftScore - 0.1818181818) < 0.0001);
});

test("drift detector accepts the closest matching baseline instead of hard-wiring the first baseline", () => {
  const service = new DriftDetectorService({
    fingerprintDriftThresholds: { low: 0.01, medium: 0.02, high: 0.03 },
  });
  const current = {
    fingerprintId: "fingerprint:agent:current",
    subjectType: "agent" as const,
    subjectId: "agent-1",
    generatedAt: "2026-05-20T00:00:00.000Z",
    hash: "stable-hash",
    normalizedFeatures: ["tool_usage:a"],
    window: "7d" as const,
    windowStart: "2026-05-13T00:00:00.000Z",
    windowEnd: "2026-05-20T00:00:00.000Z",
  };
  const mismatchedBaseline = {
    ...current,
    fingerprintId: "fingerprint:agent:baseline-1",
    hash: "mismatch-hash",
    normalizedFeatures: ["tool_usage:b"],
  };
  const matchingBaseline = {
    ...current,
    fingerprintId: "fingerprint:agent:baseline-2",
  };

  const result = service.detect({
    currentFingerprint: current,
    baselineFingerprints: [mismatchedBaseline, matchingBaseline],
    driftSamples: [],
  });

  assert.equal(result.driftDetected, false);
  assert.equal(result.primarySignal, null);
});

test("capacity planning normalizes quota pressure, queue delay, scenario ordering, and zero-sample growth fallback", () => {
  const service = new CapacityPlanningService({
    queueDepthToDelayMs: 25,
    providerQuotaLimits: { workers: 500 },
  });
  service.recordSignal({ resourceType: "workers", timestamp: "2026-05-20T00:00:00.000Z", usage: 100, queueDepth: 10 });
  service.recordSignal({ resourceType: "workers", timestamp: "2026-05-20T01:00:00.000Z", usage: 130, queueDepth: 12 });
  service.recordSignal({ resourceType: "workers", timestamp: "2026-05-20T02:00:00.000Z", usage: 170, queueDepth: 15 });

  const forecast = service.forecast("workers", 2, {
    start: "2026-05-20T00:00:00.000Z",
    end: "2026-05-20T02:00:00.000Z",
  });
  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 1,
    targetHeadroomPercent: 20,
    latestQueueDepth: 20,
    maxQueueDepth: 10,
  });
  assert.equal(recommendation.queueDelayRiskMs, 500);
  assert.equal(recommendation.providerQuotaPressure <= 1, true);
  assert.equal(recommendation.slaTier, "bronze");

  const scenarios = service.compareScenarios([
    { scenarioId: "a", label: "a", baselineUnits: 100, growthPercent: 10, optimizationPercent: 0 },
    { scenarioId: "b", label: "b", baselineUnits: 100, growthPercent: 10, optimizationPercent: 20 },
  ]);
  assert.equal(scenarios[0]?.projectedUnits >= scenarios[1]?.projectedUnits!, true);

  const singleSampleService = new CapacityPlanningService();
  singleSampleService.recordSignal({ resourceType: "memory", timestamp: "2026-05-20T00:00:00.000Z", usage: 200 });
  const singleForecast = singleSampleService.forecast("memory", 2, {
    start: "2026-05-20T00:00:00.000Z",
    end: "2026-05-20T00:00:00.000Z",
  });
  assert.deepEqual(singleForecast.projectedUsage, [200, 200]);

  const comparison = service.compareForecastToActual({
    forecast,
    actualUsage: forecast.projectedUsage[0]!,
    maxErrorRatio: 0.01,
    actualPeriodIndex: 0,
  });
  assert.equal(comparison.errorRatio, 0);
});

test("time travel debugger rechecks access, adjusts cursors after truncation, and preserves array/null scopes", () => {
  const service = new TimeTravelDebugService({ maxEventsPerExecution: 3 });
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-05-20T00:00:00.000Z", variables: { list: { value: [1, 2], scope: "loop" } } },
    { stepId: "step-2", timestamp: "2026-05-20T00:01:00.000Z", variables: { value: { value: null, scope: "global" } } },
    { stepId: "step-3", timestamp: "2026-05-20T00:02:00.000Z", variables: { text: "ok" } },
  ]);

  const session = service.createSession("task-1", "exec-1", {
    actorId: "dev-1",
    environment: "dev",
    mfaVerified: false,
    sessionExpiresAt: isoOffsetFromNow(24 * 60 * 60 * 1000),
    permissions: ["time_travel:replay"],
  });
  service.replayStep(session.sessionId);
  service.replayStep(session.sessionId);
  const variables = service.getVariableState(session.sessionId, 1);
  assert.ok(variables.some((variable) => variable.name === "list" && variable.type === "array" && variable.scope === "loop"));
  assert.ok(variables.some((variable) => variable.name === "value" && variable.type === "null" && variable.scope === "global"));

  service.loadEventStore("exec-1", [
    { stepId: "step-2", timestamp: "2026-05-20T00:01:00.000Z", variables: {} },
    { stepId: "step-3", timestamp: "2026-05-20T00:02:00.000Z", variables: {} },
  ]);
  const state = service.replayToCursor(session.sessionId, 2);
  assert.ok(state != null);
  assert.equal(state?.cursor.toEventIndex <= 2, true);

  assert.throws(() => service.createSession("task-2", "exec-2", {
    actorId: "prod-user",
    environment: "prod",
    mfaVerified: true,
    sessionExpiresAt: isoOffsetFromNow(-24 * 60 * 60 * 1000),
    permissions: ["time_travel:replay", "time_travel:replay:prod"],
  }), /time_travel_debug\.session_expired/);
});

test("explanation cache supports arbitrary TTL values and materializes expiresAt", () => {
  const updated = putExplanationCacheEntry({}, {
    cacheKey: "k1",
    summary: "cached explanation",
    ttlHours: 6,
    createdAt: "2026-05-20T00:00:00.000Z",
  });

  assert.equal(updated.k1?.ttlHours, 6);
  assert.equal(updated.k1?.expiresAt, "2026-05-20T06:00:00.000Z");
});

test("ops capacity predictor uses real sample spacing and single average calculation", () => {
  const service = new OpsCapacityPredictorService();
  const assessment = service.assessRisk(80, 120, [
    { timestamp: "2026-05-20T00:00:00.000Z", load: 50, capacity: 200 },
    { timestamp: "2026-05-20T02:00:00.000Z", load: 80, capacity: 200 },
    { timestamp: "2026-05-20T04:00:00.000Z", load: 110, capacity: 200 },
  ]);

  assert.equal(assessment.trend?.averageGrowthPercent, 48.75);
  assert.ok(assessment.trend?.projectedCapacityExhaustionAt != null);
  assert.equal(
    Date.parse(assessment.trend!.projectedCapacityExhaustionAt!) > Date.parse("2026-05-20T04:00:00.000Z"),
    true,
  );
});
