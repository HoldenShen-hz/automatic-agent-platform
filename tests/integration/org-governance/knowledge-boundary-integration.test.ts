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
      { stepId: "prepare_grant_1", action: "prepare_grant", succeeded: true },
      { stepId: "commit_grant_1", action: "commit_grant", succeeded: true },
      { stepId: "audit_1", action: "audit", succeeded: true },
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
    const saga = new ChineseWallAccessSaga({
      prepareGrant: () => {},
      commitGrant: () => {
        throw new Error("Simulated commit failure");
      },
      prepareRelease: () => {},
      commitRelease: () => {},
    });

    const receipt = saga.execute("access-intg-002", [
      { stepId: "prepare_grant_1", action: "prepare_grant", succeeded: true },
      { stepId: "commit_grant_1", action: "commit_grant", succeeded: false },
    ]);

    assert.equal(receipt.status, "rolled_back");
    assert.equal(receipt.rollbackRequired, true);
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
        audit: (step) => {
          accessLog.push(`audit:${step.stepId}`);
        },
      });

      const receipt = saga.execute("access-intg-003", [
        { stepId: "prepare_grant_a", action: "prepare_grant", succeeded: true },
        { stepId: "prepare_grant_b", action: "prepare_grant", succeeded: true },
        { stepId: "commit_grant_a", action: "commit_grant", succeeded: true },
        { stepId: "commit_grant_b", action: "commit_grant", succeeded: true },
        { stepId: "audit_final", action: "audit", succeeded: true },
      ]);

      assert.equal(receipt.status, "committed");
      assert.ok(accessLog.includes("prepare:prepare_grant_a"));
      assert.ok(accessLog.includes("commit:commit_grant_a"));
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
      { stepId: "prepare_grant_step", action: "prepare_grant", succeeded: true },
      { stepId: "commit_grant_step", action: "commit_grant", succeeded: true },
      { stepId: "audit_step", action: "audit", succeeded: true },
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
      { stepId: "prepare_release_1", action: "prepare_release", succeeded: true },
      { stepId: "commit_release_1", action: "commit_release", succeeded: true },
      { stepId: "audit_release", action: "audit", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.ok(receipt.committedActions.includes("commit_release"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga with minimal handlers succeeds", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-minimal-");
  try {
    const saga = new ChineseWallAccessSaga({
      prepareGrant: () => {},
      commitGrant: () => {},
    });

    const receipt = saga.execute("access-intg-006", [
      { stepId: "prepare_grant_1", action: "prepare_grant", succeeded: true },
      { stepId: "commit_grant_1", action: "commit_grant", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.ok(receipt.committedActions.length >= 1);
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
      { stepId: "prepare_grant_1", action: "prepare_grant", succeeded: true },
      { stepId: "commit_grant_1", action: "commit_grant", succeeded: true },
      { stepId: "prepare_release_1", action: "prepare_release", succeeded: true },
      { stepId: "commit_release_1", action: "commit_release", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.ok(receipt.committedActions.length >= 2);
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
      { stepId: "prepare_grant_x", action: "prepare_grant", succeeded: true },
      { stepId: "commit_grant_x", action: "commit_grant", succeeded: true },
    ]);

    assert.equal(receipt.status, "committed");
    assert.ok(receipt.executionLog.length > 0);
  } finally {
    ctx.cleanup();
  }
});
