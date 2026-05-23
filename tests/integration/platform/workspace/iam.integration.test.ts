/**
 * Integration Tests: IAM
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  PolicyDecisionRequest,
  PolicyDecisionResult,
} from "../../../../src/platform/five-plane-control-plane/iam/policy-engine-model.js";
import type { SandboxPolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

import type {
  DataClassificationLevel,
  ClassificationResult,
  HandlingDecision,
} from "../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";

import type {
  ManagedSecretLease,
} from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import type { SecretLeaseRecord, SecretRegistryRecord } from "../../../../src/platform/contracts/types/domain.js";

type PolicyEffect = PolicyDecisionResult["decision"];

// ============================================================================
// Type Validation Tests
// ============================================================================

test("integration: DataClassificationLevel union values", () => {
  const levels: DataClassificationLevel[] = ["public", "internal", "confidential", "restricted"];
  assert.equal(levels.length, 4);
});

test("integration: ClassificationResult type structure", () => {
  const result: ClassificationResult = {
    level: "confidential",
    piiTypes: ["email"],
    piiDetected: true,
    confidence: 0.95,
    reasoning: "pii_detected",
    requiresAudit: true,
    autoAnnotated: true,
  };

  assert.equal(result.level, "confidential");
  assert.ok(result.piiDetected);
});

test("integration: HandlingDecision type structure", () => {
  const decision: HandlingDecision = {
    allowed: false,
    action: "deny",
    level: "restricted",
    dimension: "prompt",
    reason: "level:restricted_action:deny",
    auditTrailId: null,
  };

  assert.equal(decision.allowed, false);
  assert.equal(decision.action, "deny");
});

test("integration: PolicyDecisionRequest type structure", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "dec_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "auto",
    stageViewRef: "execute",
  };

  assert.equal(request.decisionId, "dec_001");
  assert.equal(request.action, "invoke_model");
});

test("integration: PolicyDecisionResult type structure", () => {
  const result: PolicyDecisionResult = {
    decision: "allow",
    reasonCode: "policy.allowed",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-engine.v1",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["default_allow"],
    explainSummary: "Action allowed by policy engine.",
  };

  assert.equal(result.decision, "allow");
  assert.equal(result.requiresApproval, false);
});

test("integration: PolicyEffect union values", () => {
  const effects: PolicyEffect[] = ["allow", "deny", "escalate_for_approval"];
  assert.equal(effects.length, 3);
});

test("integration: SandboxPolicy type structure", () => {
  const policy: SandboxPolicy = {
    policyId: "sandbox_001",
    mode: "read_only",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/etc", "/var"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 0,
    memoryLimitBytes: 0,
    cpuLimitFraction: 0,
  };

  assert.ok(policy.allowedRoots.length > 0);
  assert.ok(policy.deniedRoots.length > 0);
});

test("integration: SecretRegistryRecord type structure", () => {
  const secret: SecretRegistryRecord = {
    secretRef: "secret://tenant_001/api_key",
    displayName: "api_key",
    category: "provider_api_key",
    providerKind: "environment",
    scopeType: "tenant",
    scopeRef: "tenant_001",
    status: "active",
    rotationPolicyJson: "{\"cadenceDays\":30}",
    metadataJson: null,
    currentVersion: "v1",
    lastRotatedAt: null,
    nextRotationDueAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(secret.scopeType, "tenant");
  assert.equal(secret.displayName, "api_key");
});

test("integration: ManagedSecretLease type structure", () => {
  const lease: ManagedSecretLease = {
    lease: {
      leaseId: "lease_001",
      secretRef: "secret://tenant_001/api_key",
      providerKind: "environment",
      taskId: null,
      executionId: null,
      requestedBy: "system",
      grantedTo: "worker_001",
      usagePurpose: "api_access",
      issuedAt: "2026-04-15T12:00:00.000Z",
      expiresAt: "2026-04-15T13:00:00.000Z",
      status: "active",
      revokedAt: null,
      revokedBy: null,
      revocationReasonCode: null,
      sourceVersion: "v1",
      maskedValue: "****",
      metadataJson: null,
    } satisfies SecretLeaseRecord,
    metadata: {
      secretRef: "secret://tenant_001/api_key",
      envName: "AA_SECRET_TENANT_001_API_KEY",
      scope: "tenant_001",
      source: "environment",
      resolved: true,
      maskedValue: "****",
      providerKind: "environment",
      registryStatus: "active",
      lastRotatedAt: null,
      nextRotationDueAt: null,
      auditId: null,
      leaseId: "lease_001",
      leaseStatus: "active",
      leaseSource: "provider_issued",
      providerLeaseId: null,
      issuedAt: "2026-04-15T12:00:00.000Z",
      expiresAt: "2026-04-15T13:00:00.000Z",
      revokedAt: null,
      renewable: true,
      issuedBy: "system",
    },
    value: "secret-value",
    registry: {
      secretRef: "secret://tenant_001/api_key",
      displayName: "api_key",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "tenant",
      scopeRef: "tenant_001",
      status: "active",
      rotationPolicyJson: "{\"cadenceDays\":30}",
      metadataJson: null,
      currentVersion: "v1",
      lastRotatedAt: null,
      nextRotationDueAt: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  };

  assert.equal(lease.lease.leaseId, "lease_001");
  assert.equal(lease.metadata.leaseStatus, "active");
});

test("integration: policy action types", () => {
  const actions = ["invoke_model", "invoke_tool", "write_file", "exec_command", "network_access", "install_extension", "org_change"] as const;
  assert.equal(actions.length, 7);

  for (const action of actions) {
    const request: PolicyDecisionRequest = {
      decisionId: `dec_${action}`,
      taskId: "task_001",
      subjectType: "user",
      subjectId: "user_001",
      action,
      riskCategory: "cost_sensitive",
      mode: "auto",
      stageViewRef: "execute",
    };
    assert.equal(request.action, action);
  }
});

test("integration: policy risk categories", () => {
  const categories = ["low", "medium", "high", "critical", "cost_sensitive", "prod_affecting"] as const;
  assert.equal(categories.length, 6);
});

test("integration: policy mode types", () => {
  const modes = ["auto", "supervised", "full-auto", "read_only", "emergency", "incident-mode"] as const;
  assert.equal(modes.length, 6);
});

test("integration: data handling dimensions", () => {
  const dimensions = ["prompt", "logs", "memory", "artifact", "cross_worker", "debug"] as const;
  assert.equal(dimensions.length, 6);
});

test("integration: handling action types", () => {
  const actions = ["allow", "deny", "redact", "summarize", "audit"] as const;
  assert.equal(actions.length, 5);
});

test("integration: secret types", () => {
  const secretTypes = ["password", "api_key", "certificate", "token", "ssh_key"] as const;
  assert.equal(secretTypes.length, 5);
});

test("integration: policy decision escalation", () => {
  const result: PolicyDecisionResult = {
    decision: "escalate_for_approval",
    reasonCode: "policy.prod_affecting",
    requiresApproval: true,
    enforcedConstraints: { breakGlass: false },
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-engine.v1",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["approval_required"],
    explainSummary: "Action requires approval.",
  };

  assert.equal(result.requiresApproval, true);
  assert.equal(result.decision, "escalate_for_approval");
});

test("integration: policy kill switch result", () => {
  const result: PolicyDecisionResult = {
    decision: "deny",
    reasonCode: "policy.kill_switch",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: true,
    auditPayload: {},
    evaluatedPolicyVersion: "policy-engine.v1",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["kill_switch"],
    explainSummary: "Kill switch denied the action.",
  };

  assert.equal(result.decision, "deny");
  assert.equal(result.killSwitchApplied, true);
});

test("integration: data classification confidence scoring", () => {
  const result: ClassificationResult = {
    level: "public",
    piiTypes: [],
    piiDetected: false,
    confidence: 0.5,
    reasoning: "keyword_based",
    requiresAudit: false,
    autoAnnotated: false,
  };

  assert.ok(result.confidence >= 0 && result.confidence <= 1);
});

test("integration: PII types", () => {
  const piiTypes = ["email", "phone", "ssn", "credit_card", "ip_address", "name", "address", "dob", "none"] as const;
  assert.equal(piiTypes.length, 9);
});

test("integration: sandbox policy path validation", () => {
  const policy: SandboxPolicy = {
    policyId: "sandbox_002",
    mode: "workspace_write",
    allowedRoots: ["/workspace", "/tmp"],
    deniedRoots: ["/etc", "/var", "/root"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 0,
    memoryLimitBytes: 0,
    cpuLimitFraction: 0,
  };

  const isAllowed = (path: string): boolean => {
    // Check denied paths first
    for (const denied of policy.deniedRoots) {
      if (path.startsWith(denied)) return false;
    }
    // Then check allowed paths
    for (const allowed of policy.allowedRoots) {
      if (path.startsWith(allowed)) return true;
    }
    return false;
  };

  assert.equal(isAllowed("/workspace/project/file.txt"), true);
  assert.equal(isAllowed("/etc/passwd"), false);
  assert.equal(isAllowed("/var/log/syslog"), false);
});

test("integration: classification level hierarchy", () => {
  const levelHierarchy: Record<DataClassificationLevel, number> = {
    public: 0,
    internal: 1,
    confidential: 2,
    restricted: 3,
  };

  assert.ok(levelHierarchy["public"] < levelHierarchy["internal"]);
  assert.ok(levelHierarchy["internal"] < levelHierarchy["confidential"]);
  assert.ok(levelHierarchy["confidential"] < levelHierarchy["restricted"]);
});
