import assert from "node:assert/strict";
import test from "node:test";

import {
  validatePanicDirective,
  validateResumePlan,
  transitionAgentLifecycle,
  driftResponse,
  buildOpsMaturityRemediationEvidence,
  type PlatformPanicDirective,
  type ResumePlan,
  type AgentLifecycleState,
  type DriftSeverity,
} from "../../../src/ops-maturity/architecture-remediation.js";

test.describe("architecture-remediation", () => {
  test.describe("validatePanicDirective", () => {
    test("returns empty findings for valid directive with 2+ approvers and valid scope", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "dir-1",
        scope: "global",
        requiredApprovers: ["admin-1", "admin-2"],
        reason: "security incident",
      };
      const findings = validatePanicDirective(directive);
      assert.deepEqual(findings, []);
    });

    test("returns empty findings for valid directive with 3+ approvers", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "dir-1",
        scope: "tenant",
        requiredApprovers: ["admin-1", "admin-2", "admin-3"],
        reason: "capacity issue",
      };
      const findings = validatePanicDirective(directive);
      assert.deepEqual(findings, []);
    });

    test("returns finding when fewer than 2 approvers", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "dir-1",
        scope: "global",
        requiredApprovers: ["admin-1"],
        reason: "security incident",
      };
      const findings = validatePanicDirective(directive);
      assert.ok(findings.includes("panic.two_approvers_required"));
    });

    test("returns finding when scope is invalid", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "dir-1",
        scope: "invalid-scope" as "global",
        requiredApprovers: ["admin-1", "admin-2"],
        reason: "security incident",
      };
      const findings = validatePanicDirective(directive);
      assert.ok(findings.includes("panic.invalid_scope"));
    });

    test("returns multiple findings when both conditions fail", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "dir-1",
        scope: "invalid" as "global",
        requiredApprovers: ["admin-1"],
        reason: "security incident",
      };
      const findings = validatePanicDirective(directive);
      assert.equal(findings.length, 2);
      assert.ok(findings.includes("panic.two_approvers_required"));
      assert.ok(findings.includes("panic.invalid_scope"));
    });

    test("accepts domain scope as valid", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "dir-1",
        scope: "domain",
        requiredApprovers: ["admin-1", "admin-2"],
        reason: "drift detected",
      };
      const findings = validatePanicDirective(directive);
      assert.deepEqual(findings, []);
    });
  });

  test.describe("validateResumePlan", () => {
    test("returns empty findings for valid plan with 2+ platform_admin approvers", () => {
      const plan: ResumePlan = {
        resumePlanId: "plan-1",
        approvedBy: ["admin-1", "admin-2"],
        approverRoles: ["platform_admin", "platform_admin"],
        forensicSnapshotRef: "snap-1",
      };
      const findings = validateResumePlan(plan);
      assert.deepEqual(findings, []);
    });

    test("returns empty findings for plan with 3+ platform_admin approvers", () => {
      const plan: ResumePlan = {
        resumePlanId: "plan-1",
        approvedBy: ["admin-1", "admin-2", "admin-3"],
        approverRoles: ["platform_admin", "platform_admin", "platform_admin"],
        forensicSnapshotRef: "snap-1",
      };
      const findings = validateResumePlan(plan);
      assert.deepEqual(findings, []);
    });

    test("returns finding when fewer than 2 approvers", () => {
      const plan: ResumePlan = {
        resumePlanId: "plan-1",
        approvedBy: ["admin-1"],
        approverRoles: ["platform_admin"],
        forensicSnapshotRef: "snap-1",
      };
      const findings = validateResumePlan(plan);
      assert.ok(findings.includes("resume.platform_admin_two_person_rule_required"));
    });

    test("returns finding when approver has non-platform_admin role", () => {
      const plan: ResumePlan = {
        resumePlanId: "plan-1",
        approvedBy: ["admin-1", "admin-2"],
        approverRoles: ["platform_admin", "security_team"],
        forensicSnapshotRef: "snap-1",
      };
      const findings = validateResumePlan(plan);
      assert.ok(findings.includes("resume.platform_admin_two_person_rule_required"));
    });

    test("returns finding when no approvers have platform_admin role", () => {
      const plan: ResumePlan = {
        resumePlanId: "plan-1",
        approvedBy: ["admin-1", "admin-2"],
        approverRoles: ["security_team", "auditor"],
        forensicSnapshotRef: "snap-1",
      };
      const findings = validateResumePlan(plan);
      assert.ok(findings.includes("resume.platform_admin_two_person_rule_required"));
    });
  });

  test.describe("transitionAgentLifecycle", () => {
    test("allows draft -> canary transition", () => {
      assert.equal(transitionAgentLifecycle("draft", "canary"), true);
    });

    test("allows draft -> archived transition", () => {
      assert.equal(transitionAgentLifecycle("draft", "archived"), true);
    });

    test("allows canary -> active transition", () => {
      assert.equal(transitionAgentLifecycle("canary", "active"), true);
    });

    test("allows canary -> deprecated transition", () => {
      assert.equal(transitionAgentLifecycle("canary", "deprecated"), true);
    });

    test("allows active -> paused transition", () => {
      assert.equal(transitionAgentLifecycle("active", "paused"), true);
    });

    test("allows active -> deprecated transition", () => {
      assert.equal(transitionAgentLifecycle("active", "deprecated"), true);
    });

    test("allows paused -> active transition", () => {
      assert.equal(transitionAgentLifecycle("paused", "active"), true);
    });

    test("allows paused -> deprecated transition", () => {
      assert.equal(transitionAgentLifecycle("paused", "deprecated"), true);
    });

    test("allows deprecated -> archived transition", () => {
      assert.equal(transitionAgentLifecycle("deprecated", "archived"), true);
    });

    test("rejects archived -> any transition (terminal state)", () => {
      assert.equal(transitionAgentLifecycle("archived", "draft"), false);
      assert.equal(transitionAgentLifecycle("archived", "canary"), false);
      assert.equal(transitionAgentLifecycle("archived", "active"), false);
    });

    test("rejects invalid reverse transitions", () => {
      assert.equal(transitionAgentLifecycle("canary", "draft"), false);
      assert.equal(transitionAgentLifecycle("active", "canary"), false);
      assert.equal(transitionAgentLifecycle("paused", "active"), true); // this is valid actually
      assert.equal(transitionAgentLifecycle("deprecated", "active"), false);
    });

    test("rejects draft -> active (must go through canary)", () => {
      assert.equal(transitionAgentLifecycle("draft", "active"), false);
    });

    test("rejects draft -> paused", () => {
      assert.equal(transitionAgentLifecycle("draft", "paused"), false);
    });
  });

  test.describe("driftResponse", () => {
    test("returns pause_agent for high severity drift", () => {
      assert.equal(driftResponse("high"), "pause_agent");
    });

    test("returns require_review for medium severity drift", () => {
      assert.equal(driftResponse("medium"), "require_review");
    });

    test("returns alert for low severity drift", () => {
      assert.equal(driftResponse("low"), "alert");
    });
  });

  test.describe("buildOpsMaturityRemediationEvidence", () => {
    test("returns array of 20 evidence items", () => {
      const evidence = buildOpsMaturityRemediationEvidence();
      assert.equal(evidence.length, 20);
    });

    test("returns evidence in M-N format", () => {
      const evidence = buildOpsMaturityRemediationEvidence();
      assert.equal(evidence[0], "M-1");
      assert.equal(evidence[1], "M-2");
      assert.equal(evidence[9], "M-10");
      assert.equal(evidence[19], "M-20");
    });

    test("returns readonly array (type annotation, not runtime frozen)", () => {
      const evidence = buildOpsMaturityRemediationEvidence();
      // The readonly annotation is a TypeScript type, not runtime freezing
      assert.ok(Array.isArray(evidence));
      assert.equal(evidence.length, 20);
    });

    test("all evidence items are unique", () => {
      const evidence = buildOpsMaturityRemediationEvidence();
      const uniqueSet = new Set(evidence);
      assert.equal(uniqueSet.size, 20);
    });
  });
});