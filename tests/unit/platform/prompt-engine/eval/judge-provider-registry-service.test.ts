import assert from "node:assert/strict";
import test from "node:test";

import { JudgeProviderRegistryService } from "../../../../../src/platform/prompt-engine/eval/judge-provider-registry-service.js";
import type { JudgeProfileRecord } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

test("JudgeProviderRegistryService registers defaults and selects isolated judge candidates", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const ready = service.listDescriptors("ready");
  assert.equal(ready.length, 3);
  assert.equal(ready[0]?.providerId, "judge.openai.gpt-5.4-mini");

  const isolated = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "openai",
    maxCostUsd: 0.2,
    requireIsolation: true,
  });
  assert.ok(isolated);
  assert.notEqual(isolated?.providerFamily, "openai");

  const sameFamilyAllowed = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "openai",
    maxCostUsd: 0.2,
    requireIsolation: false,
  });
  assert.ok(sameFamilyAllowed);
});

test("JudgeProviderRegistryService.selectDescriptor avoids back-to-back selections from the same family when alternatives exist", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const first = service.selectDescriptor({
    capability: "llm_judge",
    requireIsolation: false,
  });
  const second = service.selectDescriptor({
    capability: "llm_judge",
    requireIsolation: false,
  });

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(second?.providerFamily, first?.providerFamily);
});

test("JudgeProviderRegistryService.registerDescriptor adds descriptor to registry", () => {
  const service = new JudgeProviderRegistryService();

  const descriptor = service.registerDescriptor({
    providerId: "judge.test.custom",
    provider: "test",
    providerFamily: "test",
    modelId: "custom-model",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.05,
    trustScore: 0.85,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  assert.equal(descriptor.providerId, "judge.test.custom");
  const retrieved = service.listDescriptors("ready");
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0]?.providerId, "judge.test.custom");
});

test("JudgeProviderRegistryService.syncJudgeProfile creates descriptor from profile", () => {
  const service = new JudgeProviderRegistryService();

  const profile: JudgeProfileRecord = {
    judgeId: "judge.sync.test",
    provider: "syncprovider",
    providerFamily: "syncfamily",
    modelId: "sync-model",
    capabilities: ["policy_audit", "safety_review"],
    supportedRiskLevels: ["critical", "high", "medium", "low"],
    maxCostUsd: 0.12,
    status: "ready",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const descriptor = service.syncJudgeProfile(profile, {
    trustScore: 0.95,
    latencyTier: "low",
    isolationLevel: "cross_family_preferred",
  });

  assert.equal(descriptor.providerId, "judge.sync.test");
  assert.equal(descriptor.trustScore, 0.95);
  assert.equal(descriptor.latencyTier, "low");
  assert.equal(descriptor.isolationLevel, "cross_family_preferred");
  assert.deepEqual(descriptor.supportedCapabilities, ["policy_audit", "safety_review"]);
});

test("JudgeProviderRegistryService.syncJudgeProfile uses default overrides when not provided", () => {
  const service = new JudgeProviderRegistryService();

  const profile: JudgeProfileRecord = {
    judgeId: "judge.sync.defaults",
    provider: "syncprovider",
    providerFamily: "syncfamily",
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
});

test("JudgeProviderRegistryService.listDescriptors returns all when no status filter", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const all = service.listDescriptors();
  assert.equal(all.length, 3);

  const ready = service.listDescriptors("ready");
  assert.equal(ready.length, 3);

  const cooldown = service.listDescriptors("cooldown");
  assert.equal(cooldown.length, 0);

  const disabled = service.listDescriptors("disabled");
  assert.equal(disabled.length, 0);
});

test("JudgeProviderRegistryService.listDescriptors sorts by trustScore desc then cost asc", () => {
  const service = new JudgeProviderRegistryService();

  service.registerDescriptor({
    providerId: "judge.lowtrust",
    provider: "low",
    providerFamily: "low",
    modelId: "low-model",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.5,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  service.registerDescriptor({
    providerId: "judge.hightrust",
    provider: "high",
    providerFamily: "high",
    modelId: "high-model",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.02,
    trustScore: 0.95,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  service.registerDescriptor({
    providerId: "judge.midcost",
    provider: "mid",
    providerFamily: "mid",
    modelId: "mid-model",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.03,
    trustScore: 0.75,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  const sorted = service.listDescriptors("ready");
  assert.equal(sorted[0]?.providerId, "judge.hightrust");
  assert.equal(sorted[1]?.providerId, "judge.midcost");
  assert.equal(sorted[2]?.providerId, "judge.lowtrust");
});

test("JudgeProviderRegistryService.selectDescriptor returns null when no match", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const noMatch = service.selectDescriptor({
    capability: "nonexistent_capability",
  });
  assert.equal(noMatch, null);
});

test("JudgeProviderRegistryService.selectDescriptor filters by capability", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const pairwise = service.selectDescriptor({
    capability: "pairwise_rank",
  });
  assert.ok(pairwise);
  assert.equal(pairwise?.providerId, "judge.openai.gpt-5.4-mini");
});

test("JudgeProviderRegistryService.selectDescriptor filters by maxCostUsd", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const cheap = service.selectDescriptor({
    capability: "llm_judge",
    maxCostUsd: 0.11,
  });
  assert.ok(cheap);
  assert.ok(cheap!.maxCostUsd <= 0.11);
});

test("JudgeProviderRegistryService.selectDescriptor with null candidateProviderFamily bypasses isolation", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const result = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: null,
    requireIsolation: true,
  });
  assert.ok(result);
});

test("JudgeProviderRegistryService.selectDescriptor returns null when requireIsolation but same provider and not same_provider_allowed", () => {
  const service = new JudgeProviderRegistryService();

  service.registerDescriptor({
    providerId: "judge.same.only",
    provider: "same",
    providerFamily: "same_family",
    modelId: "same-model",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.9,
    latencyTier: "low",
    isolationLevel: "cross_provider_required",
    status: "ready",
  });

  const result = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "same_family",
    requireIsolation: true,
  });
  assert.equal(result, null);
});

test("JudgeProviderRegistryService.selectDescriptor allows same provider when isolationLevel is same_provider_allowed", () => {
  const service = new JudgeProviderRegistryService();

  service.registerDescriptor({
    providerId: "judge.same.allowed",
    provider: "myprovider",
    providerFamily: "myfamily",
    modelId: "my-model",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.9,
    latencyTier: "low",
    isolationLevel: "same_provider_allowed",
    status: "ready",
  });

  const result = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "myfamily",
    requireIsolation: true,
  });
  assert.ok(result);
  assert.equal(result?.providerId, "judge.same.allowed");
});
