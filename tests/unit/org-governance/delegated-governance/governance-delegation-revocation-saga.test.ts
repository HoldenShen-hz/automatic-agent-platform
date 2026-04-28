import assert from "node:assert/strict";
import test from "node:test";

import { GovernanceDelegationRevocationSaga } from "../../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";

test("GovernanceDelegationRevocationSaga executes prepare commit and audit handlers", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (resourceId) => calls.push(`freeze:${resourceId}`),
    revokeDerivedDelegation: (delegationId) => calls.push(`revoke:${delegationId}`),
    audit: (receipt) => calls.push(`audit:${receipt.delegationId}`),
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: 0,
    derivedResourceIds: ["approval-1", "token-1"],
    derivedDelegationIds: ["delegation-1-child"],
  }, 30_000);

  assert.equal(receipt.status, "completed");
  assert.deepEqual(calls, [
    "freeze:approval-1",
    "freeze:token-1",
    "revoke:delegation-1-child",
    "audit:delegation-1",
  ]);
});

test("GovernanceDelegationRevocationSaga compensates frozen resources when commit fails", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (resourceId) => calls.push(`freeze:${resourceId}`),
    revokeDerivedDelegation: (delegationId) => {
      calls.push(`revoke:${delegationId}`);
      throw new Error("revoke.failed");
    },
    compensateResource: (resourceId) => calls.push(`compensate:${resourceId}`),
  });

  const receipt = saga.revoke({
    delegationId: "delegation-2",
    requestedAtMs: 0,
    derivedResourceIds: ["approval-1", "token-1"],
    derivedDelegationIds: ["delegation-2-child"],
  }, 45_000);

  assert.equal(receipt.status, "compensated");
  assert.equal(receipt.failedStage, "commit");
  assert.deepEqual(receipt.compensationResourceIds, ["token-1", "approval-1"]);
  assert.deepEqual(calls, [
    "freeze:approval-1",
    "freeze:token-1",
    "revoke:delegation-2-child",
    "compensate:token-1",
    "compensate:approval-1",
  ]);
});
