import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ToolRiskEnforcer } from "../../../../../src/platform/five-plane-execution/tool-gateway/tool-risk-enforcer.js";

const yaml = [
  "toolId: refund",
  "actions:",
  "  - actionId: draft_refund",
  "    riskClass: R3",
  "    sideEffect: external_write",
  "    reversible: true",
  "    requiresHITL: true",
  "    requiresPreparedAction: true",
  "    rollbackPolicyRef: docs_zh/pilots/customer-service-pilot.md",
  "    dataClassesTouched: [customer_record]",
  "    allowedFamilies: [enterprise-ops]",
  "  - actionId: finalize_refund",
  "    riskClass: R5",
  "    sideEffect: external_write",
  "    reversible: false",
  "    requiresHITL: true",
  "    requiresPreparedAction: true",
  "    rollbackPolicyRef: docs_zh/pilots/customer-service-pilot.md",
  "    dataClassesTouched: [customer_record]",
  "    allowedFamilies: [enterprise-ops]",
].join("\n");

test("ToolRiskEnforcer requires HITL or prepared action for R3+ descriptors", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-tool-risk-"));
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "refund.yaml"), yaml, "utf8");
  const enforcer = new ToolRiskEnforcer({
    descriptorRoot: workspace,
  });

  try {
    const denied = enforcer.evaluate({
      toolName: "refund",
      actionId: "draft_refund",
      familyId: "enterprise-ops",
      requestSource: "trusted",
    });
    const allowed = enforcer.evaluate({
      toolName: "refund",
      actionId: "draft_refund",
      familyId: "enterprise-ops",
      requestSource: "trusted",
      hitlApproved: true,
    });

    assert.equal(denied.allow, false);
    assert.equal(denied.code, "tool_risk.hitl_or_prepared_action_required");
    assert.equal(allowed.allow, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("ToolRiskEnforcer denies R3 descriptors that require only prepared action", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-tool-risk-prepared-"));
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "github.yaml"), [
    "toolId: github",
    "actions:",
    "  - actionId: create_pr_draft",
    "    riskClass: R3",
    "    sideEffect: external_write",
    "    reversible: true",
    "    requiresHITL: false",
    "    requiresPreparedAction: true",
    "    rollbackPolicyRef: docs_zh/pilots/engineering-pilot.md",
    "    dataClassesTouched: [source_code]",
    "    allowedFamilies: [engineering]",
    "    trustedSourcesOnly: true",
  ].join("\n"), "utf8");
  const enforcer = new ToolRiskEnforcer({
    descriptorRoot: workspace,
  });

  try {
    const denied = enforcer.evaluate({
      toolName: "github",
      actionId: "create_pr_draft",
      familyId: "engineering",
      requestSource: "trusted",
    });
    const allowed = enforcer.evaluate({
      toolName: "github",
      actionId: "create_pr_draft",
      familyId: "engineering",
      requestSource: "trusted",
      preparedActionApproved: true,
    });

    assert.equal(denied.allow, false);
    assert.equal(denied.code, "tool_risk.prepared_action_required");
    assert.equal(allowed.allow, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("ToolRiskEnforcer denies autonomous R5 actions", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-tool-risk-r5-"));
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "refund.yaml"), yaml, "utf8");
  const enforcer = new ToolRiskEnforcer({
    descriptorRoot: workspace,
  });

  try {
    const denied = enforcer.evaluate({
      toolName: "refund",
      actionId: "finalize_refund",
      familyId: "enterprise-ops",
    });

    assert.equal(denied.allow, false);
    assert.equal(denied.code, "tool_risk.r5_autonomous_denied");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
