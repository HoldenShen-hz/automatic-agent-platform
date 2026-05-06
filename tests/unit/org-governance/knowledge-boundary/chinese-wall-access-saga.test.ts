import assert from "node:assert/strict";
import test from "node:test";

import { ChineseWallAccessSaga } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";
import type { ChineseWallAccessStep } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";

test("ChineseWallAccessSaga completes grant flow successfully", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => calls.push("prepareGrant"),
    commitGrant: () => calls.push("commitGrant"),
    audit: () => calls.push("audit"),
  });

  const receipt = saga.execute("access-1", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
    { stepId: "audit", action: "audit", succeeded: true },
  ]);

  assert.equal(receipt.status, "committed");
  assert.equal(receipt.accessId, "access-1");
  assert.deepEqual(receipt.committedActions, ["commit_grant"]);
  assert.deepEqual(receipt.rollbackRequired, false);
  assert.deepEqual(receipt.compensatedActions, []);
  assert.equal(receipt.failedAction, null);
});

test("ChineseWallAccessSaga rolls back when commit grant fails", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => calls.push("prepareGrant"),
    commitGrant: () => {
      calls.push("commitGrant");
      throw new Error("commit failed");
    },
    prepareRelease: () => calls.push("prepareRelease"),
    commitRelease: () => calls.push("commitRelease"),
  });

  const receipt = saga.execute("access-2", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: false },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.equal(receipt.rollbackRequired, true);
  assert.deepEqual(receipt.committedActions, []);
  assert.deepEqual(receipt.compensatedActions, ["prepare_release"]);
  assert.equal(receipt.failedAction, "commit_grant");
});

test("ChineseWallAccessSaga rolls back release path when commit release fails", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareRelease: () => calls.push("prepareRelease"),
    commitRelease: () => {
      calls.push("commitRelease");
      throw new Error("release failed");
    },
    prepareGrant: () => calls.push("prepareGrant"),
    commitGrant: () => calls.push("commitGrant"),
  });

  const receipt = saga.execute("access-3", [
    { stepId: "release-1", action: "prepare_release", succeeded: true },
    { stepId: "release-1", action: "commit_release", succeeded: false },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.equal(receipt.rollbackRequired, true);
  assert.deepEqual(receipt.compensatedActions, ["prepare_grant"]);
  assert.equal(receipt.failedAction, "commit_release");
});

test("ChineseWallAccessSaga rejects commit without prepare", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    commitGrant: () => calls.push("commitGrant"),
    prepareRelease: () => calls.push("prepareRelease"),
  });

  const receipt = saga.execute("access-4", [
    { stepId: "commit", action: "commit_grant", succeeded: true },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.equal(receipt.failedAction, "commit_grant");
  assert.ok(calls.length === 0);
});

test("ChineseWallAccessSaga handles multiple grant steps", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (step) => calls.push(`prepare:${step.stepId}`),
    commitGrant: (step) => calls.push(`commit:${step.stepId}`),
  });

  const receipt = saga.execute("access-5", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-2", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
    { stepId: "grant-2", action: "commit_grant", succeeded: true },
  ]);

  assert.equal(receipt.status, "committed");
  assert.deepEqual(receipt.committedActions, ["commit_grant", "commit_grant"]);
  assert.deepEqual(calls, ["prepare:grant-1", "prepare:grant-2", "commit:grant-1", "commit:grant-2"]);
});

test("ChineseWallAccessSaga handles mixed grant and release steps", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => calls.push("prepareGrant"),
    commitGrant: () => calls.push("commitGrant"),
    prepareRelease: () => calls.push("prepareRelease"),
    commitRelease: () => calls.push("commitRelease"),
  });

  const receipt = saga.execute("access-6", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
    { stepId: "release-1", action: "prepare_release", succeeded: true },
    { stepId: "release-1", action: "commit_release", succeeded: true },
  ]);

  assert.equal(receipt.status, "committed");
  assert.deepEqual(receipt.committedActions, [
    "commit_grant",
    "commit_release",
  ]);
});

test("ChineseWallAccessSaga compensates in reverse order on failure", () => {
  const calls: string[] = [];
  const compensationCalls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (step) => calls.push(`prepare:${step.stepId}`),
    commitGrant: (step) => calls.push(`commit:${step.stepId}`),
    prepareRelease: (step) => calls.push(`release:${step.stepId}`),
    commitRelease: (step) => calls.push(`release:${step.stepId}`),
    compensateGrant: (step) => compensationCalls.push(`compensateGrant:${step.stepId}:${step.action}`),
    compensateRelease: (step) => compensationCalls.push(`compensateRelease:${step.stepId}:${step.action}`),
  });

  const receipt = saga.execute("access-7", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-2", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
    { stepId: "grant-2", action: "commit_grant", succeeded: true },
    { stepId: "release-1", action: "commit_release", succeeded: false },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.deepEqual(receipt.committedActions, []);
  assert.deepEqual(receipt.compensatedActions, [
    "prepare_release",
    "prepare_release",
    "commit_release",
    "commit_release",
  ]);
  assert.ok(compensationCalls.includes("compensateGrant:access-7:prepare_release:prepare_release"));
});

test("ChineseWallAccessSaga execution log tracks all outcomes", () => {
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => {},
    commitGrant: () => {
      throw new Error("fail");
    },
    prepareRelease: () => {},
    commitRelease: () => {},
  });

  const receipt = saga.execute("access-8", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
  ]);

  const prepared = receipt.executionLog.filter((e) => e.outcome === "prepared");
  const failed = receipt.executionLog.filter((e) => e.outcome === "failed");
  const compensated = receipt.executionLog.filter((e) => e.outcome === "compensated");

  assert.ok(prepared.length > 0);
  assert.ok(failed.length > 0);
  assert.ok(compensated.length > 0);
});

test("ChineseWallAccessSaga provides correct context to handlers", () => {
  let capturedContext: { accessId: string; failedAction: string | null } | null = null;
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (_step, ctx) => {
      capturedContext = ctx;
    },
  });

  saga.execute("access-9", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
  ]);

  assert.notEqual(capturedContext, null);
  assert.equal(capturedContext!.accessId, "access-9");
  assert.equal(capturedContext!.failedAction, null);
});

test("ChineseWallAccessSaga updates context when failure occurs", () => {
  let capturedContexts: Array<{ accessId: string; failedAction: string | null }> = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (_step, ctx) => {
      capturedContexts.push({ ...ctx });
    },
    commitGrant: (_step, ctx) => {
      capturedContexts.push({ ...ctx });
      throw new Error("fail");
    },
    compensateGrant: (_step, ctx) => {
      capturedContexts.push({ ...ctx });
    },
  });

  saga.execute("access-10", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
  ]);

  const lastContext = capturedContexts[capturedContexts.length - 1];
  assert.equal(lastContext.failedAction, "commit_grant");
});

test("ChineseWallAccessSaga handles audit at end of successful flow", () => {
  const auditCalls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => {},
    commitGrant: () => {},
    audit: (step) => auditCalls.push(step.stepId),
  });

  const receipt = saga.execute("access-11", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
    { stepId: "audit-3", action: "audit", succeeded: true },
  ]);

  assert.equal(receipt.status, "committed");
  assert.deepEqual(auditCalls, ["audit-3"]);
});

test("ChineseWallAccessSaga skips uncommitted actions in rollback", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (step) => calls.push(`prepare:${step.stepId}`),
    commitGrant: (step) => calls.push(`commit:${step.stepId}`),
    prepareRelease: (step) => calls.push(`release:${step.stepId}`),
    commitRelease: (step) => calls.push(`release:${step.stepId}`),
  });

  const receipt = saga.execute("access-12", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
    { stepId: "grant-2", action: "commit_grant", succeeded: false },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.deepEqual(receipt.compensatedActions, ["prepare_release", "commit_release"]);
});

test("ChineseWallAccessSaga handles empty steps array", () => {
  const saga = new ChineseWallAccessSaga({});

  const receipt = saga.execute("access-13", []);

  assert.equal(receipt.status, "committed");
  assert.deepEqual(receipt.committedActions, []);
  assert.deepEqual(receipt.compensatedActions, []);
  assert.equal(receipt.failedAction, null);
});

test("ChineseWallAccessSaga handles missing optional handlers gracefully", () => {
  const saga = new ChineseWallAccessSaga({});

  const receipt = saga.execute("access-14", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
  ]);

  assert.equal(receipt.status, "committed");
});

test("ChineseWallAccessSaga step succeeded flag is checked", () => {
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => {},
    commitGrant: () => {},
  });

  const receipt = saga.execute("access-15", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: false },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.equal(receipt.failedAction, "commit_grant");
});

test("ChineseWallAccessSaga receipt contains all expected fields", () => {
  const saga = new ChineseWallAccessSaga({});
  const receipt = saga.execute("access-16", [
    { stepId: "grant-1", action: "prepare_grant", succeeded: true },
    { stepId: "grant-1", action: "commit_grant", succeeded: true },
  ]);

  assert.ok("accessId" in receipt);
  assert.ok("status" in receipt);
  assert.ok("committedActions" in receipt);
  assert.ok("rollbackRequired" in receipt);
  assert.ok("compensatedActions" in receipt);
  assert.ok("failedAction" in receipt);
  assert.ok("executionLog" in receipt);
});
