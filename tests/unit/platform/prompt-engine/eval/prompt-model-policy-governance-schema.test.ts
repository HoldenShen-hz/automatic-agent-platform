import assert from "node:assert/strict";
import test from "node:test";

import { LLM_EVAL_DDL, PROMPT_MODEL_POLICY_GOVERNANCE_DDL } from "../../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-schema.js";

test("LLM_EVAL_DDL contains eval_suites table", () => {
  assert.ok(LLM_EVAL_DDL.includes("CREATE TABLE"));
  assert.ok(LLM_EVAL_DDL.includes("eval_suites"));
  assert.ok(LLM_EVAL_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(LLM_EVAL_DDL.includes("name TEXT NOT NULL UNIQUE"));
});

test("LLM_EVAL_DDL contains eval_runs table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_runs"));
  assert.ok(LLM_EVAL_DDL.includes("suite_id TEXT NOT NULL"));
  assert.ok(LLM_EVAL_DDL.includes("model_id TEXT NOT NULL"));
  assert.ok(LLM_EVAL_DDL.includes("status TEXT NOT NULL DEFAULT 'pending'"));
  assert.ok(LLM_EVAL_DDL.includes("verdict TEXT NOT NULL DEFAULT 'inconclusive'"));
});

test("LLM_EVAL_DDL contains eval_case_results table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_case_results"));
  assert.ok(LLM_EVAL_DDL.includes("run_id TEXT NOT NULL"));
  assert.ok(LLM_EVAL_DDL.includes("case_id TEXT NOT NULL"));
  assert.ok(LLM_EVAL_DDL.includes("score REAL NOT NULL DEFAULT 0"));
  assert.ok(LLM_EVAL_DDL.includes("passed INTEGER NOT NULL DEFAULT 0"));
});

test("LLM_EVAL_DDL contains required indexes", () => {
  assert.ok(LLM_EVAL_DDL.includes("idx_eval_runs_suite_model"));
  assert.ok(LLM_EVAL_DDL.includes("idx_eval_case_results_run"));
});

test("LLM_EVAL_DDL has correct default values", () => {
  assert.ok(LLM_EVAL_DDL.includes("kind TEXT NOT NULL DEFAULT 'golden'"));
  assert.ok(LLM_EVAL_DDL.includes("status TEXT NOT NULL DEFAULT 'pending'"));
  assert.ok(LLM_EVAL_DDL.includes("verdict TEXT NOT NULL DEFAULT 'inconclusive'"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains governance_releases table", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("governance_releases"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("release_type TEXT NOT NULL"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("object_key TEXT NOT NULL"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("version TEXT NOT NULL"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("status TEXT NOT NULL DEFAULT 'draft'"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains governance_gate_events table", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("governance_gate_events"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("release_id TEXT NOT NULL"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("decision TEXT NOT NULL"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("verdict TEXT NOT NULL"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("passed INTEGER NOT NULL DEFAULT 0"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains required indexes", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("idx_governance_release_unique"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("idx_governance_release_lookup"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("idx_governance_gate_release"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL has correct default values", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("review_required INTEGER NOT NULL DEFAULT 1"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("rollout_scope TEXT NOT NULL DEFAULT 'canary'"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("status TEXT NOT NULL DEFAULT 'draft'"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("metadata TEXT NOT NULL DEFAULT '{}'"));
});

test("LLM_EVAL_DDL does not contain governance tables", () => {
  assert.ok(!LLM_EVAL_DDL.includes("governance_releases"));
  assert.ok(!LLM_EVAL_DDL.includes("governance_gate_events"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL does not contain eval tables", () => {
  assert.ok(!PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("eval_suites"));
  assert.ok(!PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("eval_runs"));
  assert.ok(!PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("eval_case_results"));
});
