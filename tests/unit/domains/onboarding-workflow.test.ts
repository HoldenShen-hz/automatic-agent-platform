import assert from "node:assert/strict";
import test from "node:test";

import { DomainOnboardingService } from "../../../src/domains/operations/domain-onboarding-service.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";

function registerTestDomain(service: DomainRegistryService, domainId = "coding"): void {
  service.register({
    domainId,
    name: "Coding",
    description: "Coding workflows",
    version: 1,
    workflows: [
      {
        workflowId: "wf_build",
        name: "Build",
        triggerConditions: {},
        steps: [
          {
            stepName: "read",
            toolHints: ["repo_map"],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 1000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: "coding-default",
        tools: [{ toolName: "repo_map", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["repo_map"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status: "draft",
    externalAdapters: [],
    pluginBindings: [],
    executionProfile: {
      executionMode: {
        planningMode: "llm_assisted" as const,
        hotPathMode: "deterministic_only" as const,
        llmInHotPathAllowed: false,
        maxHotPathLatencyMs: 1000,
      },
      latencyTier: "near_realtime" as const,
      compiledArtifactRef: null as string | null,
    },
  });
}

test("DomainOnboardingService.start begins in domain_modeling phase", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  const session = service.start("coding");
  assert.equal(session.activePhase, "domain_modeling");
});

test("DomainOnboardingService.advance progresses through phases", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  let session = service.advance("coding", ["artifact:modeling"]);
  assert.equal(session.activePhase, "pack_development");

  session = service.advance("coding", ["artifact:validation"]);
  assert.equal(session.activePhase, "security_certification");

  session = service.advance("coding", ["artifact:security"]);
  assert.equal(session.activePhase, "gray_rollout");
});

test("DomainOnboardingService.advance blocks empty evidence", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  assert.throws(() => {
    service.advance("coding", []);
  }, (error) => {
    assert.equal((error as { code?: string }).code, "domain_onboarding.evidence_required");
    return true;
  });
});

test("DomainOnboardingService.block marks current phase as blocked", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "block_test");
  const service = new DomainOnboardingService(registry);
  service.start("block_test");

  const session = service.block("block_test", "block_reason_artifact");
  // activePhase is null when current phase is blocked (not in_progress)
  assert.equal(session.activePhase, null);
  const currentRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.notEqual(currentRecord, undefined);
  assert.equal(currentRecord!.status, "blocked");
});

test("DomainOnboardingService.rollback returns domain to earlier phase", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "rollback_test");
  const service = new DomainOnboardingService(registry);
  service.start("rollback_test");
  service.advance("rollback_test", ["artifact:modeling"]);

  // Rollback to domain_modeling phase
  const session = service.rollback("rollback_test", "domain_modeling", "checkpoint_artifact", "test rollback");
  assert.equal(session.activePhase, "domain_modeling");
  assert.ok(session.rollbackHistory.length > 0);
  assert.equal(session.rollbackHistory[0]!.phase, "pack_development");
});

test("DomainOnboardingService.list returns all onboarding sessions", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "list_domain_a");
  registerTestDomain(registry, "list_domain_b");
  const service = new DomainOnboardingService(registry);
  service.start("list_domain_a");
  service.start("list_domain_b");

  const sessions = service.list();
  assert.equal(sessions.length, 2);
});

test("DomainOnboardingService.get returns session for domain", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "get_test");
  const service = new DomainOnboardingService(registry);
  service.start("get_test");

  const session = service.get("get_test");
  assert.notEqual(session, null);
  assert.equal(session!.activePhase, "domain_modeling");
  assert.equal(session!.completed, false);
});

test("DomainOnboardingService.get throws for unregistered domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(() => {
    service.start("unregistered_domain");
  }, (error) => {
    assert.equal((error as { code?: string }).code, "domain_onboarding.domain_not_found");
    return true;
  });
});

test("DomainOnboardingService.advance adds evidence to current phase record", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "evidence_test");
  const service = new DomainOnboardingService(registry);
  service.start("evidence_test");

  service.advance("evidence_test", ["artifact:modeling_v1", "artifact:modeling_v2"]);
  const session = service.get("evidence_test");

  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.notEqual(modelingRecord, undefined);
  assert.equal(modelingRecord!.evidenceArtifactIds.length, 2);
  assert.ok(modelingRecord!.evidenceArtifactIds.includes("artifact:modeling_v1"));
  assert.ok(modelingRecord!.evidenceArtifactIds.includes("artifact:modeling_v2"));
});

test("DomainOnboardingService tracks rollback history", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "history_test");
  const service = new DomainOnboardingService(registry);
  service.start("history_test");
  service.advance("history_test", ["artifact:modeling"]);
  service.rollback("history_test", "domain_modeling", "checkpoint", "testing");

  const session = service.get("history_test");
  assert.ok(session.rollbackHistory.length > 0);
  assert.equal(session.rollbackHistory[0]!.phase, "pack_development");
  assert.equal(session.rollbackHistory[0]!.checkpointArtifactId, "checkpoint");
  assert.equal(session.rollbackHistory[0]!.reason, "testing");
});
