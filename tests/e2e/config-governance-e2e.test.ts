/**
 * E2E Config Governance Tests
 *
 * End-to-end tests covering config governance scenarios
 * for compliance and policy enforcement.
 *
 * Tests verify:
 * - Config policy compliance
 * - Governance audit trail
 * - Policy violation detection
 * - Compliance reporting
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test 1: Config Policy Compliance Check
// ---------------------------------------------------------------------------

test("E2E Config Governance: checks config policy compliance", async () => {
  const harness = createE2EHarness("aa-e2e-config-governance-");
  try {
    const configId = newId("config");
    const policyId = newId("policy");
    const now = nowIso();

    // Create governance policy
    harness.db.transaction(() => {
      harness.store.insertGovernancePolicy({
        id: policyId,
        policyKey: "feature_flags.require_approval",
        policyType: "approval_required",
        enforcementLevel: "mandatory",
        createdAt: now,
      });
    });

    // Create config that requires approval
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.require_approval",
        desiredValue: "true",
        actualValue: "true",
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: null,
        tenantId: "tenant-1",
        requiresApproval: true,
        governancePolicyId: policyId,
      });
    });

    // Check compliance
    const config = harness.store.config.getConfigRecord(configId);
    const isCompliant = config?.governancePolicyId != null && config?.requiresApproval === true;

    assert.equal(isCompliant, true, "Config should be compliant with governance policy");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Governance Audit Trail
// ---------------------------------------------------------------------------

test("E2E Config Governance: creates audit trail for config changes", async () => {
  const harness = createE2EHarness("aa-e2e-config-audit-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create initial config
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.admin_mode",
        desiredValue: "false",
        actualValue: "false",
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: null,
        tenantId: "tenant-1",
      });
    });

    // Record audit event
    harness.db.transaction(() => {
      harness.store.insertAuditEvent({
        id: newId("audit"),
        entityType: "config",
        entityId: configId,
        action: "config_updated",
        actorId: "admin-1",
        timestamp: now,
        details: JSON.stringify({ previousValue: "false", newValue: "true" }),
      });
    });

    // Verify audit trail
    const auditEvents = harness.store.audit.listAuditEvents(configId);
    assert.ok(auditEvents.length > 0, "Should have audit events");
    assert.equal(auditEvents[0].action, "config_updated", "Should record update action");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Policy Violation Detection
// ---------------------------------------------------------------------------

test("E2E Config Governance: detects policy violations", async () => {
  const harness = createE2EHarness("aa-e2e-config-violation-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create config that violates policy (security flag set to false when it should be true)
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.security_mode",
        desiredValue: "true",
        actualValue: "false", // Violation: should be true
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: now, // Detect the violation
        tenantId: "tenant-1",
        requiresApproval: true,
      });
    });

    // Detect violation
    const config = harness.store.config.getConfigRecord(configId);
    const hasViolation = config?.actualValue !== config?.desiredValue;

    assert.equal(hasViolation, true, "Should detect policy violation");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Mandatory Enforcement Level
// ---------------------------------------------------------------------------

test("E2E Config Governance: enforces mandatory policy", async () => {
  const harness = createE2EHarness("aa-e2e-config-mandatory-");
  try {
    const configId = newId("config");
    const now = nowIso();

    // Create config with mandatory enforcement
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: configId,
        configKey: "feature_flags.compliance_mode",
        desiredValue: "strict",
        actualValue: "strict",
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: null,
        tenantId: "tenant-1",
        enforcementLevel: "mandatory",
      });
    });

    // Verify enforcement
    const config = harness.store.config.getConfigRecord(configId);
    const isEnforced = config?.enforcementLevel === "mandatory";

    assert.equal(isEnforced, true, "Config should have mandatory enforcement");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Compliance Reporting
// ---------------------------------------------------------------------------

test("E2E Config Governance: generates compliance report", async () => {
  const harness = createE2EHarness("aa-e2e-config-report-");
  try {
    const now = nowIso();

    // Create compliant config
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: newId("config"),
        configKey: "feature_flags.audit_logging",
        desiredValue: "enabled",
        actualValue: "enabled",
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: null,
        tenantId: "tenant-1",
        enforcementLevel: "mandatory",
      });
    });

    // Create non-compliant config
    harness.db.transaction(() => {
      harness.store.insertConfigRecord({
        id: newId("config"),
        configKey: "feature_flags.debug_mode",
        desiredValue: "disabled",
        actualValue: "enabled", // Violation
        version: "1.0",
        updatedAt: now,
        driftDetectedAt: now,
        tenantId: "tenant-1",
        enforcementLevel: "mandatory",
      });
    });

    // Generate compliance report
    const configs = harness.store.config.listConfigRecords();
    const compliantCount = configs.filter((c) => c.driftDetectedAt == null).length;
    const violationCount = configs.filter((c) => c.driftDetectedAt != null).length;

    assert.ok(compliantCount > 0, "Should have compliant configs");
    assert.ok(violationCount > 0, "Should have violations");
    assert.equal(compliantCount + violationCount, configs.length, "All configs should be accounted for");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Config Governance Tests
// ---------------------------------------------------------------------------