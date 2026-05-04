import assert from "node:assert/strict";
import test from "node:test";

import { DelegatedGovernanceService } from "../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

function createDelegation(overrides: Partial<GovernanceDelegation> = {}): GovernanceDelegation {
  return {
    delegationId: "delegation-1",
    grantorId: "division-admin-1",
    granteeId: "division-admin-2",
    level: "admin",
    delegatable: false,
    orgNodeIds: ["org-1"],
    domainIds: ["domain-1"],
    derivedDelegationIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2099-12-31T23:59:59.000Z",
    revocable: true,
    status: "active",
    ...overrides,
  };
}

test("checkOperation denies when guardrails exist but attemptedValue is omitted", () => {
  const service = new DelegatedGovernanceService([
    createDelegation({
      guardrails: [
        {
          guardrailId: "budget-cap",
          type: "max_budget",
          value: 1000,
        },
      ],
    }),
  ]);

  const result = service.checkOperation({
    actorId: "actor-1",
    actorRole: "division_admin",
    orgNodeId: "org-1",
    domainId: "domain-1",
  }, "domain_onboarding");

  assert.equal(result.allowed, false);
  assert.deepEqual(result.violatedGuardrails, ["budget-cap"]);
});

test("checkOperation applies scoped non-platform guardrails", () => {
  const service = new DelegatedGovernanceService([
    createDelegation({
      grantorId: "division-admin-1",
      guardrails: [
        {
          guardrailId: "division-budget-cap",
          type: "max_budget",
          value: 1000,
        },
      ],
    }),
  ]);

  const result = service.checkOperation({
    actorId: "actor-1",
    actorRole: "platform_team",
    orgNodeId: "org-1",
    domainId: "domain-1",
  }, "approve_budget_increase", 5000);

  assert.equal(result.allowed, false);
  assert.deepEqual(result.violatedGuardrails, ["division-budget-cap"]);
});

test("validateInheritanceRule forbids lower roles from deleting parent constraints", () => {
  const service = new DelegatedGovernanceService([]);

  const childDelete = service.validateInheritanceRule("division_admin", "team_lead", "delete");
  const sameLevelDelete = service.validateInheritanceRule("division_admin", "division_admin", "delete");

  assert.equal(childDelete.allowed, false);
  assert.match(childDelete.reason, /Cannot delete parent role constraints/);
  assert.equal(sameLevelDelete.allowed, true);
});
