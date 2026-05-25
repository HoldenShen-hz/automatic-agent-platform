import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ChineseWallAccessSaga } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";

test("ChineseWallAccessSaga executes grant path and audit handlers", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => calls.push("prepare_grant"),
    commitGrant: () => calls.push("commit_grant"),
    audit: () => calls.push("audit"),
  });

  const receipt = saga.execute("access-1", [
    { stepId: "prepare", action: "prepare_grant", succeeded: true },
    { stepId: "commit", action: "commit_grant", succeeded: true },
    { stepId: "audit", action: "audit", succeeded: true },
  ]);

  assert.equal(receipt.status, "committed");
  assert.deepEqual(calls, ["prepare_grant", "commit_grant", "audit"]);
});

test("ChineseWallAccessSaga executes release compensation when grant commit fails", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => calls.push("prepare_grant"),
    compensateGrant: () => calls.push("compensate_grant"),
  });

  const receipt = saga.execute("access-2", [
    { stepId: "prepare", action: "prepare_grant", succeeded: true },
    { stepId: "prepare", action: "commit_grant", succeeded: false },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.deepEqual(receipt.compensatedActions, ["prepare_grant"]);
  assert.deepEqual(calls, ["prepare_grant", "compensate_grant"]);
});

test("ChineseWallAccessSaga logs failed workflow steps instead of silently suppressing them", () => {
  const source = readFileSync("src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts", "utf8");

  assert.match(source, /chineseWallAccessSagaLogger\.warn\("chinese_wall_access_saga\.step_failed"/);
});
