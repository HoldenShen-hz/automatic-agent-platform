import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for evaluation module
import {
  LLM_EVAL_DDL,
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
} from "../../../../../src/platform/prompt-engine/eval/index.js";

test("LLM_EVAL_DDL is a non-empty string", () => {
  assert.ok(typeof LLM_EVAL_DDL === "string");
  assert.ok(LLM_EVAL_DDL.length > 0);
  assert.ok(LLM_EVAL_DDL.includes("CREATE TABLE"));
});

test("LLM_EVAL_DDL contains eval_suites table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_suites"));
  assert.ok(LLM_EVAL_DDL.includes("id TEXT PRIMARY KEY"));
});

test("LLM_EVAL_DDL contains eval_runs table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_runs"));
  assert.ok(LLM_EVAL_DDL.includes("suite_id"));
});

test("LLM_EVAL_DDL contains eval_case_results table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_case_results"));
  assert.ok(LLM_EVAL_DDL.includes("run_id"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL is a non-empty string", () => {
  assert.ok(typeof PROMPT_MODEL_POLICY_GOVERNANCE_DDL === "string");
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.length > 0);
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("CREATE TABLE"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains governance_releases table", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("governance_releases"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("release_type"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains governance_gate_events table", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("governance_gate_events"));
});
