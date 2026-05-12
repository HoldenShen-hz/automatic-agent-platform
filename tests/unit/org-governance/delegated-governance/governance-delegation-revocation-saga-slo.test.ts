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

test("GovernanceDelegationRevocationSaga marks cascadeWithinSlo true when no cascade is requested but operation succeeds", () => {
  const saga = new GovernanceDelegationRevocationSaga();

  const receipt = saga.revoke({
    delegationId: "delegation-no-cascade",
    requestedAtMs: 0,
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: [],
    cascadeScope: 0,
  }, 30_000);

  assert.equal(receipt.failedStage, null);
  assert.equal(receipt.cascadeWithinSlo, true);
  assert.equal(receipt.cascadeDepthApplied, 0);
});

test("GovernanceDelegationRevocationSaga marks cascadeWithinSlo true when cascade is within scope and SLO", () => {
  const saga = new GovernanceDelegationRevocationSaga();

  const receipt = saga.revoke({
    delegationId: "delegation-cascade-success",
    requestedAtMs: 0,
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: ["child-1"],
    cascadeScope: 1,
  }, 30_000);

  assert.equal(receipt.failedStage, null);
  assert.equal(receipt.cascadeWithinSlo, true);
  assert.equal(receipt.cascadeDepthApplied, 1);
});
