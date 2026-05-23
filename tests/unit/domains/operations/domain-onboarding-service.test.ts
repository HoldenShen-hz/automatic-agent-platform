import assert from "node:assert/strict";
import test from "node:test";

import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import type { DomainOnboardingRecord } from "../../../../src/domains/operations/index.js";

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
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
  });
}

test("DomainOnboardingService.start() initializes session with domain_modeling phase", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  const session = service.start("coding");

  assert.equal(session.domainId, "coding");
  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.completed, false);
  assert.equal(session.records.length, 1);
  assert.equal(session.records[0]!.phase, "domain_modeling");
  assert.equal(session.records[0]!.status, "in_progress");
});

test("DomainOnboardingService.start() is idempotent", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  service.start("coding");
  const session = service.start("coding");

  assert.equal(session.records.length, 1);
});

test("DomainOnboardingService.advance() progresses to next phase", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  const session = service.advance("coding", ["artifact:modeling"]);

  assert.equal(session.activePhase, "pack_development");
  assert.equal(session.records[0]!.status, "completed");
  assert.deepEqual(session.records[0]!.evidenceArtifactIds, ["artifact:modeling"]);
});

test("DomainOnboardingService.advance() merges evidence artifact IDs when advancing through same phase", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  // First advance completes modeling and moves to development_validation
  const session1 = service.advance("coding", ["artifact:modeling"]);
  assert.equal(session1.activePhase, "pack_development");

  // Second advance completes development_validation and moves to security_certification
  const session2 = service.advance("coding", ["artifact:validation"]);

  // Verify the development_validation record has the evidence
  const devValidationRecord = session2.records.find((r: DomainOnboardingRecord) => r.phase === "pack_development");
  assert.deepEqual(devValidationRecord?.evidenceArtifactIds, ["artifact:validation"]);
});

test("DomainOnboardingService.advance() activates domain on final phase completion", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  service.advance("coding", ["artifact:modeling"]);
  service.advance("coding", ["artifact:validation"]);
  service.advance("coding", ["artifact:security"]);
  const session = service.advance("coding", ["artifact:canary"]);

  assert.equal(session.completed, true);
  assert.equal(session.activatedDomainStatus, "active");
});

test("DomainOnboardingService.advance() throws when no active phase exists", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");
  service.advance("coding", ["artifact:modeling"]);
  service.advance("coding", ["artifact:validation"]);
  service.advance("coding", ["artifact:security"]);
  service.advance("coding", ["artifact:canary"]);

  assert.throws(
    () => service.advance("coding", ["artifact:extra"]),
    (error: { code?: string }) => error.code === "domain_onboarding.no_active_phase",
  );
});

test("DomainOnboardingService.advance() throws when evidence is empty", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  assert.throws(
    () => service.advance("coding", []),
    (error: { code?: string }) => error.code === "domain_onboarding.evidence_required",
  );
});

test("DomainOnboardingService.block() sets current phase to blocked", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  const session = service.block("coding", "reason-artifact");

  assert.equal(session.activePhase, null);
  const modelingRecord = session.records.find((r: DomainOnboardingRecord) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "blocked");
  assert.deepEqual(modelingRecord?.evidenceArtifactIds, ["reason-artifact"]);
});

test("DomainOnboardingService.block() throws when no active phase exists", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");
  service.advance("coding", ["artifact:modeling"]);
  service.advance("coding", ["artifact:validation"]);
  service.advance("coding", ["artifact:security"]);
  service.advance("coding", ["artifact:canary"]);

  assert.throws(
    () => service.block("coding", "reason-artifact"),
    (error: { code?: string }) => error.code === "domain_onboarding.no_active_phase",
  );
});

test("DomainOnboardingService.rollback() resets to specified phase and records history", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");
  service.advance("coding", ["artifact:modeling"]);

  const session = service.rollback("coding", "domain_modeling", "checkpoint-artifact", "rollback reason");

  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.rollbackHistory.length, 1);
  assert.equal(session.rollbackHistory[0]!.phase, "pack_development");
  assert.equal(session.rollbackHistory[0]!.checkpointArtifactId, "checkpoint-artifact");
  assert.equal(session.rollbackHistory[0]!.reason, "rollback reason");
});

test("DomainOnboardingService.rollback() marks all phases after target as pending", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");
  service.advance("coding", ["artifact:modeling"]);
  service.advance("coding", ["artifact:validation"]);

  const session = service.rollback("coding", "domain_modeling", "checkpoint-artifact", "rollback");

  const recordsByPhase = new Map(session.records.map((r: DomainOnboardingRecord) => [r.phase, r.status]));
  // Target phase reopens; later phases are reset to pending.
  assert.equal(recordsByPhase.get("domain_modeling"), "in_progress");
  assert.equal(recordsByPhase.get("security_certification"), "pending");
  assert.equal(recordsByPhase.get("pack_development"), "pending");
});

test("DomainOnboardingService.rollback() throws when no active phase exists", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");
  service.advance("coding", ["artifact:modeling"]);
  service.advance("coding", ["artifact:validation"]);
  service.advance("coding", ["artifact:security"]);
  service.advance("coding", ["artifact:canary"]);

  assert.throws(
    () => service.rollback("coding", "domain_modeling", "checkpoint", "reason"),
    (error: { code?: string }) => error.code === "domain_onboarding.no_active_phase",
  );
});

test("DomainOnboardingService.get() returns session with correct state", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);
  service.start("coding");

  const session = service.get("coding");

  assert.equal(session.domainId, "coding");
  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.completed, false);
  assert.equal(session.rollbackHistory.length, 0);
});

test("DomainOnboardingService.get() returns empty records when session not started", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  // Domain is registered but session hasn't been started
  const session = service.get("coding");

  // Returns empty records since no session was started yet
  assert.equal(session.records.length, 0);
  assert.equal(session.rollbackHistory.length, 0);
  assert.equal(session.activePhase, null);
});

test("DomainOnboardingService.get() throws for unregistered domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.get("unknown"),
    (error: { code?: string }) => error.code === "domain_onboarding.domain_not_found",
  );
});

test("DomainOnboardingService.list() returns all sessions sorted by domainId", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "alpha-domain");
  registerTestDomain(registry, "beta-domain");
  const service = new DomainOnboardingService(registry);
  service.start("alpha-domain");
  service.start("beta-domain");

  const sessions = service.list();

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]!.domainId, "alpha-domain");
  assert.equal(sessions[1]!.domainId, "beta-domain");
});

test("DomainOnboardingService.start() throws for unregistered domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.start("unknown"),
    (error: { code?: string }) => error.code === "domain_onboarding.domain_not_found",
  );
});

test("DomainOnboardingService.advance() throws for unregistered domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.advance("unknown", ["artifact"]),
    (error: { code?: string }) => error.code === "domain_onboarding.domain_not_found",
  );
});

test("DomainOnboardingService.advance() throws when session not started", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.advance("coding", ["artifact"]),
    (error: { code?: string }) => error.code === "domain_onboarding.session_not_started",
  );
});

test("DomainOnboardingService.block() throws for unregistered domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.block("unknown", "artifact"),
    (error: { code?: string }) => error.code === "domain_onboarding.domain_not_found",
  );
});

test("DomainOnboardingService.block() throws when session not started", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.block("coding", "artifact"),
    (error: { code?: string }) => error.code === "domain_onboarding.session_not_started",
  );
});

test("DomainOnboardingService.rollback() throws for unregistered domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.rollback("unknown", "domain_modeling", "artifact", "reason"),
    (error: { code?: string }) => error.code === "domain_onboarding.domain_not_found",
  );
});

test("DomainOnboardingService.rollback() throws when session not started", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry);
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.rollback("coding", "domain_modeling", "artifact", "reason"),
    (error: { code?: string }) => error.code === "domain_onboarding.session_not_started",
  );
});
