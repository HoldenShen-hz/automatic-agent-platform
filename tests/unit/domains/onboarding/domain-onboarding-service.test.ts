import assert from "node:assert/strict";
import test from "node:test";

import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

function createTestDomain(registry: DomainRegistryService, domainId: string): void {
  registry.register({
    domainId,
    name: `${domainId} name`,
    description: `Test domain ${domainId}`,
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
    toolBundles: [{ bundleId: `${domainId}_tools`, tools: [] }],
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
    status: "validated",
    externalAdapters: [],
    pluginBindings: [],
  });
}

test("DomainOnboardingService constructor requires registry", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);
  assert.ok(service instanceof DomainOnboardingService);
});

test("DomainOnboardingService.start throws ValidationError for unknown domain", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  let caughtError: unknown;
  try {
    service.start("nonexistent_domain");
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError instanceof ValidationError);
  assert.equal((caughtError as ValidationError).code, "domain_onboarding.domain_not_found");
});

test("DomainOnboardingService.start creates session with single in_progress record", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "new_session");
  const service = new DomainOnboardingService(registry);

  const session = service.start("new_session");

  assert.equal(session.domainId, "new_session");
  assert.equal(session.records.length, 1);
  assert.equal(session.records[0]?.phase, "domain_modeling");
  assert.equal(session.records[0]?.status, "in_progress");
  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.completed, false);
  assert.deepEqual(session.rollbackHistory, []);
});

test("DomainOnboardingService.start is idempotent - calling twice returns same session", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "idempotent");
  const service = new DomainOnboardingService(registry);

  const session1 = service.start("idempotent");
  const session2 = service.start("idempotent");

  assert.equal(session1.records.length, 1);
  assert.equal(session2.records.length, 1);
  assert.deepEqual(session1.records, session2.records);
});

test("DomainOnboardingService.advance throws ValidationError when evidence is empty", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "empty_evidence");
  const service = new DomainOnboardingService(registry);
  service.start("empty_evidence");

  let caughtError: unknown;
  try {
    service.advance("empty_evidence", []);
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError instanceof ValidationError);
  assert.equal((caughtError as ValidationError).code, "domain_onboarding.evidence_required");
});

test("DomainOnboardingService.advance throws ValidationError when no active phase", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "no_active");
  const service = new DomainOnboardingService(registry);
  service.start("no_active");

  // Advance through all phases
  service.advance("no_active", ["m"]);
  service.advance("no_active", ["v"]);
  service.advance("no_active", ["s"]);
  service.advance("no_active", ["c"]);

  let caughtError: unknown;
  try {
    service.advance("no_active", ["extra"]);
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError instanceof ValidationError);
  assert.equal((caughtError as ValidationError).code, "domain_onboarding.no_active_phase");
});

test("DomainOnboardingService.advance completes current phase and opens next", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "advance_test");
  const service = new DomainOnboardingService(registry);
  service.start("advance_test");

  const session = service.advance("advance_test", ["artifact_1"]);

  // Modeling should be completed
  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "completed");
  assert.deepEqual(modelingRecord?.evidenceArtifactIds, ["artifact_1"]);

  // pack_development should be in_progress
  const devRecord = session.records.find((r) => r.phase === "pack_development");
  assert.equal(devRecord?.status, "in_progress");

  // activePhase should be pack_development
  assert.equal(session.activePhase, "pack_development");
});

test("DomainOnboardingService.advance deduplicates evidence artifact IDs", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "dedup_advance");
  const service = new DomainOnboardingService(registry);
  service.start("dedup_advance");

  const session = service.advance("dedup_advance", ["a", "b", "a", "c"]);

  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.evidenceArtifactIds.length, 3);
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("a"));
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("b"));
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("c"));
});

test("DomainOnboardingService.advance on final phase completes and activates", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "final_phase");
  const service = new DomainOnboardingService(registry);
  service.start("final_phase");

  service.advance("final_phase", ["modeling"]);
  service.advance("final_phase", ["validation"]);
  service.advance("final_phase", ["security"]);
  const session = service.advance("final_phase", ["canary"]);

  assert.equal(session.completed, true);
  assert.equal(session.activePhase, null);
  assert.equal(session.activatedDomainStatus, "active");
});

test("DomainOnboardingService.block sets current phase to blocked with reason artifact", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "block_test");
  const service = new DomainOnboardingService(registry);
  service.start("block_test");

  const session = service.block("block_test", "block_reason_artifact");

  assert.equal(session.activePhase, null);

  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "blocked");
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("block_reason_artifact"));
});

test("DomainOnboardingService.block throws when no active phase", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "block_no_active");
  const service = new DomainOnboardingService(registry);
  service.start("block_no_active");

  service.advance("block_no_active", ["m"]);
  service.advance("block_no_active", ["v"]);
  service.advance("block_no_active", ["s"]);
  service.advance("block_no_active", ["c"]);

  let caughtError: unknown;
  try {
    service.block("block_no_active", "artifact");
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError instanceof ValidationError);
  assert.equal((caughtError as ValidationError).code, "domain_onboarding.no_active_phase");
});

test("DomainOnboardingService.rollback reopens target phase and resets later phases", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "rollback_test");
  const service = new DomainOnboardingService(registry);
  service.start("rollback_test");

  service.advance("rollback_test", ["m"]);
  service.advance("rollback_test", ["v"]);

  const session = service.rollback("rollback_test", "domain_modeling", "checkpoint_artifact", "rollback reason");

  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.rollbackHistory.length, 1);
  assert.equal(session.rollbackHistory[0]?.phase, "security_certification");
  assert.equal(session.rollbackHistory[0]?.checkpointArtifactId, "checkpoint_artifact");
  assert.equal(session.rollbackHistory[0]?.reason, "rollback reason");

  const recordsByPhase = new Map(session.records.map((r) => [r.phase, r.status]));
  assert.equal(recordsByPhase.get("domain_modeling"), "in_progress");
  assert.equal(recordsByPhase.get("pack_development"), "pending");
  assert.equal(recordsByPhase.get("security_certification"), "pending");
  assert.equal(recordsByPhase.get("gray_rollout"), undefined);
});

test("DomainOnboardingService.rollback throws when no active phase", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "rollback_no_active");
  const service = new DomainOnboardingService(registry);
  service.start("rollback_no_active");

  service.advance("rollback_no_active", ["m"]);
  service.advance("rollback_no_active", ["v"]);
  service.advance("rollback_no_active", ["s"]);
  service.advance("rollback_no_active", ["c"]);

  let caughtError: unknown;
  try {
    service.rollback("rollback_no_active", "domain_modeling", "cp", "reason");
  } catch (error) {
    caughtError = error;
  }

  assert.ok(caughtError instanceof ValidationError);
  assert.equal((caughtError as ValidationError).code, "domain_onboarding.no_active_phase");
});

test("DomainOnboardingService.get returns session with correct state", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "get_test");
  const service = new DomainOnboardingService(registry);
  service.start("get_test");
  service.advance("get_test", ["m"]);

  const session = service.get("get_test");

  assert.equal(session.domainId, "get_test");
  assert.equal(session.activePhase, "pack_development");
  assert.equal(session.records.length, 2);
  assert.equal(session.completed, false);
});

test("DomainOnboardingService.get returns empty records for unstarted session", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "get_unstarted");
  const service = new DomainOnboardingService(registry);

  // Don't start session
  const session = service.get("get_unstarted");

  assert.equal(session.domainId, "get_unstarted");
  assert.equal(session.records.length, 0);
  assert.equal(session.activePhase, null);
  assert.deepEqual(session.rollbackHistory, []);
});

test("DomainOnboardingService.list returns all sessions sorted by domainId", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "zebra_domain");
  createTestDomain(registry, "alpha_domain");
  createTestDomain(registry, "mango_domain");

  const service = new DomainOnboardingService(registry);
  service.start("zebra_domain");
  service.start("alpha_domain");
  service.start("mango_domain");

  const sessions = service.list();

  assert.equal(sessions.length, 3);
  assert.equal(sessions[0]?.domainId, "alpha_domain");
  assert.equal(sessions[1]?.domainId, "mango_domain");
  assert.equal(sessions[2]?.domainId, "zebra_domain");
});

test("DomainOnboardingService.list returns empty array when no sessions", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  const sessions = service.list();

  assert.ok(Array.isArray(sessions));
  assert.equal(sessions.length, 0);
});

test("DomainOnboardingService.registry operations correctly validate domain existence", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  // Test start with unknown domain
  try {
    service.start("unknown_start");
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof ValidationError);
  }

  // Test advance with unknown domain
  try {
    service.advance("unknown_advance", ["artifact"]);
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof ValidationError);
  }

  // Test block with unknown domain
  try {
    service.block("unknown_block", "artifact");
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof ValidationError);
  }

  // Test rollback with unknown domain
  try {
    service.rollback("unknown_rollback", "domain_modeling", "cp", "reason");
    assert.fail("Should have thrown");
  } catch (e) {
    assert.ok(e instanceof ValidationError);
  }
});

test("DomainOnboardingService handles session state across multiple operations", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "multi_op_test");
  const service = new DomainOnboardingService(registry);

  // Start
  const session1 = service.start("multi_op_test");
  assert.equal(session1.activePhase, "domain_modeling");

  // Advance
  const session2 = service.advance("multi_op_test", ["modeling_art"]);
  assert.equal(session2.activePhase, "pack_development");

  // Block
  const session3 = service.block("multi_op_test", "block_art");
  assert.equal(session3.activePhase, null);

  // Rollback
  const session4 = service.rollback("multi_op_test", "domain_modeling", "rollback_cp", "unblock");
  assert.equal(session4.activePhase, "domain_modeling");

  // Re-advance
  const session5 = service.advance("multi_op_test", ["new_modeling"]);
  assert.equal(session5.activePhase, "pack_development");
});

test("DomainOnboardingService.complete phases through full lifecycle", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "full_lifecycle_test");
  const service = new DomainOnboardingService(registry);

  service.start("full_lifecycle_test");

  const phase1 = service.advance("full_lifecycle_test", ["modeling"]);
  assert.equal(phase1.activePhase, "pack_development");

  const phase2 = service.advance("full_lifecycle_test", ["validation"]);
  assert.equal(phase2.activePhase, "security_certification");

  const phase3 = service.advance("full_lifecycle_test", ["security"]);
  assert.equal(phase3.activePhase, "gray_rollout");

  const final = service.advance("full_lifecycle_test", ["canary"]);
  assert.equal(final.completed, true);
  assert.equal(final.activatedDomainStatus, "active");
});

test("DomainOnboardingService multiple domains maintain independent state", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "domain_x");
  createTestDomain(registry, "domain_y");
  const service = new DomainOnboardingService(registry);

  service.start("domain_x");
  service.start("domain_y");

  // Advance only domain_x
  service.advance("domain_x", ["x_modeling"]);

  const sessionX = service.get("domain_x");
  const sessionY = service.get("domain_y");

  assert.equal(sessionX.activePhase, "pack_development");
  assert.equal(sessionY.activePhase, "domain_modeling");
  assert.equal(sessionX.records.length, 2);
  assert.equal(sessionY.records.length, 1);
});

test("DomainOnboardingService rollback history records multiple rollbacks", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "multi_history_test");
  const service = new DomainOnboardingService(registry);

  service.start("multi_history_test");
  service.advance("multi_history_test", ["m"]);

  service.rollback("multi_history_test", "domain_modeling", "cp1", "first rollback");
  service.advance("multi_history_test", ["m2"]);
  service.rollback("multi_history_test", "domain_modeling", "cp2", "second rollback");

  const session = service.get("multi_history_test");
  assert.equal(session.rollbackHistory.length, 2);
  assert.equal(session.rollbackHistory[0]?.reason, "first rollback");
  assert.equal(session.rollbackHistory[1]?.reason, "second rollback");
});

test("DomainOnboardingService service methods throw domain_not_found for unregistered domains", () => {
  const registry = new DomainRegistryService();
  const service = new DomainOnboardingService(registry);

  const methods = [
    () => service.start("unregistered"),
    () => service.advance("unregistered", ["a"]),
    () => service.block("unregistered", "a"),
    () => service.rollback("unregistered", "domain_modeling", "cp", "r"),
    () => service.get("unregistered"),
  ];

  for (const method of methods) {
    try {
      method();
      assert.fail(`Expected ${method.toString()} to throw`);
    } catch (error) {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.domain_not_found");
    }
  }
});

test("DomainOnboardingService get method returns empty records when session not started", () => {
  const registry = new DomainRegistryService();
  createTestDomain(registry, "never_started");
  const service = new DomainOnboardingService(registry);

  const session = service.get("never_started");

  assert.equal(session.domainId, "never_started");
  assert.equal(session.records.length, 0);
  assert.equal(session.activePhase, null);
  assert.equal(session.completed, false);
});