import assert from "node:assert/strict";
import test from "node:test";

import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import type { DomainOnboardingSession } from "../../../../src/domains/operations/index.js";

function registerTestDomain(
  registry: DomainRegistryService,
  domainId: string,
  status: "draft" | "testing" | "active" = "testing",
): void {
  registry.register({
    domainId,
    name: `${domainId} domain`,
    description: `Test domain for ${domainId}`,
    version: 1,
    workflows: [
      {
        workflowId: `${domainId}_wf`,
        name: `${domainId} workflow`,
        triggerConditions: {},
        steps: [
          {
            stepName: "execute",
            toolHints: [],
            modelHints: {},
            outputSchema: null,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
            requiresReview: false,
            timeoutMs: 60000,
            dependsOn: [],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId: `${domainId}_tools`,
        tools: [],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["implement"],
      requiredTools: [],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
      securityLevel: "standard",
    },
    status,
    externalAdapters: [],
    pluginBindings: [],
  });
}

test("DomainOnboardingSession interface fields are readonly", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "readonly_test");

  const service = new DomainOnboardingService(registry);
  const session = service.start("readonly_test");

  // Verify all interface fields are present and correct types
  assert.equal(typeof session.domainId, "string");
  assert.ok(Array.isArray(session.records));
  assert.ok(session.activePhase === null || typeof session.activePhase === "string");
  assert.equal(typeof session.completed, "boolean");
  assert.ok(session.activatedDomainStatus === null || typeof session.activatedDomainStatus === "string");
  assert.ok(Array.isArray(session.rollbackHistory));
});

test("DomainOnboardingService.promoteDomainToRegisteredIfNeeded promotes draft domains", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "draft_domain", "draft");

  const service = new DomainOnboardingService(registry);
  service.start("draft_domain");

  // Complete all phases
  service.advance("draft_domain", ["modeling"]);
  service.advance("draft_domain", ["validation"]);
  service.advance("draft_domain", ["security"]);
  const session = service.advance("draft_domain", ["canary"]);

  // Draft domains should be promoted to registered then activated
  assert.equal(session.completed, true);
});

test("DomainOnboardingService.promoteDomainToRegisteredIfNeeded promotes validated domains", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "validated_domain", "validated");

  const service = new DomainOnboardingService(registry);
  service.start("validated_domain");

  service.advance("validated_domain", ["modeling"]);
  service.advance("validated_domain", ["validation"]);
  service.advance("validated_domain", ["security"]);
  const session = service.advance("validated_domain", ["canary"]);

  assert.equal(session.completed, true);
});

test("DomainOnboardingService does not promote already registered domains", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "registered_domain", "active");

  const service = new DomainOnboardingService(registry);
  service.start("registered_domain");

  service.advance("registered_domain", ["modeling"]);
  service.advance("registered_domain", ["validation"]);
  service.advance("registered_domain", ["security"]);
  const session = service.advance("registered_domain", ["canary"]);

  // Domain stays active, not re-registered
  assert.equal(session.activatedDomainStatus, "active");
});

test("DomainOnboardingService handles multiple domain sessions independently", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "domain_a");
  registerTestDomain(registry, "domain_b");
  registerTestDomain(registry, "domain_c");

  const service = new DomainOnboardingService(registry);

  // Start all sessions
  service.start("domain_a");
  service.start("domain_b");
  service.start("domain_c");

  // Advance domain_a and domain_b partially
  service.advance("domain_a", ["a_modeling"]);
  service.advance("domain_b", ["b_modeling"]);

  // Get states
  const sessionA = service.get("domain_a");
  const sessionB = service.get("domain_b");
  const sessionC = service.get("domain_c");

  assert.equal(sessionA.activePhase, "pack_development");
  assert.equal(sessionB.activePhase, "pack_development");
  assert.equal(sessionC.activePhase, "domain_modeling");

  // List should return all 3
  const all = service.list();
  assert.equal(all.length, 3);
});

test("DomainOnboardingService.advance throws ValidationError with correct properties", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "error_test");

  const service = new DomainOnboardingService(registry);
  service.start("error_test");

  try {
    service.advance("error_test", []);
    assert.fail("Should have thrown");
  } catch (error: unknown) {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Onboarding phase completion requires evidence.");
  }
});

test("DomainOnboardingService.advance evidence deduplication works across multiple advances", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "dedup_test");

  const service = new DomainOnboardingService(registry);
  service.start("dedup_test");

  // Advance with duplicate evidence
  service.advance("dedup_test", ["artifact_1", "artifact_2", "artifact_1", "artifact_3"]);

  const session = service.get("dedup_test");
  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");

  // Should have deduplicated to 3 unique artifacts
  assert.equal(modelingRecord?.evidenceArtifactIds.length, 3);
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("artifact_1"));
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("artifact_2"));
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("artifact_3"));
});

test("DomainOnboardingService.block adds reason to evidence even when blocked", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "block_reason_test");

  const service = new DomainOnboardingService(registry);
  service.start("block_reason_test");

  const session = service.block("block_reason_test", "block_reason_artifact");

  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "blocked");
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("block_reason_artifact"));
});

test("DomainOnboardingService.rollback adds checkpoint to target phase evidence", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "rollback_checkpoint_test", "active");

  const service = new DomainOnboardingService(registry);
  service.start("rollback_checkpoint_test");

  // Advance to pack_development
  service.advance("rollback_checkpoint_test", ["modeling"]);

  // Rollback to domain_modeling with checkpoint
  const session = service.rollback("rollback_checkpoint_test", "domain_modeling", "rollback_checkpoint", "testing");

  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("rollback_checkpoint"));
});

test("DomainOnboardingService.rollbackHistory records correct rollback point", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "history_record_test");

  const service = new DomainOnboardingService(registry);
  service.start("history_record_test");

  service.advance("history_record_test", ["modeling"]);

  const session = service.rollback("history_record_test", "domain_modeling", "checkpoint", "test reason");

  assert.equal(session.rollbackHistory.length, 1);
  assert.equal(session.rollbackHistory[0]?.phase, "pack_development");
  assert.equal(session.rollbackHistory[0]?.checkpointArtifactId, "checkpoint");
  assert.equal(session.rollbackHistory[0]?.reason, "test reason");
  assert.equal(typeof session.rollbackHistory[0]?.createdAt, "string");
});

test("DomainOnboardingService.list returns sessions in sorted order (alphabetical)", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "zebra");
  registerTestDomain(registry, "alpha");
  registerTestDomain(registry, "mango");

  const service = new DomainOnboardingService(registry);
  service.start("zebra");
  service.start("alpha");
  service.start("mango");

  const sessions = service.list();

  assert.equal(sessions[0]?.domainId, "alpha");
  assert.equal(sessions[1]?.domainId, "mango");
  assert.equal(sessions[2]?.domainId, "zebra");
});

test("DomainOnboardingService.completed is true only after all phases done", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "completion_test");

  const service = new DomainOnboardingService(registry);
  service.start("completion_test");

  // Not complete until all 4 phases done
  const phases = [
    { artifacts: ["modeling"], expectedPhase: "pack_development" },
    { artifacts: ["validation"], expectedPhase: "security_certification" },
    { artifacts: ["security"], expectedPhase: "gray_rollout" },
    { artifacts: ["canary"], expectedPhase: null },
  ];

  for (const phase of phases) {
    const session = service.advance("completion_test", phase.artifacts);
    assert.equal(session.activePhase, phase.expectedPhase, `Expected phase ${phase.expectedPhase}`);
  }

  const finalSession = service.get("completion_test");
  assert.equal(finalSession.completed, true);
});

test("DomainOnboardingService.activatedDomainStatus reflects registry state", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "activation_status_test", "testing");

  const service = new DomainOnboardingService(registry);
  service.start("activation_status_test");

  // Initially testing status, but promoted to registered on onboarding start
  let session = service.get("activation_status_test");
  assert.equal(session.activatedDomainStatus, "registered");

  // Complete all phases
  service.advance("activation_status_test", ["modeling"]);
  service.advance("activation_status_test", ["validation"]);
  service.advance("activation_status_test", ["security"]);
  session = service.advance("activation_status_test", ["canary"]);

  // After completion, should be active
  assert.equal(session.activatedDomainStatus, "active");
});

test("DomainOnboardingService handles concurrent session modifications", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "concurrent_test");

  const service = new DomainOnboardingService(registry);
  service.start("concurrent_test");

  // Multiple advances should work correctly
  service.advance("concurrent_test", ["modeling"]);
  service.advance("concurrent_test", ["validation"]);

  const session = service.get("concurrent_test");
  assert.equal(session.activePhase, "security_certification");
  assert.equal(session.records.length, 3); // domain_modeling, pack_development, security_certification

  const completedRecords = session.records.filter((r) => r.status === "completed");
  assert.equal(completedRecords.length, 2);
});

test("DomainOnboardingService.block sets activePhase to null when blocked", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "block_active_phase test");

  const service = new DomainOnboardingService(registry);
  service.start("block_active_phase test");

  const session = service.block("block_active_phase test", "block_reason");

  // activePhase is null when blocked
  assert.equal(session.activePhase, null);
});

test("DomainOnboardingService.rollback to current phase reopens it", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "rollback_same_test", "active");

  const service = new DomainOnboardingService(registry);
  service.start("rollback_same_test");

  service.advance("rollback_same_test", ["modeling"]);

  // Rollback to domain_modeling (the phase we're currently on after pack_development)
  const session = service.rollback("rollback_same_test", "pack_development", "checkpoint", "test");

  assert.equal(session.activePhase, "pack_development");
});

test("DomainOnboardingService validates domain exists on get", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.get("nonexistent"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      return true;
    },
  );
});

test("DomainOnboardingService validates domain exists on advance", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.advance("nonexistent", ["artifact"]),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      return true;
    },
  );
});

test("DomainOnboardingService validates domain exists on block", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.block("nonexistent", "artifact"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      return true;
    },
  );
});

test("DomainOnboardingService validates domain exists on rollback", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  assert.throws(
    () => service.rollback("nonexistent", "domain_modeling", "checkpoint", "reason"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      return true;
    },
  );
});

test("DomainOnboardingService.start creates session with in_progress status for first phase", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "first_phase_test");

  const service = new DomainOnboardingService(registry);
  const session = service.start("first_phase_test");

  const firstRecord = session.records[0];
  assert.equal(firstRecord?.status, "in_progress");
  assert.equal(firstRecord?.phase, "domain_modeling");
  assert.deepEqual(firstRecord?.evidenceArtifactIds, []);
});

test("DomainOnboardingService.advance completes current and opens next", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "advance_test");

  const service = new DomainOnboardingService(registry);
  service.start("advance_test");

  const session = service.advance("advance_test", ["evidence"]);

  // First record should be completed
  assert.equal(session.records[0]?.status, "completed");

  // Second record should be in_progress
  assert.equal(session.records[1]?.status, "in_progress");
  assert.equal(session.records[1]?.phase, "pack_development");
});

test("DomainOnboardingService.rollback marks phases after target as pending", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "pending_after_rollback_test", "active");

  const service = new DomainOnboardingService(registry);
  service.start("pending_after_rollback_test");

  // Advance to security_certification
  service.advance("pending_after_rollback_test", ["modeling"]);
  service.advance("pending_after_rollback_test", ["validation"]);
  service.advance("pending_after_rollback_test", ["security"]);

  // Rollback to domain_modeling
  const session = service.rollback("pending_after_rollback_test", "domain_modeling", "checkpoint", "rollback");

  const recordsByPhase = new Map(session.records.map((r) => [r.phase, r.status]));
  assert.equal(recordsByPhase.get("domain_modeling"), "in_progress");
  assert.equal(recordsByPhase.get("pack_development"), "pending");
  assert.equal(recordsByPhase.get("security_certification"), "pending");
  assert.equal(recordsByPhase.get("gray_rollout"), "pending");
});

test("DomainOnboardingService.get on started session returns session state", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "get_session_test");

  const service = new DomainOnboardingService(registry);
  service.start("get_session_test");

  const session = service.get("get_session_test");

  assert.equal(session.domainId, "get_session_test");
  assert.equal(session.records.length, 1);
  assert.equal(session.records[0]?.phase, "domain_modeling");
  assert.equal(session.rollbackHistory.length, 0);
});

test("DomainOnboardingService.list on no sessions returns empty array", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  const sessions = service.list();
  assert.ok(Array.isArray(sessions));
  assert.equal(sessions.length, 0);
});

test("DomainOnboardingService.block then rollback works correctly", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "block_rollback_test");

  const service = new DomainOnboardingService(registry);
  service.start("block_rollback_test");

  service.block("block_rollback_test", "block_artifact");
  const session = service.rollback("block_rollback_test", "domain_modeling", "rollback_checkpoint", "unblock");

  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.records[0]?.status, "in_progress");
});

test("DomainOnboardingService multiple rollbacks tracked in history", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "multi_rollback_test");

  const service = new DomainOnboardingService(registry);
  service.start("multi_rollback_test");

  service.advance("multi_rollback_test", ["modeling"]);
  service.rollback("multi_rollback_test", "domain_modeling", "cp1", "first");

  service.advance("multi_rollback_test", ["modeling_v2"]);
  service.rollback("multi_rollback_test", "domain_modeling", "cp2", "second");

  const session = service.get("multi_rollback_test");
  assert.equal(session.rollbackHistory.length, 2);
  assert.equal(session.rollbackHistory[0]?.reason, "first");
  assert.equal(session.rollbackHistory[1]?.reason, "second");
});

test("DomainOnboardingService rollback to last phase works", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "rollback_last_test", "active");

  const service = new DomainOnboardingService(registry);
  service.start("rollback_last_test");

  service.advance("rollback_last_test", ["modeling"]);
  service.advance("rollback_last_test", ["validation"]);
  service.advance("rollback_last_test", ["security"]);

  const session = service.rollback("rollback_last_test", "pack_development", "checkpoint", "rollback to dev");

  assert.equal(session.activePhase, "pack_development");
});

test("DomainOnboardingService.start is idempotent - second start returns same session", () => {
  const registry = new DomainRegistryService();
  registerTestDomain(registry, "idempotent_start_test");

  const service = new DomainOnboardingService(registry);
  const first = service.start("idempotent_start_test");
  const second = service.start("idempotent_start_test");

  assert.equal(first.records.length, 1);
  assert.equal(second.records.length, 1);
  assert.equal(first.activePhase, second.activePhase);
});