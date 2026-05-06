import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "admin-sdk", "index.ts"),
  "utf8",
);

test("AdminSdk exposes tenant, policy, domain lifecycle, rollout, and bulk management APIs", () => {
  const requiredMethods = [
    "listTenants",
    "getTenant",
    "createTenant",
    "updateTenant",
    "deleteTenant",
    "suspendTenant",
    "resumeTenant",
    "listPolicies",
    "getPolicy",
    "createPolicy",
    "updatePolicy",
    "deletePolicy",
    "attachPolicy",
    "detachPolicy",
    "listPolicyAttachments",
    "activateDomain",
    "deactivateDomain",
    "suspendDomain",
    "resumeDomain",
    "getDomainStatus",
    "listRollouts",
    "getRollout",
    "createRollout",
    "updateRollout",
    "pauseRollout",
    "resumeRollout",
    "cancelRollout",
    "getRolloutStatus",
    "rollbackRollout",
    "advanceRolloutPercentage",
    "bulkCreateTenants",
    "bulkUpdateTenants",
    "bulkDeleteTenants",
    "bulkCreatePolicies",
    "bulkAttachPolicies",
    "bulkDomainLifecycle",
  ];

  for (const methodName of requiredMethods) {
    assert.match(source, new RegExp(`\\b${methodName}\\b`), `missing method ${methodName}`);
  }
});
