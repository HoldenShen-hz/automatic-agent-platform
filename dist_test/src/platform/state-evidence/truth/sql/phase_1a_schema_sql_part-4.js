export const PHASE_1A_SCHEMA_SQL_PART_4 = `

CREATE TABLE IF NOT EXISTS intel_items (
  intel_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_ref TEXT NOT NULL,
  relevance_score REAL NOT NULL,
  importance REAL NOT NULL,
  tags_json TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  expires_at TEXT NULL,
  FOREIGN KEY(source_id) REFERENCES perception_sources(source_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intel_items_source_dedupe_key
  ON intel_items(source_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_intel_items_captured_at
  ON intel_items(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_items_importance_relevance
  ON intel_items(importance DESC, relevance_score DESC, captured_at DESC);

CREATE TABLE IF NOT EXISTS intel_briefs (
  brief_id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  source_scope_json TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  overall_summary TEXT NOT NULL,
  recommended_actions_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intel_briefs_generated_at
  ON intel_briefs(generated_at DESC);

CREATE TABLE IF NOT EXISTS action_proposals (
  proposal_id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  intel_id TEXT NULL,
  task_id TEXT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  requires_approval INTEGER NOT NULL,
  proposal_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT NULL,
  FOREIGN KEY(brief_id) REFERENCES intel_briefs(brief_id) ON DELETE CASCADE,
  FOREIGN KEY(intel_id) REFERENCES intel_items(intel_id) ON DELETE SET NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_action_proposals_brief_created_at
  ON action_proposals(brief_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_proposals_status_created_at
  ON action_proposals(status, created_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  step_id TEXT NULL,
  kind TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT NULL,
  lineage_json TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_task_created_at ON artifacts(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_execution_created_at ON artifacts(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_step_id ON artifacts(task_id, step_id, created_at);

CREATE TABLE IF NOT EXISTS tool_result_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  tool_name TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  output_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_result_files_task_id ON tool_result_files(task_id);

CREATE TABLE IF NOT EXISTS takeover_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  operator_id TEXT NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  started_at TEXT NOT NULL,
  closed_at TEXT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_takeover_sessions_task_started_at ON takeover_sessions(task_id, started_at);
CREATE INDEX IF NOT EXISTS idx_takeover_sessions_status ON takeover_sessions(status, started_at);

CREATE TABLE IF NOT EXISTS operator_actions (
  id TEXT PRIMARY KEY,
  takeover_session_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  operator_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  action_payload_json TEXT NOT NULL,
  before_state_json TEXT NOT NULL,
  after_state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(takeover_session_id) REFERENCES takeover_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_actions_task_created_at ON operator_actions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operator_actions_session_created_at ON operator_actions(takeover_session_id, created_at);

CREATE TABLE IF NOT EXISTS evolution_proposals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  source_agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_id TEXT NULL,
  summary TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT NULL,
  applied_at TEXT NULL,
  rolled_back_at TEXT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY(approval_id) REFERENCES approvals(id)
);

CREATE INDEX IF NOT EXISTS idx_evolution_proposals_task_created_at
  ON evolution_proposals(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_proposals_status_updated_at
  ON evolution_proposals(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_proposals_scope_status
  ON evolution_proposals(scope_type, scope_ref, status);

CREATE TABLE IF NOT EXISTS evolution_policies (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  rolled_back_at TEXT NULL,
  FOREIGN KEY(proposal_id) REFERENCES evolution_proposals(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evolution_policies_proposal_id
  ON evolution_policies(proposal_id);
CREATE INDEX IF NOT EXISTS idx_evolution_policies_scope_status
  ON evolution_policies(scope_type, scope_ref, status);

CREATE TABLE IF NOT EXISTS evolution_logs (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  before_state_json TEXT NULL,
  after_state_json TEXT NULL,
  metadata_json TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(proposal_id) REFERENCES evolution_proposals(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evolution_logs_proposal_created_at
  ON evolution_logs(proposal_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_task_created_at
  ON evolution_logs(task_id, created_at DESC);
`;
//# sourceMappingURL=phase_1a_schema_sql_part-4.js.map