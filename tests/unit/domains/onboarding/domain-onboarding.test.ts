import assert from "node:assert/strict";
import test from "node:test";
import { DomainOnboardingService } from "../../../../dist/src/domains/operations/domain-onboarding-service.js";
import { ValidationError } from "../../../../dist/src/platform/contracts/errors.js";
import type { DomainRegistryService } from "../../../../dist/src/domains/registry/domain-registry-service.js";

// ============================================================================
// Test helpers and mocks
// ============================================================================

type DomainOnboardingPhase = "domain_modeling" | "pack_development" | "security_certification" | "gray_rollout";

interface DomainOnboardingRecord {
  domainId: string;
  phase: DomainOnboardingPhase;
  status: "pending" | "in_progress" | "completed" | "blocked";
  evidenceArtifactIds: readonly string[];
}

interface RollbackPoint {
  phase: DomainOnboardingPhase;
  checkpointArtifactId: string;
  createdAt: string;
  reason: string;
}

interface DomainOnboardingSession {
  domainId: string;
  records: readonly DomainOnboardingRecord[];
  activePhase: DomainOnboardingPhase | null;
  completed: boolean;
  activatedDomainStatus: string | null;
  rollbackHistory: readonly RollbackPoint[];
}

interface DomainDefinition {
  domainId: string;
  name: string;
  description: string;
  version: number;
  status: "draft" | "validated" | "registered" | "active" | "updating" | "deprecated" | "archived";
  workflows: Array<{
    workflowId: string;
    name: string;
    triggerConditions: Record<string, unknown>;
    steps: Array<{
      stepName: string;
      toolHints: readonly string[];
      modelHints: Record<string, unknown>;
      outputSchema: Record<string, unknown> | null;
      retryPolicy: { maxRetries: number; backoffMs: number };
      requiresReview: boolean;
      timeoutMs: number;
      dependsOn: readonly string[];
    }>;
  }>;
  toolBundles: Array<{
    bundleId: string;
    tools: Array<{ toolName: string; enabled: boolean; configOverrides: Record<string, unknown> }>;
  }>;
  outputContracts: Array<{ contractId: string; name: string; schema: Record<string, unknown>; validationLevel: string }>;
  promptOverrides: Record<string, string>;
  capabilities: {
    supportedTaskTypes: readonly string[];
    requiredTools: readonly string[];
    optionalTools: readonly string[];
    modelPreferences: Record<string, string>;
    budgetLimits: { maxTokensPerTask: number; maxCostPerTask: number };
    securityLevel: "standard" | "elevated" | "restricted";
  };
  externalAdapters: readonly string[];
  pluginBindings: Array<{
    bindingId: string;
    domainId: string;
    pluginType: string;
    bindingRole?: string;
    pluginId: string;
    priority: number;
    enabled: boolean;
    config: Record<string, unknown>;
  }>;
}

class MockDomainRegistry {
  private domains = new Map<string, DomainDefinition>();
  private activationCalls: Array<{ domainId: string }> = [];
  private registerCalls: Array<{ domain: DomainDefinition }> = [];

  addDomain(domain: DomainDefinition): void {
    this.domains.set(domain.domainId, { ...domain });
  }

  get(domainId: string): DomainDefinition | null {
    return this.domains.get(domainId) ?? null;
  }

  register(domain: DomainDefinition): void {
    this.registerCalls.push({ domain });
    this.domains.set(domain.domainId, { ...domain });
  }

  activate(domainId: string): void {
    this.activationCalls.push({ domainId });
    const domain = this.domains.get(domainId);
    if (domain) {
      this.domains.set(domainId, { ...domain, status: "active" });
    }
  }

  getActivationCalls(): Array<{ domainId: string }> {
    return this.activationCalls;
  }

  getRegisterCalls(): Array<{ domain: DomainDefinition }> {
    return this.registerCalls;
  }
}

function createTestDomain(domainId: string, status: DomainDefinition["status"] = "draft"): DomainDefinition {
  return {
    domainId,
    name: `${domainId} domain`,
    description: `Test domain for ${domainId}`,
    version: 1,
    status,
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
    externalAdapters: [],
    pluginBindings: [],
  };
}

function createService(mockRegistry: MockDomainRegistry): DomainOnboardingService {
  return new DomainOnboardingService(mockRegistry as unknown as DomainRegistryService);
}

// ============================================================================
// Key Behavior 1: Domain onboarding initializes new domains
// ============================================================================

test("DomainOnboardingService.start creates a new onboarding session", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("new_domain"));
  const service = createService(mockRegistry);

  const session = service.start("new_domain");

  assert.equal(session.domainId, "new_domain");
  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.completed, false);
  assert.equal(session.records.length, 1);
  assert.equal(session.records[0]?.phase, "domain_modeling");
  assert.equal(session.records[0]?.status, "in_progress");
  assert.deepEqual(session.records[0]?.evidenceArtifactIds, []);
});

test("DomainOnboardingService.start is idempotent - calling twice returns same session", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("idempotent_domain"));
  const service = createService(mockRegistry);

  const first = service.start("idempotent_domain");
  const second = service.start("idempotent_domain");

  assert.equal(first.records.length, 1);
  assert.equal(second.records.length, 1);
  assert.equal(second.activePhase, "domain_modeling");
  assert.equal(first.records[0]?.status, "in_progress");
});

test("DomainOnboardingService.start throws when domain does not exist", () => {
  const mockRegistry = new MockDomainRegistry();
  const service = createService(mockRegistry);

  assert.throws(
    () => service.start("nonexistent"),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.domain_not_found");
      return true;
    },
  );
});

test("DomainOnboardingService.start initializes session with correct initial state", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("init_test"));
  const service = createService(mockRegistry);

  const session = service.start("init_test");

  assert.equal(session.activePhase, "domain_modeling");
  assert.equal(session.completed, false);
  assert.equal(session.rollbackHistory.length, 0);
  // activatedDomainStatus reflects the domain's current status from registry
  assert.equal(session.activatedDomainStatus, "draft");
  const record = session.records[0];
  assert.equal(record?.status, "in_progress");
  assert.equal(record?.phase, "domain_modeling");
  assert.deepEqual(record?.evidenceArtifactIds, []);
});

// ============================================================================
// Key Behavior 2: Domain registration with registry
// ============================================================================

test("DomainOnboardingService.advance promotes domain through all phases and calls registry.activate", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_advance", "testing"));
  const service = createService(mockRegistry);

  service.start("test_advance");

  let session = service.advance("test_advance", ["modeling_artifact"]);
  assert.equal(session.activePhase, "pack_development");
  assert.equal(session.records[0]?.status, "completed");
  assert.deepEqual(session.records[0]?.evidenceArtifactIds, ["modeling_artifact"]);

  session = service.advance("test_advance", ["validation_artifact"]);
  assert.equal(session.activePhase, "security_certification");

  session = service.advance("test_advance", ["security_artifact"]);
  assert.equal(session.activePhase, "gray_rollout");

  session = service.advance("test_advance", ["canary_artifact"]);
  assert.equal(session.completed, true);
  assert.equal(session.activatedDomainStatus, "active");

  const activationCalls = mockRegistry.getActivationCalls();
  assert.equal(activationCalls.length, 1);
  assert.equal(activationCalls[0]?.domainId, "test_advance");
});

test("DomainOnboardingService.advance promotes domain status to registered when onboarding completes", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_register", "draft"));
  const service = createService(mockRegistry);

  service.start("test_register");

  service.advance("test_register", ["modeling"]);
  service.advance("test_register", ["validation"]);
  service.advance("test_register", ["security"]);
  service.advance("test_register", ["canary"]);

  const domain = mockRegistry.get("test_register");
  assert.equal(domain?.status, "active");
});

test("DomainOnboardingService.advance merges evidence artifacts and deduplicates", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_merge", "active"));
  const service = createService(mockRegistry);

  service.start("test_merge");

  const session = service.advance("test_merge", ["artifact_1", "artifact_2", "artifact_1"]);

  assert.equal(session.records[0]?.evidenceArtifactIds.length, 2);
  assert.ok(session.records[0]?.evidenceArtifactIds.includes("artifact_1"));
  assert.ok(session.records[0]?.evidenceArtifactIds.includes("artifact_2"));
});

test("DomainOnboardingService.get returns current session state including registry status", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_get", "active"));
  const service = createService(mockRegistry);

  service.start("test_get");
  service.advance("test_get", ["modeling_art"]);

  const session = service.get("test_get");

  assert.equal(session.domainId, "test_get");
  assert.equal(session.activePhase, "pack_development");
  assert.equal(session.completed, false);
  assert.equal(session.records.length, 2);
  assert.equal(session.rollbackHistory.length, 0);
});

// ============================================================================
// Key Behavior 3: Onboarding validates prerequisites
// ============================================================================

test("DomainOnboardingService.advance requires evidence artifacts", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_evidence"));
  const service = createService(mockRegistry);

  service.start("test_evidence");

  assert.throws(
    () => service.advance("test_evidence", []),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.evidence_required");
      return true;
    },
  );
});

test("DomainOnboardingService.advance throws when no active phase exists", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_no_active"));
  const service = createService(mockRegistry);

  service.start("test_no_active");

  service.advance("test_no_active", ["modeling"]);
  service.advance("test_no_active", ["validation"]);
  service.advance("test_no_active", ["security"]);
  service.advance("test_no_active", ["canary"]);

  assert.throws(
    () => service.advance("test_no_active", ["extra"]),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.no_active_phase");
      return true;
    },
  );
});

test("DomainOnboardingService.advance throws for unknown domain", () => {
  const mockRegistry = new MockDomainRegistry();
  const service = createService(mockRegistry);

  assert.throws(
    () => service.advance("nonexistent", ["artifact"]),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.domain_not_found");
      return true;
    },
  );
});

test("DomainOnboardingService.block marks current phase as blocked", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_block"));
  const service = createService(mockRegistry);

  service.start("test_block");

  const session = service.block("test_block", "block_reason_artifact");

  assert.equal(session.activePhase, null);
  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "blocked");
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("block_reason_artifact"));
});

test("DomainOnboardingService.block throws when no session exists", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_block_no_session"));
  const service = createService(mockRegistry);

  assert.throws(
    () => service.block("test_block_no_session", "reason"),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.session_not_started");
      return true;
    },
  );
});

test("DomainOnboardingService.block throws when no active phase exists", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_block_no_active"));
  const service = createService(mockRegistry);

  service.start("test_block_no_active");
  service.advance("test_block_no_active", ["modeling"]);
  service.advance("test_block_no_active", ["validation"]);
  service.advance("test_block_no_active", ["security"]);
  service.advance("test_block_no_active", ["canary"]);

  assert.throws(
    () => service.block("test_block_no_active", "reason"),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.no_active_phase");
      return true;
    },
  );
});

// ============================================================================
// Key Behavior 4: Cleanup or rollback on failure
// ============================================================================

test("DomainOnboardingService.rollback restores to earlier phase", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_rollback", "active"));
  const service = createService(mockRegistry);

  service.start("test_rollback");
  service.advance("test_rollback", ["modeling_evidence"]);

  const session = service.rollback("test_rollback", "domain_modeling", "rollback_checkpoint", "test reason");

  assert.equal(session.activePhase, "domain_modeling");
  const modelingRecord = session.records.find((r) => r.phase === "domain_modeling");
  assert.equal(modelingRecord?.status, "in_progress");
  assert.ok(modelingRecord?.evidenceArtifactIds.includes("rollback_checkpoint"));

  const devRecord = session.records.find((r) => r.phase === "pack_development");
  assert.equal(devRecord?.status, "pending");

  assert.equal(session.rollbackHistory.length, 1);
  assert.equal(session.rollbackHistory[0]?.phase, "pack_development");
  assert.equal(session.rollbackHistory[0]?.checkpointArtifactId, "rollback_checkpoint");
  assert.equal(session.rollbackHistory[0]?.reason, "test reason");
});

test("DomainOnboardingService.rollback records rollback history", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_history", "active"));
  const service = createService(mockRegistry);

  service.start("test_history");
  service.advance("test_history", ["modeling"]);
  service.rollback("test_history", "domain_modeling", "checkpoint_1", "first rollback");

  service.advance("test_history", ["modeling_v2"]);
  service.rollback("test_history", "domain_modeling", "checkpoint_2", "second rollback");

  const session = service.get("test_history");
  assert.equal(session.rollbackHistory.length, 2);
  assert.equal(session.rollbackHistory[0]?.reason, "first rollback");
  assert.equal(session.rollbackHistory[1]?.reason, "second rollback");
});

test("DomainOnboardingService.rollback throws when no session exists", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_rollback_no_session"));
  const service = createService(mockRegistry);

  assert.throws(
    () => service.rollback("test_rollback_no_session", "domain_modeling", "checkpoint", "reason"),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.session_not_started");
      return true;
    },
  );
});

test("DomainOnboardingService.rollback throws when all phases are completed", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_rollback_complete"));
  const service = createService(mockRegistry);

  service.start("test_rollback_complete");
  service.advance("test_rollback_complete", ["modeling"]);
  service.advance("test_rollback_complete", ["validation"]);
  service.advance("test_rollback_complete", ["security"]);
  service.advance("test_rollback_complete", ["canary"]);

  assert.throws(
    () => service.rollback("test_rollback_complete", "domain_modeling", "checkpoint", "reason"),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.no_active_phase");
      return true;
    },
  );
});

test("DomainOnboardingService.rollback reopens completed phase when re-advancing", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_reopen", "active"));
  const service = createService(mockRegistry);

  service.start("test_reopen");

  let session = service.advance("test_reopen", ["modeling_evidence"]);
  assert.equal(session.records[0]?.status, "completed");

  session = service.rollback("test_reopen", "domain_modeling", "checkpoint", "rollback");

  session = service.advance("test_reopen", ["new_modeling_evidence"]);
  assert.equal(session.activePhase, "pack_development");
  assert.equal(session.records[0]?.status, "completed");
  assert.ok(session.records[0]?.evidenceArtifactIds.includes("new_modeling_evidence"));
});

// ============================================================================
// Additional coverage
// ============================================================================

test("DomainOnboardingService.list returns all sessions sorted", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("z_domain"));
  mockRegistry.addDomain(createTestDomain("a_domain"));
  const service = createService(mockRegistry);

  service.start("z_domain");
  service.start("a_domain");

  const sessions = service.list();

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]?.domainId, "a_domain");
  assert.equal(sessions[1]?.domainId, "z_domain");
});

test("DomainOnboardingService.completed is true only when all phases are completed", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("test_complete"));
  const service = createService(mockRegistry);

  service.start("test_complete");
  assert.equal(service.get("test_complete").completed, false);

  service.advance("test_complete", ["modeling"]);
  assert.equal(service.get("test_complete").completed, false);

  service.advance("test_complete", ["validation"]);
  assert.equal(service.get("test_complete").completed, false);

  service.advance("test_complete", ["security"]);
  assert.equal(service.get("test_complete").completed, false);

  service.advance("test_complete", ["canary"]);
  assert.equal(service.get("test_complete").completed, true);
});

test("DomainOnboardingService maintains separate state per domain", () => {
  const mockRegistry = new MockDomainRegistry();
  mockRegistry.addDomain(createTestDomain("domain_x"));
  mockRegistry.addDomain(createTestDomain("domain_y"));
  const service = createService(mockRegistry);

  service.start("domain_x");
  service.start("domain_y");
  service.advance("domain_x", ["modeling"]);

  const sessionX = service.get("domain_x");
  const sessionY = service.get("domain_y");

  assert.equal(sessionX.activePhase, "pack_development");
  assert.equal(sessionY.activePhase, "domain_modeling");
});

test("DomainOnboardingService.get throws for unknown domain", () => {
  const mockRegistry = new MockDomainRegistry();
  const service = createService(mockRegistry);

  assert.throws(
    () => service.get("nonexistent"),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal((error as ValidationError).code, "domain_onboarding.domain_not_found");
      return true;
    },
  );
});