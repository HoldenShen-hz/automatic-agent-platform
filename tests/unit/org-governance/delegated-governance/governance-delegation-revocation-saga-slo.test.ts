import assert from "node:assert/strict";
import test from "node:test";

import { GovernanceDelegationRevocationSaga } from "../../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";

test("GovernanceDelegationRevocationSaga marks cascadeWithinSlo false when revocation overruns cascade SLO", () => {
  const saga = new GovernanceDelegationRevocationSaga();

  const receipt = saga.revoke({
    delegationId: "delegation-over-slo",
    requestedAtMs: 0,
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: [],
  }, 350_001);

  assert.equal(receipt.revokeWithinSlo, false);
  assert.equal(receipt.cascadeWithinSlo, false);
});

test("GovernanceDelegationRevocationSaga marks cascadeWithinSlo false when a stage fails", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    revokeDerivedDelegation: () => {
      throw new Error("commit failed");
    },
  });

  const receipt = saga.revoke({
    delegationId: "delegation-failed",
    requestedAtMs: 0,
    derivedResourceIds: [],
    derivedDelegationIds: ["child-1"],
  }, 30_000);

  assert.equal(receipt.failedStage, "commit");
  assert.equal(receipt.cascadeWithinSlo, false);
});
