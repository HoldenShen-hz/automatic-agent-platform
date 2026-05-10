/**
 * Integration Tests: IAM
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  SandboxPolicy,
  PolicyDecisionRequest,
  PolicyDecisionResult,
  PolicyEffect,
} from "../../../../src/platform/five-plane-control-plane/iam/policy-engine.js";

import type {
  DataClassificationLevel,
  DataClassificationService,
  ClassificationResult,
  HandlingDecision,
} from "../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";

import type {
  SecretManagementService,
  StoredSecret,
  Lease,
} from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";

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
    stage: "execute",
  };

  assert.equal(request.decisionId, "dec_001");
  assert.equal(request.action, "invoke_model");
});

test("integration: PolicyDecisionResult type structure", () => {
  const result: PolicyDecisionResult = {
    decisionId: "dec_001",
    decision: "allow",
    reasonCode: "policy.allowed",
    requiresApproval: false,
    enforcedConstraints: {},
  };

  assert.equal(result.decision, "allow");
  assert.equal(result.requiresApproval, false);
});

test("integration: PolicyEffect union values", () => {
  const effects: PolicyEffect[] = ["allow", "deny", "escalate"];
  assert.equal(effects.length, 3);
});

test("integration: SandboxPolicy type structure", () => {
  const policy: SandboxPolicy = {
    allowedPaths: ["/workspace"],
    deniedPaths: ["/etc", "/var"],
    maxFileSizeBytes: 1024 * 1024,
    allowNetworkAccess: false,
  };

  assert.ok(policy.allowedPaths.length > 0);
  assert.ok(policy.deniedPaths.length > 0);
});

test("integration: StoredSecret type structure", () => {
  const secret: StoredSecret = {
    secretId: "secret_001",
    tenantId: "tenant_001",
    name: "api_key",
    secretType: "api_key",
    createdAt: "2026-04-01T00:00:00.000Z",
    expiresAt: null,
  };

  assert.equal(secret.secretId, "secret_001");
  assert.equal(secret.name, "api_key");
});

test("integration: Lease type structure", () => {
  const lease: Lease = {
    leaseId: "lease_001",
    secretId: "secret_001",
    issuedAt: "2026-04-15T12:00:00.000Z",
    expiresAt: "2026-04-15T13:00:00.000Z",
    ttlSeconds: 3600,
    purpose: "api_access",
  };

  assert.equal(lease.leaseId, "lease_001");
  assert.ok(lease.ttlSeconds > 0);
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
      riskCategory: "low",
      mode: "auto",
      stage: "execute",
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
    decisionId: "dec_escalate",
    decision: "escalate_for_approval",
    reasonCode: "policy.prod_affecting",
    requiresApproval: true,
    enforcedConstraints: { breakGlass: false },
    killSwitchApplied: false,
  };

  assert.equal(result.requiresApproval, true);
  assert.equal(result.decision, "escalate_for_approval");
});

test("integration: policy kill switch result", () => {
  const result: PolicyDecisionResult = {
    decisionId: "dec_kill",
    decision: "deny",
    reasonCode: "policy.kill_switch",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: true,
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
    allowedPaths: ["/workspace", "/tmp"],
    deniedPaths: ["/etc", "/var", "/root"],
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowNetworkAccess: false,
  };

  const isAllowed = (path: string): boolean => {
    // Check denied paths first
    for (const denied of policy.deniedPaths) {
      if (path.startsWith(denied)) return false;
    }
    // Then check allowed paths
    for (const allowed of policy.allowedPaths) {
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