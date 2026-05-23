import assert from "node:assert/strict";
import test from "node:test";

import * as improvement from "../../../../src/ops-maturity/improvement/index.js";
import {
  PromotionGate,
  DEFAULT_PROMOTION_GATE_CONFIG,
} from "../../../../src/ops-maturity/drift-detection/learning/promotion-gate.js";
import { SimpleProposalEngine } from "../../../../src/ops-maturity/drift-detection/learning/proposal-engine.js";
import {
  applyRolloutSchema,
  DEFAULT_ROLLOUT_THRESHOLDS,
  getRolloutSchemaSql,
  PersistentRolloutManager,
  SimpleRolloutManager,
} from "../../../../src/ops-maturity/drift-detection/learning/rollout-manager.js";

test("ops-maturity improvement barrel re-exports learning improvement primitives", () => {
  assert.equal(improvement.PromotionGate, PromotionGate);
  assert.equal(improvement.DEFAULT_PROMOTION_GATE_CONFIG, DEFAULT_PROMOTION_GATE_CONFIG);
  assert.equal(improvement.SimpleProposalEngine, SimpleProposalEngine);
  assert.equal(improvement.PersistentRolloutManager, PersistentRolloutManager);
  assert.equal(improvement.SimpleRolloutManager, SimpleRolloutManager);
  assert.equal(improvement.getRolloutSchemaSql, getRolloutSchemaSql);
  assert.equal(improvement.applyRolloutSchema, applyRolloutSchema);
  assert.equal(improvement.DEFAULT_ROLLOUT_THRESHOLDS, DEFAULT_ROLLOUT_THRESHOLDS);
});

test("ops-maturity improvement barrel exports remain operational", () => {
  const gate = new improvement.PromotionGate();
  const engine = new improvement.SimpleProposalEngine();
  const sql = improvement.getRolloutSchemaSql();
  let appliedSql = "";

  improvement.applyRolloutSchema({
    exec(statement: string) {
      appliedSql = statement;
    },
  });

  assert.equal(gate.canAutoPromote({
    id: "prop_auto",
    title: "Route docs",
    description: "Improve docs routing",
    kind: "skill_doc",
    target: "docs",
    patch: "patch",
    rationale: "rationale",
    risk: "low",
    reviewRequirement: "auto",
    evidenceIds: [],
    status: "draft",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    draftedAt: "2026-05-23T00:00:00.000Z",
  }), true);
  assert.equal(typeof engine.create, "function");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rollout_records/);
  assert.equal(appliedSql, sql);
});
