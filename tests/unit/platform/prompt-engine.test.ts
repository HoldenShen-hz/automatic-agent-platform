import assert from "node:assert/strict";
import test from "node:test";

import { PromptTemplateRegistryService } from "../../../src/platform/prompt-engine/registry/index.js";
import { PromptVersionManager } from "../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import { HierarchicalPromptRegistryService } from "../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { PromptRendererService } from "../../../src/platform/prompt-engine/renderer/index.js";
import {
  PromptRolloutService,
  PROMPT_ROLLOUT_STAGES,
  isPromptRolloutStage,
  comparePromptRolloutStage,
  nextPromptRolloutStage,
} from "../../../src/platform/prompt-engine/rollout/index.js";
import {
  ConversationTemplateRegistry,
  ConversationTemplateExecutor,
} from "../../../src/platform/prompt-engine/conversation-template-service.js";
import { loadConversationTemplateConfig, getTemplatesFromConfig } from "../../../src/platform/prompt-engine/conversation-template-config-loader.js";
import { loadQualityConfig } from "../../../src/platform/prompt-engine/eval/quality-config-loader.js";
import { PostExecutionQualityGate } from "../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";
import { QualityGateEvidenceService } from "../../../src/platform/prompt-engine/eval/quality-gate-evidence-service.js";
import { JudgeProviderRegistryService } from "../../../src/platform/prompt-engine/eval/judge-provider-registry-service.js";
import { CrossProviderJudgeService } from "../../../src/platform/prompt-engine/eval/cross-provider-judge-service.js";
import { PlatformPromptReleaseOrchestrationService } from "../../../src/platform/prompt-engine/rollout/platform-prompt-release-orchestration-service.js";
import { ExecutionOutcomeEvaluator } from "../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";
import type { PromptBundleRegistrationInput } from "../../../src/platform/contracts/prompt-bundle/index.js";

// ── PromptVersionManager Tests ────────────────────────────────────────

test("PromptVersionManager parses semantic version formats", () => {
  const manager = new PromptVersionManager();

  assert.deepEqual(manager.parseVersion("v1.0"), { major: 1, minor: 0 });
  assert.deepEqual(manager.parseVersion("1.0"), { major: 1, minor: 0 });
  assert.deepEqual(manager.parseVersion("v2.5.3"), { major: 2, minor: 5, patch: 3 });
  assert.deepEqual(manager.parseVersion("3.10.1"), { major: 3, minor: 10, patch: 1 });
  assert.deepEqual(manager.parseVersion("  v1.2  "), { major: 1, minor: 2 });
});

test("PromptVersionManager throws on invalid version format", () => {
  const manager = new PromptVersionManager();

  assert.throws(() => manager.parseVersion("invalid"));
  assert.throws(() => manager.parseVersion("1"));
  assert.throws(() => manager.parseVersion("v1"));
  assert.throws(() => manager.parseVersion("v1."));
  assert.throws(() => manager.parseVersion("1.2.3.4"));
});

test("PromptVersionManager formats semantic versions", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.formatVersion({ major: 1, minor: 0 }), "v1.0");
  assert.equal(manager.formatVersion({ major: 2, minor: 5, patch: 3 }), "v2.5"); // without includePatch flag
  assert.equal(manager.formatVersion({ major: 2, minor: 5, patch: 3 }, true), "v2.5.3"); // with includePatch flag
  assert.equal(manager.formatVersion({ major: 1, minor: 0 }, true), "v1.0");
  assert.equal(manager.formatVersion({ major: 1, minor: 0, patch: 5 }, true), "v1.0.5");
});

test("PromptVersionManager compares versions correctly", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v1.0", "v2.0"), -1);
  assert.equal(manager.compareVersions("v2.0", "v1.0"), 1);
  assert.equal(manager.compareVersions("v1.0", "v1.0"), 0);
  assert.equal(manager.compareVersions("v1.1", "v1.0"), 1);
  assert.equal(manager.compareVersions("v1.0.1", "v1.0.0"), 1);
  assert.equal(manager.compareVersions("v1.0.0", "v1.0.1"), -1);
});

test("PromptVersionManager calculates next versions", () => {
  const manager = new PromptVersionManager();

  assert.deepEqual(manager.getNextVersion("v1.0", "major"), { major: 2, minor: 0, patch: 0 });
  assert.deepEqual(manager.getNextVersion("v1.0", "minor"), { major: 1, minor: 1, patch: 0 });
  assert.deepEqual(manager.getNextVersion("v1.5.3", "patch"), { major: 1, minor: 5, patch: 4 });
  assert.deepEqual(manager.getNextVersion("v2.3", "patch"), { major: 2, minor: 3, patch: 1 });
});

test("PromptVersionManager validates version formats without throwing", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersionFormat("v1.0"), true);
  assert.equal(manager.isValidVersionFormat("1.2.3"), true);
  assert.equal(manager.isValidVersionFormat("invalid"), false);
  assert.equal(manager.isValidVersionFormat(""), false);
});

test("PromptVersionManager registers and lists bundle versions", () => {
  const manager = new PromptVersionManager();
  const bundle = createMockPromptBundle("test_bundle", "v1.0");

  manager.registerBundleVersion(bundle as any);

  const sorted = manager.getSortedVersions("test_bundle");
  assert.deepEqual(sorted, ["v1.0"]);
});

test("PromptVersionManager respects max versions limit", () => {
  const manager = new PromptVersionManager({ maxVersionsPerBundle: 3 });

  manager.registerBundleVersion(createMockPromptBundle("bundle", "v1.0") as any);
  manager.registerBundleVersion(createMockPromptBundle("bundle", "v1.1") as any);
  manager.registerBundleVersion(createMockPromptBundle("bundle", "v1.2") as any);
  manager.registerBundleVersion(createMockPromptBundle("bundle", "v1.3") as any);

  const sorted = manager.getSortedVersions("bundle");
  assert.equal(sorted.length, 3);
});

// ── HierarchicalPromptRegistryService Tests ──────────────────────────

test("HierarchicalPromptRegistryService registers and retrieves bundles at global level", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.registerBundle(createBundleInput("test_bundle", "v1"), "global");

  const retrieved = service.getBundle("test_bundle", "task_type", undefined, undefined);
  assert.ok(retrieved != null);
  assert.equal(retrieved.bundleId, bundle.bundleId);
});

test("HierarchicalPromptRegistryService registers bundles at domain level", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("test_bundle", "v1"), "domain", "ops_domain");

  const retrieved = service.getBundle("test_bundle", "task_type", undefined, "ops_domain");
  assert.ok(retrieved != null);
  assert.equal(retrieved.domain, "ops_domain");
});

test("HierarchicalPromptRegistryService treats pack level as deprecated compatibility input", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("test_bundle", "v1"), "pack", undefined, "pack_123");

  const retrieved = service.getBundle("test_bundle", "task_type", "pack_123", undefined);
  assert.equal(retrieved, null);
});

test("HierarchicalPromptRegistryService registers bundles at task-type level", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("test_bundle", "v1"), "task-type", "ops_domain", "pack_123");

  // Use the same taskType as in createBundleInput ("test_task")
  const retrieved = service.getBundle("test_bundle", "test_task", "pack_123", "ops_domain");
  assert.ok(retrieved != null);
});

test("HierarchicalPromptRegistryService hierarchical lookup precedence", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("shared_bundle", "v1"), "global");
  service.registerBundle(createBundleInput("shared_bundle", "v2"), "domain", "ops_domain");

  const globalOnly = service.getBundle("shared_bundle", "task_type", undefined, undefined);
  const domainOverride = service.getBundle("shared_bundle", "task_type", undefined, "ops_domain");

  assert.ok(globalOnly != null);
  assert.ok(domainOverride != null);
  assert.equal(globalOnly.displayVersion, "v1");
  assert.equal(domainOverride.displayVersion, "v2");
});

test("HierarchicalPromptRegistryService deprecates bundles", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("test_bundle", "v1"), "global");

  service.deprecateBundle("test_bundle", "v1", "global");

  const retrieved = service.getBundle("test_bundle", "task_type", undefined, undefined);
  assert.equal(retrieved, null);
});

test("HierarchicalPromptRegistryService removes bundles", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("test_bundle", "v1"), "global");

  const removed = service.removeBundle("test_bundle", "v1", "global");
  assert.equal(removed, true);

  // Note: removeBundle removes from versionsByScope/versionsByName,
  // but getBundle looks in the primary storage (globalBundles, etc.)
  // So the bundle is still retrievable but version is removed from list
  const versions = service.listBundleVersions("test_bundle");
  assert.equal(versions.length, 0);
});

test("HierarchicalPromptRegistryService lists bundles by level", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(createBundleInput("bundle1", "v1"), "global");
  service.registerBundle(createBundleInput("bundle2", "v1"), "domain", "ops_domain");

  const globalBundles = service.listBundles("global");
  const domainBundles = service.listBundles("domain", "ops_domain");

  assert.equal(globalBundles.length, 1);
  assert.equal(domainBundles.length, 1);
});

test("HierarchicalPromptRegistryService validates registration input", () => {
  const service = new HierarchicalPromptRegistryService();

  assert.throws(() => service.registerBundle({ ...createBundleInput("bundle", "v1"), name: "" } as any, "global"));
  assert.throws(() => service.registerBundle({ ...createBundleInput("bundle", "v1"), version: "" } as any, "global"));
  assert.throws(() => service.registerBundle({ ...createBundleInput("bundle", "v1"), domain: "" } as any, "global"));
  assert.throws(() => service.registerBundle({ ...createBundleInput("bundle", "v1"), taskType: "" } as any, "global"));
  assert.throws(() => service.registerBundle({ ...createBundleInput("bundle", "v1"), systemPrompt: { content: "", templateVariables: [], channel: "system" } } as any, "global"));
});

test("HierarchicalPromptRegistryService defaults domain-level registration from input", () => {
  const service = new HierarchicalPromptRegistryService();

  const bundle = service.registerBundle(createBundleInput("bundle", "v1"), "domain", undefined);
  assert.equal(bundle.domain, "test_domain");
});

test("HierarchicalPromptRegistryService accepts omitted packId for deprecated pack-level registration", () => {
  const service = new HierarchicalPromptRegistryService();

  const bundle = service.registerBundle(createBundleInput("bundle", "v1"), "pack", undefined, undefined);
  assert.equal(bundle.packId, "test_pack");
});

test("HierarchicalPromptRegistryService defaults task-type scope from input", () => {
  const service = new HierarchicalPromptRegistryService();

  const bundle = service.registerBundle(createBundleInput("bundle", "v1"), "task-type", undefined, undefined);
  assert.equal(bundle.domain, "test_domain");
});

test("HierarchicalPromptRegistryService resolves bundle for traffic with A/B testing", () => {
  const service = new HierarchicalPromptRegistryService({ enableTrafficSplit: true });
  service.registerBundle(
    { ...createBundleInput("bundle", "v1"), metadata: { trafficAllocation: { weight: 30 } } } as any,
    "global",
  );
  service.registerBundle(
    { ...createBundleInput("bundle", "v2"), metadata: { trafficAllocation: { weight: 70 } } } as any,
    "global",
  );

  const resolved1 = service.resolveBundleForTraffic("bundle", "task_type", undefined, undefined, "user_1");
  const resolved2 = service.resolveBundleForTraffic("bundle", "task_type", undefined, undefined, "user_2");
  const resolved3 = service.resolveBundleForTraffic("bundle", "task_type", undefined, undefined, "user_3");

  assert.ok(resolved1 != null);
  assert.ok(resolved2 != null);
  assert.ok(resolved3 != null);
});

// ── PromptRendererService Tests ───────────────────────────────────────

test("PromptRendererService renders with default variable values", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prefix",
    domainBlock: "Domain block content",
    variableSuffixTemplate: "User query: {{query}} Optional: {{optional}}",
    variableSpecs: [
      { key: "query", required: true },
      { key: "optional", required: false, defaultValue: "default_value" },
    ],
  });

  const result = renderer.render({
    template,
    variables: { query: "my question" },
  });

  assert.match(result.prompt, /System prefix/);
  assert.match(result.prompt, /Domain block content/);
  assert.match(result.prompt, /User query: my question/);
  assert.match(result.prompt, /Optional: default_value/);
});

test("PromptRendererService excludes fixedPrefix when includeFixedPrefix is false", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prefix",
    domainBlock: "Domain block",
    variableSuffixTemplate: "Query: {{query}}",
    variableSpecs: [{ key: "query", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { query: "test" },
    includeFixedPrefix: false,
  });

  assert.ok(!result.prompt.includes("System prefix"));
  assert.ok(result.prompt.includes("Domain block"));
});

test("PromptRendererService excludes domainBlock when includeDomainBlock is false", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "test_template",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prefix",
    domainBlock: "Domain block content",
    variableSuffixTemplate: "Query: {{query}}",
    variableSpecs: [{ key: "query", required: true }],
  });

  const result = renderer.render({
    template,
    variables: { query: "test" },
    includeDomainBlock: false,
  });

  assert.ok(result.prompt.includes("System prefix"));
  assert.ok(!result.prompt.includes("Domain block"));
});

test("PromptRendererService generates cache key", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "cache_test",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "Fixed content",
    domainBlock: "Domain",
    variableSpecs: [],
  });

  const result = renderer.render({ template, variables: {} });

  assert.ok(result.cacheKey.includes("cache_test"));
  assert.ok(result.cacheKey.includes("v1"));
  assert.ok(result.cacheKey.includes(template.fixedPrefixHash));
});

test("PromptRendererService handles multiple variable placeholders", () => {
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const template = registry.registerTemplate({
    templateKey: "multi_var",
    version: "v1",
    owner: "test@example.com",
    fixedPrefix: "System prefix",
    domainBlock: "Domain block",
    variableSuffixTemplate: "{{var1}} and {{var2}} and {{var3}}",
    variableSpecs: [
      { key: "var1", required: true },
      { key: "var2", required: true },
      { key: "var3", required: true },
    ],
  });

  const result = renderer.render({
    template,
    variables: { var1: "A", var2: "B", var3: "C" },
  });

  assert.match(result.prompt, /A and B and C/);
});

// ── ConversationTemplateExecutor Tests ─────────────────────────────────

test("ConversationTemplateExecutor handles context updates from multiple responses", () => {
  const registry = new ConversationTemplateRegistry();
  const executor = new ConversationTemplateExecutor(registry);

  registry.register({
    templateId: "multi_step",
    name: "Multi Step",
    description: "Test",
    intent: "task_create",
    steps: [
      { stepId: "step1", prompt: "Step 1", isRequired: true, expectedEntities: [], allowSkip: false },
      { stepId: "step2", prompt: "Step 2", isRequired: true, expectedEntities: [], allowSkip: false },
      { stepId: "step3", prompt: "Step 3", isRequired: true, expectedEntities: [], allowSkip: false },
    ],
  });

  let conv = executor.start("multi_step");
  assert.ok(conv !== null);
  assert.equal(conv?.currentStepIndex, 0);

  conv = executor.next(conv!, "response1", { extra: "data" });
  assert.equal(conv?.context.step1, "response1");
  assert.equal(conv?.context.extra, "data");

  conv = executor.next(conv!, "response2");
  assert.equal(conv?.context.step2, "response2");

  conv = executor.next(conv!, "response3");
  assert.equal(conv?.context.step3, "response3");
  assert.equal(conv?.isComplete, true);
});

test("ConversationTemplateExecutor returns null when skipping required step", () => {
  const registry = new ConversationTemplateRegistry();
  const executor = new ConversationTemplateExecutor(registry);

  registry.register({
    templateId: "skip_test",
    name: "Skip Test",
    description: "Test skip",
    intent: "task_query",
    steps: [
      { stepId: "req1", prompt: "Required 1", isRequired: true, expectedEntities: [], allowSkip: false },
      { stepId: "opt1", prompt: "Optional 1", isRequired: false, expectedEntities: [], allowSkip: true },
    ],
  });

  const conv = executor.start("skip_test");
  assert.ok(conv !== null);

  // Try to skip first (required) - should fail
  const result = executor.skip(conv!);
  assert.equal(result, null);
});

// ── PostExecutionQualityGate Tests ───────────────────────────────────

test("PostExecutionQualityGate decides released for complete and passed", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: true,
    qualityScore: 0.9,
    nextAction: "complete",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 1, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);
  assert.equal(decision.accepted, true);
  assert.equal(decision.releaseStage, "released");
});

test("PostExecutionQualityGate decides approval for approve action", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.5,
    nextAction: "approve",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 1, partialSignals: 0, completionBonus: 0, failurePenalty: 0.3, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);
  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "approval");
});

test("PostExecutionQualityGate decides repair for retry action", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.3,
    nextAction: "retry",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 2, partialSignals: 0, completionBonus: 0, failurePenalty: 0.6, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);
  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
});

test("PostExecutionQualityGate decides blocked as fallback", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.1,
    nextAction: "escalate",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 5, partialSignals: 0, completionBonus: 0, failurePenalty: 1.5, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);
  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "blocked");
});

// ── JudgeProviderRegistryService Tests ────────────────────────────────

test("JudgeProviderRegistryService registers and retrieves descriptors", () => {
  const service = new JudgeProviderRegistryService();
  const descriptor = service.registerDescriptor({
    providerId: "test_judge",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-4",
    supportedCapabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    trustScore: 0.9,
    latencyTier: "low",
    isolationLevel: "cross_provider_required",
    status: "ready",
  });

  assert.equal(descriptor.providerId, "test_judge");
});

test("JudgeProviderRegistryService syncs judge profile", () => {
  const service = new JudgeProviderRegistryService();
  service.syncJudgeProfile({
    judgeId: "sync_judge",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-3",
    capabilities: ["llm_judge", "safety_review"],
    maxCostUsd: 0.02,
    status: "ready",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  }, { trustScore: 0.95, latencyTier: "medium" });

  const descriptors = service.listDescriptors();
  const synced = descriptors.find((d) => d.providerId === "sync_judge");
  assert.ok(synced != null);
  assert.equal(synced?.trustScore, 0.95);
  assert.equal(synced?.latencyTier, "medium");
});

test("JudgeProviderRegistryService registers defaults", () => {
  const service = new JudgeProviderRegistryService();
  const defaults = service.registerDefaults();

  assert.equal(defaults.length, 3);
  assert.ok(defaults.some((d) => d.providerId.includes("openai")));
  assert.ok(defaults.some((d) => d.providerId.includes("anthropic")));
  assert.ok(defaults.some((d) => d.providerId.includes("minimax")));
});

test("JudgeProviderRegistryService selects descriptor by capability", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const selected = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "openai",
    requireIsolation: true,
  });

  assert.ok(selected != null);
  assert.ok(selected.supportedCapabilities.includes("llm_judge"));
  assert.notEqual(selected.providerFamily, "openai");
});

test("JudgeProviderRegistryService filters by cost", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const selected = service.selectDescriptor({
    capability: "llm_judge",
    maxCostUsd: 0.12,
  });

  assert.ok(selected != null);
  assert.ok(selected.maxCostUsd <= 0.12);
});

test("JudgeProviderRegistryService lists descriptors sorted by trust score and cost", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const descriptors = service.listDescriptors("ready");
  assert.ok(descriptors.length >= 3);

  // Should be sorted by trust score desc, then cost asc
  for (let i = 1; i < descriptors.length; i++) {
    const prev = descriptors[i - 1]!;
    const curr = descriptors[i]!;
    if (prev.trustScore === curr.trustScore) {
      assert.ok(prev.maxCostUsd <= curr.maxCostUsd);
    } else {
      assert.ok(prev.trustScore >= curr.trustScore);
    }
  }
});

// ── CrossProviderJudgeService Tests ──────────────────────────────────

test("CrossProviderJudgeService selectJudge returns cross-provider judge", () => {
  const judgeService = createMockEvalDatasetJudgeService();
  const service = new CrossProviderJudgeService(judgeService, "cheapest");

  const selection = service.selectJudge({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  assert.equal(selection.candidateProvider, "openai");
  assert.equal(selection.selectionStrategy, "cheapest");
  if (selection.selectedJudge != null) {
    assert.notEqual(selection.selectedJudge.providerFamily, "openai");
  }
});

test("CrossProviderJudgeService selectJudge uses different strategies", () => {
  const judgeService = createMockEvalDatasetJudgeService();
  const service = new CrossProviderJudgeService(judgeService);

  const byCheapest = service.selectJudge({ candidateProvider: "openai", strategy: "cheapest" });
  const byFastest = service.selectJudge({ candidateProvider: "openai", strategy: "fastest" });
  const byCapable = service.selectJudge({ candidateProvider: "openai", strategy: "most_capable" });
  const byDiverse = service.selectJudge({ candidateProvider: "openai", strategy: "provider_diverse" });

  assert.equal(byCheapest.selectionStrategy, "cheapest");
  assert.equal(byFastest.selectionStrategy, "fastest");
  assert.equal(byCapable.selectionStrategy, "most_capable");
  assert.equal(byDiverse.selectionStrategy, "provider_diverse");
});

test("CrossProviderJudgeService suggestMultipleJudges respects max count", () => {
  const judgeService = createMockEvalDatasetJudgeService();
  const service = new CrossProviderJudgeService(judgeService);

  const judges = service.suggestMultipleJudges({
    candidateProvider: "openai",
    maxJudges: 2,
  });

  assert.ok(judges.length <= 2);
});

test("CrossProviderJudgeService getProviderDiversityScore calculates correctly", () => {
  const judgeService = createMockEvalDatasetJudgeService();
  const service = new CrossProviderJudgeService(judgeService);

  const judges = [
    { judgeId: "j1", provider: "openai", providerFamily: "openai", capabilities: [], maxCostUsd: 0.01, status: "ready" as const, modelId: "gpt-4", createdAt: "", updatedAt: "" },
    { judgeId: "j2", provider: "anthropic", providerFamily: "anthropic", capabilities: [], maxCostUsd: 0.02, status: "ready" as const, modelId: "claude-3", createdAt: "", updatedAt: "" },
    { judgeId: "j3", provider: "minimax", providerFamily: "minimax", capabilities: [], maxCostUsd: 0.01, status: "ready" as const, modelId: "m1", createdAt: "", updatedAt: "" },
  ];

  const score = service.getProviderDiversityScore(judges);
  assert.equal(score, 1.0); // 3 families / 3 judges = 1.0
});

test("CrossProviderJudgeService getProviderDiversityScore handles single provider", () => {
  const judgeService = createMockEvalDatasetJudgeService();
  const service = new CrossProviderJudgeService(judgeService);

  const judges = [
    { judgeId: "j1", provider: "openai", providerFamily: "openai", capabilities: [], maxCostUsd: 0.01, status: "ready" as const, modelId: "gpt-4", createdAt: "", updatedAt: "" },
    { judgeId: "j2", provider: "openai", providerFamily: "openai", capabilities: [], maxCostUsd: 0.02, status: "ready" as const, modelId: "gpt-4", createdAt: "", updatedAt: "" },
  ];

  const score = service.getProviderDiversityScore(judges);
  assert.equal(score, 0.5); // 1 family / 2 judges = 0.5
});

// ── PlatformPromptReleaseOrchestrationService Tests ───────────────────

test("PlatformPromptReleaseOrchestrationService creates release successfully", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = createMockEvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();

  // Note: createRelease internally registers the template, so don't register beforehand

  datasets.registerDataset({
    datasetId: "ds_1",
    name: "Test Dataset",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: createStandardEvalCases(),
  });
  datasets.activateDataset("ds_1");

  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  const result = service.createRelease({
    template: {
      templateKey: "release_test",
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "System",
      domainBlock: "Domain",
    },
    datasetId: "ds_1",
    candidateProvider: "openai",
    candidateModel: "gpt-4",
    owner: "test@example.com",
    mode: "suggest",
    domainBlockCompatible: true,
    results: createStandardEvalResults(),
  });

  assert.equal(result.template.templateKey, "release_test");
  assert.equal(result.rollout.status, "ready");
});

test("PlatformPromptReleaseOrchestrationService throws for missing dataset", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = createMockEvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();

  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  assert.throws(
    () => service.createRelease({
      template: {
        templateKey: "test_template",
        version: "v1",
        owner: "test@example.com",
        fixedPrefix: "System",
        domainBlock: "Domain",
      },
      datasetId: "nonexistent",
      candidateProvider: "openai",
      candidateModel: "gpt-4",
      owner: "test@example.com",
      mode: "suggest",
      domainBlockCompatible: true,
      results: [],
    }),
    /nonexistent/,
  );
});

test("PlatformPromptReleaseOrchestrationService auto-activates when configured", () => {
  const templates = new PromptTemplateRegistryService();
  const datasets = createMockEvalDatasetJudgeService();
  const rollouts = new PromptRolloutService();

  // Note: createRelease internally registers the template, so don't register beforehand

  datasets.registerDataset({
    datasetId: "ds_auto",
    name: "Auto Dataset",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: createStandardEvalCases(),
  });
  datasets.activateDataset("ds_auto");

  const service = new PlatformPromptReleaseOrchestrationService(templates, datasets, rollouts);

  const result = service.createRelease({
    template: {
      templateKey: "auto_test",
      version: "v1",
      owner: "test@example.com",
      fixedPrefix: "System",
      domainBlock: "Domain",
    },
    datasetId: "ds_auto",
    candidateProvider: "openai",
    candidateModel: "gpt-4",
    owner: "test@example.com",
    mode: "suggest",
    domainBlockCompatible: true,
    results: createStandardEvalResults(),
    autoActivate: true,
    domainOwnerApproval: true,
    rollbackPlanPresent: true,
  });

  assert.equal(result.rollout.status, "stable");
});

// ── ConversationTemplateConfigLoader Tests ────────────────────────────

test("loadConversationTemplateConfig returns defaults on missing file", () => {
  const config = loadConversationTemplateConfig("/nonexistent/path/config.json");

  assert.deepEqual(config.templates, []);
  assert.equal(config.maxStepsPerTemplate, 10);
  assert.equal(config.enableTemplateAutoSelection, true);
});

test("getTemplatesFromConfig extracts templates from config", () => {
  const config = {
    templates: [
      { templateId: "t1", name: "Template 1", description: "", intent: "task_create", steps: [] },
      { templateId: "t2", name: "Template 2", description: "", intent: "task_query", steps: [] },
    ],
    maxStepsPerTemplate: 5,
    enableTemplateAutoSelection: false,
  };

  const templates = getTemplatesFromConfig(config);
  assert.equal(templates.length, 2);
});

// ── QualityConfigLoader Tests ────────────────────────────────────────

test("loadQualityConfig returns defaults on missing file", () => {
  const config = loadQualityConfig("/nonexistent/path/quality.json");

  assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  assert.equal(config.qualityGate.enforcement, "blocking");
  assert.equal(config.qualityScoreWeights.successSignal, 0.4);
  assert.equal(config.actionThresholds.retryMaxFailures, 3);
  assert.equal(config.evidence.enabled, true);
  assert.equal(config.evidence.retentionDays, 30);
});

// ── QualityGateEvidenceService Tests ─────────────────────────────────

test("QualityGateEvidenceService returns empty string when evidence disabled", () => {
  const mockArtifactStore = createMockArtifactStore();
  const config = createDefaultQualityConfig();
  config.evidence.enabled = false;

  const service = new QualityGateEvidenceService({ artifactStore: mockArtifactStore as any, config });

  const evaluation = createMockEvaluation();
  const decision = { accepted: false, releaseStage: "blocked" as const, reasonCodes: [] };

  const result = service.persistEvaluation(evaluation, decision);
  assert.equal(result, "");
});

test("QualityGateEvidenceService persists evaluation when enabled", () => {
  const mockArtifactStore = createMockArtifactStore();
  const config = createDefaultQualityConfig();
  config.evidence.enabled = true;

  const service = new QualityGateEvidenceService({ artifactStore: mockArtifactStore as any, config });

  const evaluation = createMockEvaluation();
  const decision = { accepted: true, releaseStage: "released" as const, reasonCodes: ["quality.accepted"] };

  const artifactId = service.persistEvaluation(evaluation, decision);
  assert.ok(artifactId.length > 0);
  assert.equal(mockArtifactStore.writtenArtifact?.kind, "quality_report");
});

// ── PromptRolloutStage Tests ──────────────────────────────────────────

test("PROMPT_ROLLOUT_STAGES has correct stage order", () => {
  assert.equal(PROMPT_ROLLOUT_STAGES[0], "canary_5");
  assert.equal(PROMPT_ROLLOUT_STAGES[PROMPT_ROLLOUT_STAGES.length - 1], "rolled_back");
});

test("comparePromptRolloutStage handles edge cases", () => {
  assert.ok(comparePromptRolloutStage("canary_5", "canary_20") < 0);
  assert.ok(comparePromptRolloutStage("canary_20", "stable") < 0);
});

test("nextPromptRolloutStage returns null for last stage", () => {
  // rolled_back is the terminal stage
  const result = nextPromptRolloutStage("rolled_back");
  assert.equal(result, null);
});

// ── Helper Functions ──────────────────────────────────────────────────

function createMockPromptBundle(name: string, version: string) {
  return {
    bundleId: `${name}:${version}`,
    name,
    version,
    domain: "test_domain",
    taskType: "test_task",
    packId: "test_pack",
    systemPrompt: { content: "Test prompt", templateVariables: [] as string[], channel: "system" as const },
    userPrompt: { content: "User prompt", templateVariables: [] as string[], channel: "user" as const },
    fewShotExamples: [] as any,
    constraints: {} as any,
    metadata: {
      owner: "test",
      deprecated: false,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 100 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createBundleInput(name: string, version: string): PromptBundleRegistrationInput {
  return {
    name,
    version,
    domain: "test_domain",
    taskType: "test_task",
    packId: "test_pack",
    systemPrompt: { content: "Test system prompt", templateVariables: [] as string[], channel: "system" },
    userPrompt: { content: "Test user prompt", templateVariables: [] as string[], channel: "user" },
    fewShotExamples: [],
    constraints: { maxTokens: undefined, temperature: undefined, topP: undefined, stopSequences: undefined, responseFormat: undefined, customConstraints: {} },
    metadata: { owner: "test", deprecated: false, tags: [], compatibilityTags: [], trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined } },
  };
}

function createMockEvaluation(): ExecutionOutcomeEvaluation {
  return {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: true,
    qualityScore: 0.85,
    nextAction: "complete",
    reasons: ["success:task completed"],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 1,
      failureSignals: 0,
      partialSignals: 0,
      completionBonus: 0.45,
      failurePenalty: 0,
      partialPenalty: 0,
    },
  };
}

function createDefaultQualityConfig() {
  return {
    qualityGate: {
      defaultPassThreshold: 0.8,
      criticalPassThreshold: 0.95,
      enforcement: "blocking" as const,
    },
    qualityScoreWeights: {
      successSignal: 0.4,
      completionOutcome: 0.3,
      failureSignal: 0.2,
      partialSignal: 0.1,
    },
    actionThresholds: {
      completeMinScore: 0.7,
      approvalRequiredScore: 0.5,
      retryMaxFailures: 3,
    },
    evidence: {
      enabled: true,
      artifactKind: "quality_report",
      retentionDays: 30,
    },
  };
}

function createMockArtifactStore() {
  return {
    writtenArtifact: null as any,
    writeTextArtifact(input: any) {
      this.writtenArtifact = input;
      return { record: { artifactId: "artifact_" + Math.random() } };
    },
  };
}

function createMockEvalDatasetJudgeService() {
  const service = new EvalDatasetJudgeService();

  service.registerJudge({
    judgeId: "judge_openai",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-4",
    maxCostUsd: 0.01,
  });

  service.registerJudge({
    judgeId: "judge_anthropic",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-3",
    maxCostUsd: 0.02,
  });

  service.registerJudge({
    judgeId: "judge_minimax",
    provider: "minimax",
    providerFamily: "minimax",
    modelId: "m1",
    maxCostUsd: 0.005,
  });

  service.registerDataset({
    datasetId: "test_dataset",
    name: "Test Dataset",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: createStandardEvalCases(),
  });
  service.activateDataset("test_dataset");

  return service;
}

function createStandardEvalCases(count = 50) {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return {
      caseId: `case_${id}`,
      input: { query: `test ${id}` },
      expectedOutput: "result",
      tags: [],
      priority: "standard" as const,
      qualityCriteria: [
        {
          criterionId: "contains_result",
          type: "contains" as const,
          config: { substring: "result" },
          weight: 1.0,
          threshold: 1,
        },
      ],
    };
  });
}

function createStandardEvalResults(count = 50) {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `case_${index + 1}`,
    output: "result",
    latencyMs: 100,
    costUsd: 0.001,
  }));
}

// Import the actual EvalDatasetJudgeService
import { EvalDatasetJudgeService } from "../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

// ── ExecutionOutcomeEvaluator Quality Score Weights Tests ──────────────

test("ExecutionOutcomeEvaluator qualityScoreWeights sum to 1.0 (issue #1961 fix)", () => {
  // Issue #1961: weights were summing to 1.2 (0.35 + 0.45 + 0.3 + 0.1 = 1.2)
  // which caused clamping at Math.min(1, ...) to lose resolution
  const config = loadQualityConfig("/nonexistent/path/quality.json");

  const weights = config.qualityScoreWeights;
  const sum = weights.successSignal + weights.completionOutcome + weights.failureSignal + weights.partialSignal;

  // Use approximate comparison to avoid floating-point precision issues
  assert.ok(
    Math.abs(sum - 1.0) < 0.0001,
    `qualityScoreWeights must sum to 1.0, got ${sum}`,
  );
});

test("ExecutionOutcomeEvaluator quality score calculation preserves resolution", () => {
  // With weights summing to 1.2, scores like 0.7 would get clamped down.
  // With correct weights (sum=1.0), intermediate scores have full range.
  const evaluator = new ExecutionOutcomeEvaluator();

  // Create a minimal plan graph bundle
  const planGraphBundle = {
    planGraphBundleId: "test_bundle",
    riskProfile: { riskClass: "medium" },
  } as any;

  // Scenario: 1 success signal, completed
  const feedback1 = {
    outcome: "completed",
    signals: [
      { category: "success", payload: { summary: "ok" }, timestamp: Date.now() },
    ],
  } as any;

  const result1 = evaluator.evaluateWithBreakdown(planGraphBundle, feedback1);
  // Expected: 1 * 0.3 (successSignal) + 0.4 (completionOutcome) = 0.7
  assert.equal(result1.qualityScore, 0.7, "1 success + completed should yield 0.7");

  // Scenario: 2 success signals, completed
  const feedback2 = {
    outcome: "completed",
    signals: [
      { category: "success", payload: { summary: "ok" }, timestamp: Date.now() },
      { category: "success", payload: { summary: "ok" }, timestamp: Date.now() },
    ],
  } as any;

  const result2 = evaluator.evaluateWithBreakdown(planGraphBundle, feedback2);
  // Expected: 2 * 0.3 (successSignal) + 0.4 (completionOutcome) = 1.0
  assert.equal(result2.qualityScore, 1.0, "2 successes + completed should yield 1.0");

  // Scenario: 1 success signal, not completed, 1 failure
  const feedback3 = {
    outcome: "repairable",
    signals: [
      { category: "success", payload: { summary: "ok" }, timestamp: Date.now() },
      { category: "failure", payload: { reasonCode: "ERR_001" }, timestamp: Date.now() },
    ],
  } as any;

  const result3 = evaluator.evaluateWithBreakdown(planGraphBundle, feedback3);
  // Expected: 1 * 0.3 - 1 * 0.2 = 0.1
  assert.equal(result3.qualityScore, 0.1, "1 success - 1 failure should yield 0.1");

  // Scenario: all weights at boundary - verify no clamping on intermediate scores
  // With sum=1.2, a score of 0.8 would clamp to 1.0 (losing distinction from 1.0)
  // With sum=1.0, score of 0.8 stays 0.8 (preserves resolution)
  const feedback4 = {
    outcome: "completed",
    signals: [
      { category: "success", payload: { summary: "ok" }, timestamp: Date.now() },
    ],
  } as any;
  // 1 * 0.3 + 0.4 = 0.7

  const feedback5 = {
    outcome: "completed",
    signals: [
      { category: "success", payload: { summary: "ok" }, timestamp: Date.now() },
      { category: "partial", payload: { summary: "partial" }, timestamp: Date.now() },
    ],
  } as any;
  // 1 * 0.3 + 0.4 - 0.1 = 0.6

  const result4 = evaluator.evaluateWithBreakdown(planGraphBundle, feedback4);
  const result5 = evaluator.evaluateWithBreakdown(planGraphBundle, feedback5);

  assert.ok(result4.qualityScore !== result5.qualityScore, "Scores should be distinct (0.7 vs 0.6)");
  assert.equal(result4.qualityScore, 0.7);
  assert.equal(result5.qualityScore, 0.6);
});
