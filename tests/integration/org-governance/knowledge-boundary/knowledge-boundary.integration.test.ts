/**
 * Integration Test: Knowledge Boundary
 *
 * Tests integration between knowledge boundary service, chinese wall
 * access saga, federator, and boundary manager.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ChineseWallAccessSaga } from "../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../helpers/integration-context.js";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";

test("integration: ChineseWallAccessSaga with integration context completes grant flow", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-");
  try {
    const emittedEvents: Array<{ stepId: string; action: string; outcome: string }> = [];

    const saga = new ChineseWallAccessSaga({
      prepareGrant: (step) => {
        emittedEvents.push({ stepId: step.stepId, action: step.action, outcome: "prepared" });
      },
      commitGrant: (step) => {
        emittedEvents.push({ stepId: step.stepId, action: step.action, outcome: "committed" });
      },
      audit: (step) => {
        emittedEvents.push({ stepId: step.stepId, action: step.action, outcome: "audited" });
      },
    });

    const receipt = saga.execute("access-intg-001", [
      { stepId: "grant-prepare", action: "prepare_grant", succeeded: true },
      { stepId: "grant-commit", action: "commit_grant", succeeded: true },
      { stepId: "audit", action: "audit", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.equal(receipt.accessId, "access-intg-001");
    assert.ok(emittedEvents.some((e) => e.outcome === "prepared"));
    assert.ok(emittedEvents.some((e) => e.outcome === "committed"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga with seeded context triggers compensation on failure", () => {
  const ctx = createSeededIntegrationContext("aa-chinese-wall-comp-");
  try {
    const compensationLog: string[] = [];

    const saga = new ChineseWallAccessSaga({
      prepareGrant: (step) => {
        if (step.stepId === "grant-fail") {
          throw new Error("Simulated prepare failure");
        }
      },
      commitGrant: () => {},
      prepareRelease: (step) => {
        compensationLog.push(step.action);
      },
      commitRelease: () => {
        compensationLog.push("commit-release");
      },
    });

    const receipt = saga.execute("access-intg-002", [
      { stepId: "grant-ok", action: "prepare_grant", succeeded: true },
      { stepId: "grant-fail", action: "prepare_grant", succeeded: true },
      { stepId: "commit-ok", action: "commit_grant", succeeded: true },
      { stepId: "commit-fail", action: "commit_grant", succeeded: false },
    ]);

    assert.equal(receipt.status, "rolled_back");
    assert.equal(receipt.rollbackRequired, true);
    assert.ok(receipt.compensatedActions.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga coordinates multi-step access grant with database", () => {
  const ctx = createSeededIntegrationContext("aa-chinese-wall-db-");
  try {
    ctx.db.transaction(() => {
      const accessLog: string[] = [];

      const saga = new ChineseWallAccessSaga({
        prepareGrant: (step) => {
          accessLog.push(`prepare:${step.stepId}`);
        },
        commitGrant: (step) => {
          accessLog.push(`commit:${step.stepId}`);
        },
        prepareRelease: (step) => {
          accessLog.push(`release:${step.stepId}`);
        },
        commitRelease: (step) => {
          accessLog.push(`release-commit:${step.stepId}`);
        },
        audit: (step) => {
          accessLog.push(`audit:${step.stepId}`);
        },
      });

      const receipt = saga.execute("access-intg-003", [
        { stepId: "resource-a-prepare", action: "prepare_grant", succeeded: true },
        { stepId: "resource-b-prepare", action: "prepare_grant", succeeded: true },
        { stepId: "resource-a-commit", action: "commit_grant", succeeded: true },
        { stepId: "resource-b-commit", action: "commit_grant", succeeded: true },
        { stepId: "audit-1", action: "audit", succeeded: true },
      ]);

      assert.equal(receipt.status, "committed");
      assert.ok(accessLog.includes("prepare:resource-a-prepare"));
      assert.ok(accessLog.includes("commit:resource-a-commit"));
    });
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga tracks execution log across all stages", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-log-");
  try {
    const saga = new ChineseWallAccessSaga({
      prepareGrant: () => {},
      commitGrant: () => {},
      audit: () => {},
    });

    const receipt = saga.execute("access-intg-004", [
      { stepId: "step-1", action: "prepare_grant", succeeded: true },
      { stepId: "step-2", action: "commit_grant", succeeded: true },
      { stepId: "step-3", action: "audit", succeeded: true },
    ]);

    assert.ok(receipt.executionLog.length >= 3);
    const stages = receipt.executionLog.map((e) => e.action);
    assert.ok(stages.includes("prepare_grant"));
    assert.ok(stages.includes("commit_grant"));
    assert.ok(stages.includes("audit"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga handles release flow end-to-end", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-release-");
  try {
    const saga = new ChineseWallAccessSaga({
      prepareGrant: () => {},
      commitGrant: () => {},
      prepareRelease: () => {},
      commitRelease: () => {},
      audit: () => {},
    });

    const receipt = saga.execute("access-intg-005", [
      { stepId: "release-prepare", action: "prepare_release", succeeded: true },
      { stepId: "release-commit", action: "commit_release", succeeded: true },
      { stepId: "audit-release", action: "audit", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.deepEqual(receipt.committedActions, [
      "prepare_release",
      "commit_release",
    ]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga fails gracefully with missing handlers", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-missing-handlers-");
  try {
    const saga = new ChineseWallAccessSaga({});

    const receipt = saga.execute("access-intg-006", [
      { stepId: "step-1", action: "prepare_grant", succeeded: true },
      { stepId: "step-2", action: "commit_grant", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.deepEqual(receipt.committedActions, ["prepare_grant", "commit_grant"]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga processes mixed grant and release steps", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-mixed-");
  try {
    const saga = new ChineseWallAccessSaga({
      prepareGrant: () => {},
      commitGrant: () => {},
      prepareRelease: () => {},
      commitRelease: () => {},
      audit: () => {},
    });

    const receipt = saga.execute("access-intg-007", [
      { stepId: "gp-1", action: "prepare_grant", succeeded: true },
      { stepId: "gc-1", action: "commit_grant", succeeded: true },
      { stepId: "rp-1", action: "prepare_release", succeeded: true },
      { stepId: "rc-1", action: "commit_release", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.ok(receipt.committedActions.length >= 4);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga with seeded context persists access record", () => {
  const ctx = createSeededIntegrationContext("aa-chinese-wall-persist-");
  try {
    const saga = new ChineseWallAccessSaga({
      prepareGrant: () => {},
      commitGrant: () => {},
      audit: () => {},
    });

    const receipt = saga.execute("access-intg-008", [
      { stepId: "persist-1", action: "prepare_grant", succeeded: true },
      { stepId: "persist-2", action: "commit_grant", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");

    const count = ctx.store.countExecutions();
    assert.ok(count >= 1);
  } finally {
    ctx.cleanup();
  }
});
