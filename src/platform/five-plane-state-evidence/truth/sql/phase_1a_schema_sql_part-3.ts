export const PHASE_1A_SCHEMA_SQL_PART_3 = `
  event_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_attempt_at TEXT NULL,
  acked_at TEXT NULL,
  error_code TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_consumer_event_consumer ON event_consumer_acks(event_id, consumer_id);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NULL,
  timeout_policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  responded_at TEXT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_task_status ON approvals(task_id, status);

CREATE TABLE IF NOT EXISTS file_locks (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  lock_scope TEXT NOT NULL,
  resource_path TEXT NOT NULL,
  lock_mode TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_locks_owner ON file_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_locks_resource ON file_locks(resource_path);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  scope TEXT NOT NULL,
  content_json TEXT NOT NULL,
  classification TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experience_cache (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  task_context TEXT NOT NULL,
  task_intent TEXT NOT NULL,
  tools_used_json TEXT NOT NULL,
  outcome TEXT NOT NULL,
  final_error_code TEXT NULL,
  quality_score REAL NOT NULL,
  created_at TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experience_cache_quality_created_at
  ON experience_cache(quality_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experience_cache_outcome_created_at
  ON experience_cache(outcome, created_at DESC);

CREATE TABLE IF NOT EXISTS pmf_validation_reports (
  id TEXT PRIMARY KEY,
  profile_name TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  division_id TEXT NULL,
  verdict TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pmf_validation_reports_generated_at
  ON pmf_validation_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmf_validation_reports_profile_generated_at
  ON pmf_validation_reports(profile_name, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmf_validation_reports_division_generated_at
  ON pmf_validation_reports(division_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS billing_accounts (
  account_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  workspace_id TEXT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_owner_status
  ON billing_accounts(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_workspace_status
  ON billing_accounts(workspace_id, status);

CREATE TABLE IF NOT EXISTS usage_events (
  usage_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  workspace_id TEXT NULL,
  tenant_id TEXT NULL,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  metric_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  source TEXT NOT NULL,
  unit_price_usd REAL NOT NULL,
  captured_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_account_captured_at
  ON usage_events(account_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_account_metric_window
  ON usage_events(account_id, metric_type, captured_at DESC);

CREATE TABLE IF NOT EXISTS quota_counters (
  counter_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  used_quantity REAL NOT NULL,
  limit_quantity REAL NULL,
  limit_type TEXT NULL,
  reset_policy TEXT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_counters_account_metric_window
  ON quota_counters(account_id, metric_type, window_start, window_end);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  usage_id TEXT NULL,
  period_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  currency TEXT NOT NULL,
  source_ref TEXT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE CASCADE,
  FOREIGN KEY(usage_id) REFERENCES usage_events(usage_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_recorded_at
  ON ledger_entries(account_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_period
  ON ledger_entries(account_id, period_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS entitlement_decisions (
  decision_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  metric_type TEXT NULL,
  requested_quantity REAL NULL,
  allowed INTEGER NOT NULL,
  decision_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entitlement_decisions_account_evaluated_at
  ON entitlement_decisions(account_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlement_decisions_feature_evaluated_at
  ON entitlement_decisions(feature_key, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS perception_sources (
  source_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  schedule_json TEXT NULL,
  filters_json TEXT NULL,
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_perception_sources_enabled_priority
  ON perception_sources(enabled, priority DESC, updated_at DESC);
`;
