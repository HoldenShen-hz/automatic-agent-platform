import assert from "node:assert/strict";
import test from "node:test";

import { JudgeProviderRegistryService } from "../../../../../src/platform/prompt-engine/eval/judge-provider-registry-service.js";
import type { JudgeProfileRecord } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

test("JudgeProviderRegistryService.registerDescriptor rejects duplicate providerId", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "dup.id",
    provider: "test",
    providerFamily: "test",
    modelId: "model-1",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.8,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  const second = service.registerDescriptor({
    providerId: "dup.id",
    provider: "other",
    providerFamily: "other",
    modelId: "model-2",
    supportedCapabilities: ["safety_review"],
    maxCostUsd: 0.02,
    trustScore: 0.7,
    latencyTier: "high",
    isolationLevel: "cross_provider_required",
    status: "ready",
  });

  const all = service.listDescriptors();
  assert.equal(all.length, 1);
  assert.equal(second.providerId, "dup.id");
});

test("JudgeProviderRegistryService.registerDefaults returns 3 default judges", () => {
  const service = new JudgeProviderRegistryService();
  const defaults = service.registerDefaults();

  assert.equal(defaults.length, 3);
  const ids = defaults.map((d) => d.providerId);
  assert.ok(ids.includes("judge.openai.gpt-5.4-mini"));
  assert.ok(ids.includes("judge.anthropic.claude-sonnet"));
  assert.ok(ids.includes("judge.minimax.m1"));
});

test("JudgeProviderRegistryService.listDescriptors filters by status", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.ready",
    provider: "r",
    providerFamily: "r",
    modelId: "m1",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.9,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });
  service.registerDescriptor({
    providerId: "judge.disabled",
    provider: "d",
    providerFamily: "d",
    modelId: "m2",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.5,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "disabled",
  });

  const ready = service.listDescriptors("ready");
  assert.equal(ready.length, 1);
  assert.equal(ready[0]?.providerId, "judge.ready");

  const disabled = service.listDescriptors("disabled");
  assert.equal(disabled.length, 1);
  assert.equal(disabled[0]?.providerId, "judge.disabled");

  const all = service.listDescriptors();
  assert.equal(all.length, 2);
});

test("JudgeProviderRegistryService.selectDescriptor returns null when no ready judges", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.none",
    provider: "n",
    providerFamily: "n",
    modelId: "m",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.5,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "disabled",
  });

  const result = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "openai",
  });

  assert.equal(result, null);
});

test("JudgeProviderRegistryService.selectDescriptor respects maxCostUsd constraint", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.cheap",
    provider: "c",
    providerFamily: "c",
    modelId: "m1",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.05,
    trustScore: 0.8,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  const overBudget = service.selectDescriptor({
    capability: "llm_judge",
    maxCostUsd: 0.01,
  });

  assert.equal(overBudget, null);
});

test("JudgeProviderRegistryService.syncJudgeProfile defaults work correctly", () => {
  const service = new JudgeProviderRegistryService();
  const profile: JudgeProfileRecord = {
    judgeId: "sync.defs",
    provider: "syncprov",
    providerFamily: "syncfam",
    modelId: "sync-model",
    capabilities: ["llm_judge"],
    supportedRiskLevels: ["critical", "high", "medium", "low"],
    maxCostUsd: 0.10,
    status: "ready",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const descriptor = service.syncJudgeProfile(profile);

  assert.equal(descriptor.trustScore, 0.8);
  assert.equal(descriptor.latencyTier, "medium");
  assert.equal(descriptor.isolationLevel, "cross_provider_required");
  assert.deepEqual(descriptor.supportedCapabilities, ["llm_judge"]);
});

test("JudgeProviderRegistryService.syncJudgeProfile preserves profile fields", () => {
  const service = new JudgeProviderRegistryService();
  const profile: JudgeProfileRecord = {
    judgeId: "sync.pres",
    provider: "presprov",
    providerFamily: "presfam",
    modelId: "pres-model",
    capabilities: ["policy_audit", "safety_review", "llm_judge"],
    supportedRiskLevels: ["critical", "high", "medium", "low"],
    maxCostUsd: 0.15,
    status: "cooldown",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  };

  const descriptor = service.syncJudgeProfile(profile);

  assert.equal(descriptor.providerId, "sync.pres");
  assert.equal(descriptor.provider, "presprov");
  assert.equal(descriptor.providerFamily, "presfam");
  assert.equal(descriptor.modelId, "pres-model");
  assert.equal(descriptor.maxCostUsd, 0.15);
  assert.equal(descriptor.status, "cooldown");
  assert.deepEqual(descriptor.supportedCapabilities, ["policy_audit", "safety_review", "llm_judge"]);
});

test("JudgeProviderRegistryService.selectDescriptor with requireIsolation false bypasses family check", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.same.fam",
    provider: "s",
    providerFamily: "samefamily",
    modelId: "m",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.9,
    latencyTier: "low",
    isolationLevel: "cross_provider_required",
    status: "ready",
  });

  const result = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "samefamily",
    requireIsolation: false,
  });

  assert.ok(result);
  assert.equal(result?.providerId, "judge.same.fam");
});

test("JudgeProviderRegistryService.selectDescriptor returns descriptor when isolation level is cross_family_preferred and family differs", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.same.pref",
    provider: "s",
    providerFamily: "different_family",
    modelId: "m1",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.9,
    latencyTier: "low",
    isolationLevel: "cross_family_preferred",
    status: "ready",
  });

  const result = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "some_other_family",
    requireIsolation: true,
  });

  assert.ok(result);
  assert.equal(result?.providerId, "judge.same.pref");
});

test("JudgeProviderRegistryService listDescriptors sorting puts highest trustScore first", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.trust.low",
    provider: "l",
    providerFamily: "l",
    modelId: "m1",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.6,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });
  service.registerDescriptor({
    providerId: "judge.trust.high",
    provider: "h",
    providerFamily: "h",
    modelId: "m2",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.95,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  const sorted = service.listDescriptors("ready");
  assert.equal(sorted[0]?.providerId, "judge.trust.high");
  assert.equal(sorted[1]?.providerId, "judge.trust.low");
});

test("JudgeProviderRegistryService listDescriptors tiebreaker uses cost ascending", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDescriptor({
    providerId: "judge.cost.high",
    provider: "h",
    providerFamily: "h",
    modelId: "m1",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.05,
    trustScore: 0.8,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });
  service.registerDescriptor({
    providerId: "judge.cost.low",
    provider: "l",
    providerFamily: "l",
    modelId: "m2",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.8,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  const sorted = service.listDescriptors("ready");
  assert.equal(sorted[0]?.providerId, "judge.cost.low");
  assert.equal(sorted[1]?.providerId, "judge.cost.high");
});