import assert from "node:assert/strict";
import test from "node:test";

import {
  listGovernanceCapabilityBaselines,
  resolveGovernanceCapabilityBaseline,
} from "../../../src/org-governance/governance-baseline-catalog.js";
import * as approvalRouting from "../../../src/org-governance/approval-routing/index.js";
import * as complianceEngine from "../../../src/org-governance/compliance-engine/index.js";
import * as delegatedGovernance from "../../../src/org-governance/delegated-governance/index.js";
import * as governance from "../../../src/org-governance/index.js";
import * as knowledgeBoundary from "../../../src/org-governance/knowledge-boundary/index.js";
import * as orgModel from "../../../src/org-governance/org-model/index.js";
import * as ssoScim from "../../../src/org-governance/sso-scim/index.js";

test("governance baseline catalog covers all six governance capabilities", () => {
  const baselines = listGovernanceCapabilityBaselines();
  assert.equal(baselines.length, 6);
  assert.ok(resolveGovernanceCapabilityBaseline("sso-scim").baselineServices.includes("IdentitySyncService"));
  assert.ok(resolveGovernanceCapabilityBaseline("delegated-governance").baselineServices.includes("SelfServiceGovernanceConsole"));
});

test("governance baseline service names resolve from canonical submodule and root exports", () => {
  const exportsByCapabilityId = {
    "org-model": orgModel,
    "approval-routing": approvalRouting,
    "sso-scim": ssoScim,
    "compliance-engine": complianceEngine,
    "knowledge-boundary": knowledgeBoundary,
    "delegated-governance": delegatedGovernance,
  } as const;

  for (const baseline of listGovernanceCapabilityBaselines()) {
    const exportedModule = exportsByCapabilityId[baseline.capabilityId];
    for (const serviceName of baseline.baselineServices) {
      assert.equal(
        serviceName in exportedModule,
        true,
        `expected ${serviceName} to be exported by ${baseline.entryModule}`,
      );
      assert.equal(
        serviceName in governance,
        true,
        `expected ${serviceName} to be exported by src/org-governance/index.ts`,
      );
    }
  }
});
