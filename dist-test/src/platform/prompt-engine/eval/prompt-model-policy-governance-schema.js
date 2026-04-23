/**
 * Database schema definitions for LLM evaluation and prompt/model/policy governance.
 *
 * Provides SQL DDL for:
 * - eval_suites: Evaluation test suites containing golden test cases
 * - eval_runs: Individual evaluation run records with scores and verdicts
 * - eval_case_results: Individual test case results within a run
 * - governance_releases: Releases of prompts, models, or policies awaiting evaluation
 * - governance_gate_events: CI gate decisions and their outcomes
 */
export const LLM_EVAL_DDL = `
CREATE TABLE IF NOT EXISTS eval_suites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'golden',
  description TEXT NOT NULL DEFAULT '',
  cases TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'pending',
  total_cases INTEGER NOT NULL DEFAULT 0,
  passed_cases INTEGER NOT NULL DEFAULT 0,
  failed_cases INTEGER NOT NULL DEFAULT 0,
  average_score REAL NULL,
  verdict TEXT NOT NULL DEFAULT 'inconclusive',
  started_at TEXT NOT NULL,
  completed_at TEXT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'ci',
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_eval_runs_suite_model ON eval_runs(suite_id, model_id, started_at);

CREATE TABLE IF NOT EXISTS eval_case_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL DEFAULT '',
  actual_output TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_eval_case_results_run ON eval_case_results(run_id);
`;
export const PROMPT_MODEL_POLICY_GOVERNANCE_DDL = `
CREATE TABLE IF NOT EXISTS governance_releases (
  id TEXT PRIMARY KEY,
  release_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  version TEXT NOT NULL,
  owner TEXT NOT NULL,
  review_required INTEGER NOT NULL DEFAULT 1,
  rollout_scope TEXT NOT NULL DEFAULT 'canary',
  rollback_version TEXT NULL,
  evaluation_suite_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_release_unique
  ON governance_releases(release_type, object_key, version);
CREATE INDEX IF NOT EXISTS idx_governance_release_lookup
  ON governance_releases(release_type, object_key, status, updated_at);

CREATE TABLE IF NOT EXISTS governance_gate_events (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  suite_id TEXT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  baseline_prompt_version TEXT NULL,
  decision TEXT NOT NULL,
  verdict TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  should_degrade INTEGER NOT NULL DEFAULT 0,
  recommended_fallback_key TEXT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_governance_gate_release
  ON governance_gate_events(release_id, created_at);
`;
//# sourceMappingURL=prompt-model-policy-governance-schema.js.map