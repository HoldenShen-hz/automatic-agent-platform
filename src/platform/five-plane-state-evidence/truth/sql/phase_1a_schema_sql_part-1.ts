export const PHASE_1A_SCHEMA_SQL_PART_1 = `

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  parent_id TEXT NULL,
  root_id TEXT NOT NULL,
  harness_run_id TEXT NULL,
  division_id TEXT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  priority TEXT NOT NULL,
  input_json TEXT NOT NULL,
  normalized_input_json TEXT NULL,
  output_json TEXT NULL,
  estimated_cost_usd REAL NULL,
  actual_cost_usd REAL NOT NULL DEFAULT 0,
  error_code TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL,
  FOREIGN KEY(parent_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_root_id ON tasks(root_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_division_status ON tasks(division_id, status);

CREATE TABLE IF NOT EXISTS workflow_state (
  task_id TEXT PRIMARY KEY,
  division_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  current_step_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  outputs_json TEXT NOT NULL,
  last_error_code TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resumable_from_step TEXT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_division_status ON workflow_state(division_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_updated_at ON workflow_state(updated_at);

CREATE TABLE IF NOT EXISTS workflow_step_outputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  summary TEXT NULL,
  artifacts_json TEXT NULL,
  token_cost REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  validation_json TEXT NULL,
  produced_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_outputs_task_id ON workflow_step_outputs(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_step_outputs_task_step ON workflow_step_outputs(task_id, step_id);

CREATE TABLE IF NOT EXISTS cost_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT NULL,
  execution_id TEXT NULL,
  agent_id TEXT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  budget_scope TEXT NOT NULL DEFAULT 'task_execution',
  provider_request_id TEXT NULL,
  pricing_version TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cost_events_task_id ON cost_events(task_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_budget_scope ON cost_events(budget_scope);
CREATE INDEX IF NOT EXISTS idx_cost_events_created_at ON cost_events(created_at);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  workflow_id TEXT NULL,
  parent_execution_id TEXT NULL,
  agent_id TEXT NOT NULL,
  role_id TEXT NULL,
  run_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  input_ref TEXT NULL,
  trace_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  budget_usd_limit REAL NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  sandbox_mode TEXT NULL,
  allowed_tools_json TEXT NULL,
  allowed_paths_json TEXT NULL,
  max_retries INTEGER NOT NULL DEFAULT 0,
  retry_backoff TEXT NOT NULL DEFAULT 'none',
  last_error_code TEXT NULL,
  last_error_message TEXT NULL,
  started_at TEXT NULL,
  finished_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_execution_id) REFERENCES executions(id)
);

CREATE INDEX IF NOT EXISTS idx_executions_task_created_at ON executions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_executions_task_status ON executions(task_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_trace_id ON executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_executions_parent_execution_id ON executions(parent_execution_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_status ON executions(agent_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_task_attempt ON executions(task_id, attempt, run_kind);

CREATE TABLE IF NOT EXISTS execution_prechecks (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  reason_code TEXT NULL,
  resolved_budget_usd REAL NULL,
  resolved_timeout_ms INTEGER NOT NULL,
  resolved_sandbox_mode TEXT NOT NULL,
  resolved_tools_json TEXT NULL,
  resolved_paths_json TEXT NULL,
  checked_at TEXT NOT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_prechecks_execution_id ON execution_prechecks(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_prechecks_checked_at ON execution_prechecks(checked_at);

CREATE TABLE IF NOT EXISTS dead_letters (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  final_reason_code TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  moved_at TEXT NOT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dead_letters_execution_id ON dead_letters(execution_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_task_id ON dead_letters(task_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_reason_moved_at ON dead_letters(final_reason_code, moved_at);

CREATE TABLE IF NOT EXISTS heartbeat_snapshots (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_message TEXT NULL,
  cpu_pct REAL NULL,
  memory_mb REAL NULL,
  sampled_at TEXT NOT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_execution_sampled_at ON heartbeat_snapshots(execution_id, sampled_at);
CREATE INDEX IF NOT EXISTS idx_heartbeat_agent_sampled_at ON heartbeat_snapshots(agent_id, sampled_at);

CREATE TABLE IF NOT EXISTS agent_execution_records (
  execution_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  workflow_id TEXT NULL,
  role_id TEXT NULL,
  run_kind TEXT NOT NULL,
  runtime_instance_id TEXT NULL,
  restarted_from_runtime_instance_id TEXT NULL,
  restart_generation INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  current_step_id TEXT NULL,
  last_tool_name TEXT NULL,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  last_decision_json TEXT NULL,
  last_error_code TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT NULL,
  started_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_records_task_updated_at ON agent_execution_records(task_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_execution_records_agent_updated_at ON agent_execution_records(agent_id, updated_at);

CREATE TABLE IF NOT EXISTS worker_snapshots (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'local',
  isolation_level TEXT NOT NULL DEFAULT 'standard',
  repo_version TEXT NULL,
  remote_session_status TEXT NULL,
  last_acknowledged_stream_offset TEXT NULL,
  stream_resume_success_rate REAL NULL,
  credential_refresh_success_rate REAL NULL,
  session_consistency_check_status TEXT NULL,
  session_consistency_checked_at TEXT NULL,
  workspace_sync_status TEXT NULL,
  workspace_sync_checked_at TEXT NULL,
  saturation REAL NULL,
  active_lease_count INTEGER NOT NULL DEFAULT 0,
  mean_startup_latency_ms INTEGER NULL,
  sandbox_success_rate REAL NULL,
  repo_cache_hit_rate REAL NULL,
  registration_verified_at TEXT NULL,
  registration_challenge_id TEXT NULL,
  service_identity TEXT NULL,
  mtls_peer_fingerprint TEXT NULL,
  allowed_node_run_tenants TEXT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  running_executions_json TEXT NOT NULL DEFAULT '[]',
  max_concurrency INTEGER NOT NULL DEFAULT 1,
  queue_affinity TEXT NULL,
  runtime_instance_id TEXT NULL,
  restarted_from_runtime_instance_id TEXT NULL,
  restart_generation INTEGER NOT NULL DEFAULT 0,
  cpu_pct REAL NULL,
  memory_mb REAL NULL,
  tool_backlog_count INTEGER NOT NULL DEFAULT 0,
  current_step_id TEXT NULL,
  last_progress_at TEXT NULL,
  last_heartbeat_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_worker_snapshots_status_updated_at ON worker_snapshots(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_worker_snapshots_heartbeat ON worker_snapshots(last_heartbeat_at);
`;
