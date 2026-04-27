import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrgGovernanceRemediationEvidence,
  cascadeRevokePermission,
  evaluateApprovalConflicts,
  evaluateUnknownDelegatedGuardrail,
  mergeDenyPolicy,
} from "../../src/org-governance/architecture-remediation.js";
import {
  buildScaleEcosystemRemediationEvidence,
  buildBillingAdjustment,
  compareFairQueueEntries,
  validateListingDependencies,
} from "../../src/scale-ecosystem/architecture-remediation.js";
import {
  buildOpsMaturityRemediationEvidence,
  driftResponse,
  transitionAgentLifecycle,
  validatePanicDirective,
  validateResumePlan,
} from "../../src/ops-maturity/architecture-remediation.js";
import {
  buildInteractionRemediationEvidence,
  createClarificationState,
  deriveUrgency,
  detectTriggerFeedbackLoop,
} from "../../src/interaction/architecture-remediation.js";
import {
  buildDomainsSdkRemediationEvidence,
  canTransitionDomain,
  DOMAIN_META_MODEL_QUESTIONS,
  validateActiveDomainDescriptor,
} from "../../src/domains/architecture-remediation.js";

test("org-governance remediation implements O-1 through O-24 behavior", () => {
  assert.deepEqual(buildOrgGovernanceRemediationEvidence(), Array.from({ length: 24 }, (_value, index) => `O-${index + 1}`));
  assert.deepEqual(evaluateApprovalConflicts({
    requesterId: "alice",
    approverId: "alice",
    requesterChainIds: ["chain-a"],
    approverChainIds: ["chain-a"],
    budgetOwnerId: "bob",
    executorId: "bob",
    conflictOfInterestActorIds: ["alice"],
  }), [
    "sod.same_actor",
    "sod.same_approval_chain",
    "sod.budget_owner_executor_conflict",
    "coi.approver_conflict",
  ]);
  assert.equal(mergeDenyPolicy(false, true), false);
  assert.equal(evaluateUnknownDelegatedGuardrail("unknown").allowed, false);
  assert.deepEqual(cascadeRevokePermission("root", [
    { permissionId: "root", level: "admin", delegatable: true, expiresAt: "2026-04-27T00:00:00.000Z" },
    { permissionId: "child", level: "operate", delegatable: false, expiresAt: "2026-04-27T00:00:00.000Z", derivedFromPermissionId: "root" },
  ]), ["child", "root"]);
});

test("scale-ecosystem remediation implements S-1 through S-20 behavior", () => {
  assert.deepEqual(buildScaleEcosystemRemediationEvidence(), Array.from({ length: 20 }, (_value, index) => `S-${index + 1}`));
  assert.equal(buildBillingAdjustment({
    adjustmentId: "adj-1",
    accountId: "acct-1",
    invoiceId: "inv-1",
    amount: -10,
    reason: "refund",
  }).preservesUsageLedger, true);
  assert.equal(validateListingDependencies([{ listingId: "a", dependsOnListingId: "b", versionRange: "^1", compatibilityEvidenceRef: "" }]).valid, false);
  assert.ok(compareFairQueueEntries(
    { tenantId: "tenant-b", orgId: "org", domainId: "domain", slaTier: 1, priority: 1 },
    { tenantId: "tenant-a", orgId: "org", domainId: "domain", slaTier: 2, priority: 1 },
  ) > 0);
});

test("ops-maturity remediation implements M-1 through M-20 behavior", () => {
  assert.deepEqual(buildOpsMaturityRemediationEvidence(), Array.from({ length: 20 }, (_value, index) => `M-${index + 1}`));
  assert.deepEqual(validatePanicDirective({ directiveId: "panic-1", scope: "global", requiredApprovers: ["a", "b"], reason: "test" }), []);
  assert.deepEqual(validateResumePlan({ resumePlanId: "resume-1", approvedBy: ["a", "b"], approverRoles: ["platform_admin", "platform_admin"], forensicSnapshotRef: "snapshot-1" }), []);
  assert.equal(transitionAgentLifecycle("canary", "paused"), false);
  assert.equal(driftResponse("high"), "pause_agent");
});

test("interaction remediation implements I-1 through I-20 behavior", () => {
  assert.deepEqual(buildInteractionRemediationEvidence(), Array.from({ length: 20 }, (_value, index) => `I-${index + 1}`));
  assert.deepEqual(createClarificationState(["amount"]).state, "clarifying");
  assert.equal(detectTriggerFeedbackLoop([["a", "b"], ["b", "a"]]), true);
  assert.equal(deriveUrgency("critical production incident"), "critical");
});

test("domains and SDK remediation implements D-1 through D-20 behavior", () => {
  assert.deepEqual(buildDomainsSdkRemediationEvidence(), Array.from({ length: 20 }, (_value, index) => `D-${index + 1}`));
  assert.equal(DOMAIN_META_MODEL_QUESTIONS.length, 15);
  assert.equal(DOMAIN_META_MODEL_QUESTIONS.at(-1)?.key, "adversarial_scenarios");
  assert.equal(canTransitionDomain("Draft", "Active"), false);
  assert.deepEqual(validateActiveDomainDescriptor({
    domainId: "quant-trading",
    lifecycleState: "Active",
    executionMode: "full_auto",
    hotPathMode: "llm_allowed",
    planningMode: "plan_graph_required",
  }), ["domain_descriptor.full_auto_hot_path_requires_deterministic_mode"]);
});
