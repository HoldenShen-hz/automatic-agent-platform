/**
 * @fileoverview PostgreSQL migrations for runtime, sessions, resources, and governance baseline.
 */
import { PHASE_1A_SCHEMA_DDL, defineMigration } from "./pg-schema-support.js";
const MIGRATION_01_INITIAL_SCHEMA = defineMigration(1, "initial_schema", PHASE_1A_SCHEMA_DDL);
/**
 * Migration 2: Execution core tables
 */
const MIGRATION_02_EXECUTION_CORE = defineMigration(2, "execution_core", `
CREATE TABLE IF NOT EXISTS cost_events (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NULL,
  execution_id VARCHAR(255) NULL,
  agent_id VARCHAR(255) NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  budget_scope TEXT NOT NULL DEFAULT 'task_execution',
  provider_request_id VARCHAR(255) NULL,
  pricing_version VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_events_task_id ON cost_events(task_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_budget_scope ON cost_events(budget_scope);
CREATE INDEX IF NOT EXISTS idx_cost_events_created_at ON cost_events(created_at);

CREATE TABLE IF NOT EXISTS executions (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NULL,
  parent_execution_id VARCHAR(255) NULL,
  agent_id VARCHAR(255) NOT NULL,
  role_id VARCHAR(255) NULL,
  run_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  input_ref TEXT NULL,
  trace_id VARCHAR(255) NOT NULL,
  attempt INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  budget_usd_limit DOUBLE PRECISION NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  sandbox_mode TEXT NULL,
  allowed_tools_json TEXT NULL,
  allowed_paths_json TEXT NULL,
  max_retries INTEGER NOT NULL DEFAULT 0,
  retry_backoff TEXT NOT NULL DEFAULT 'none',
  last_error_code VARCHAR(100) NULL,
  last_error_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executions_task_created_at ON executions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_executions_task_status ON executions(task_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_trace_id ON executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_executions_parent_execution_id ON executions(parent_execution_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_status ON executions(agent_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_task_attempt ON executions(task_id, attempt, run_kind);

CREATE TABLE IF NOT EXISTS execution_prechecks (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  allowed INTEGER NOT NULL,
  reason_code VARCHAR(100) NULL,
  resolved_budget_usd DOUBLE PRECISION NULL,
  resolved_timeout_ms INTEGER NOT NULL,
  resolved_sandbox_mode TEXT NOT NULL,
  resolved_tools_json TEXT NULL,
  resolved_paths_json TEXT NULL,
  checked_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_prechecks_execution_id ON execution_prechecks(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_prechecks_checked_at ON execution_prechecks(checked_at);

CREATE TABLE IF NOT EXISTS dead_letters (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  final_reason_code TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  moved_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dead_letters_execution_id ON dead_letters(execution_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_task_id ON dead_letters(task_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_reason_moved_at ON dead_letters(final_reason_code, moved_at);

CREATE TABLE IF NOT EXISTS heartbeat_snapshots (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  status TEXT NOT NULL,
  progress_message TEXT NULL,
  cpu_pct DOUBLE PRECISION NULL,
  memory_mb DOUBLE PRECISION NULL,
  sampled_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_execution_sampled_at ON heartbeat_snapshots(execution_id, sampled_at);
CREATE INDEX IF NOT EXISTS idx_heartbeat_agent_sampled_at ON heartbeat_snapshots(agent_id, sampled_at);

CREATE TABLE IF NOT EXISTS agent_execution_records (
  execution_id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NULL,
  role_id VARCHAR(255) NULL,
  run_kind TEXT NOT NULL,
  runtime_instance_id VARCHAR(255) NULL,
  restarted_from_runtime_instance_id VARCHAR(255) NULL,
  restart_generation INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  plan_json JSONB NOT NULL,
  current_step_id VARCHAR(255) NULL,
  last_tool_name TEXT NULL,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  last_decision_json JSONB NULL,
  last_error_code VARCHAR(100) NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_records_task_updated_at ON agent_execution_records(task_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_execution_records_agent_updated_at ON agent_execution_records(agent_id, updated_at);
`);
/**
 * Migration 3: Worker, coordination, and queue tables
 */
const MIGRATION_03_WORKER_QUEUE = defineMigration(3, "worker_queue", `
CREATE TABLE IF NOT EXISTS worker_snapshots (
  worker_id VARCHAR(255) PRIMARY KEY,
  status TEXT NOT NULL,
  repo_version VARCHAR(100) NULL,
  remote_session_status TEXT NULL,
  last_acknowledged_stream_offset TEXT NULL,
  stream_resume_success_rate DOUBLE PRECISION NULL,
  credential_refresh_success_rate DOUBLE PRECISION NULL,
  session_consistency_check_status TEXT NULL,
  session_consistency_checked_at TIMESTAMPTZ NULL,
  workspace_sync_status TEXT NULL,
  workspace_sync_checked_at TIMESTAMPTZ NULL,
  saturation DOUBLE PRECISION NULL,
  active_lease_count INTEGER NOT NULL DEFAULT 0,
  mean_startup_latency_ms INTEGER NULL,
  sandbox_success_rate DOUBLE PRECISION NULL,
  repo_cache_hit_rate DOUBLE PRECISION NULL,
  capabilities_json JSONB NOT NULL,
  running_executions_json JSONB NOT NULL,
  max_concurrency INTEGER NOT NULL,
  queue_affinity TEXT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_snapshots_status_updated_at ON worker_snapshots(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_worker_snapshots_heartbeat ON worker_snapshots(last_heartbeat_at);

CREATE TABLE IF NOT EXISTS execution_tickets (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  priority TEXT NOT NULL,
  queue_name TEXT NULL,
  required_repo_version VARCHAR(100) NULL,
  required_capabilities_json JSONB NOT NULL,
  dispatch_after TIMESTAMPTZ NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  assigned_worker_id VARCHAR(255) NULL,
  lease_id VARCHAR(255) NULL,
  claimed_at TIMESTAMPTZ NULL,
  consumed_at TIMESTAMPTZ NULL,
  invalidated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_tickets_queue_status_dispatch_after
  ON execution_tickets(queue_name, status, dispatch_after, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_tickets_execution_created_at ON execution_tickets(execution_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_tickets_active_execution_attempt
  ON execution_tickets(execution_id, attempt)
  WHERE status IN ('pending', 'claimed');

CREATE TABLE IF NOT EXISTS execution_leases (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  worker_id VARCHAR(255) NOT NULL,
  attempt INTEGER NOT NULL,
  fencing_token INTEGER NOT NULL,
  queue_name TEXT NULL,
  status TEXT NOT NULL,
  leased_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NULL,
  released_at TIMESTAMPTZ NULL,
  reason_code TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_leases_execution_id ON execution_leases(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_leases_worker_status ON execution_leases(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_execution_leases_expires_at ON execution_leases(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_leases_execution_fencing ON execution_leases(execution_id, fencing_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_leases_active_execution
  ON execution_leases(execution_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS lease_audits (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  lease_id VARCHAR(255) NOT NULL,
  worker_id VARCHAR(255) NOT NULL,
  fencing_token INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lease_audits_execution_recorded_at ON lease_audits(execution_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_lease_audits_lease_recorded_at ON lease_audits(lease_id, recorded_at);
`);
/**
 * Migration 4: Sessions, messaging, and logging tables
 */
const MIGRATION_04_SESSIONS_MESSAGING = defineMigration(4, "sessions_messaging", `
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  external_session_id VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_task_id ON sessions(task_id);

CREATE TABLE IF NOT EXISTS gateway_targets (
  target_id VARCHAR(255) PRIMARY KEY,
  channel TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  external_target_id VARCHAR(255) NULL,
  display_name TEXT NOT NULL,
  aliases_json JSONB NOT NULL,
  metadata_json JSONB NULL,
  source TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gateway_targets_channel_display_name
  ON gateway_targets(channel, display_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_targets_channel_external_target_id
  ON gateway_targets(channel, external_target_id);
CREATE INDEX IF NOT EXISTS idx_gateway_targets_source_updated_at
  ON gateway_targets(source, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  parts_json JSONB NULL,
  attachments_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created_at ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS remote_log_entries (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NOT NULL,
  worker_id VARCHAR(255) NOT NULL,
  runtime_instance_id VARCHAR(255) NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remote_log_entries_task_created_at
  ON remote_log_entries(task_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_remote_log_entries_execution_created_at
  ON remote_log_entries(execution_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_remote_log_entries_worker_created_at
  ON remote_log_entries(worker_id, created_at, id);

CREATE TABLE IF NOT EXISTS compaction_records (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  stage TEXT NOT NULL,
  source_message_ids_json JSONB NOT NULL,
  summary_text TEXT NULL,
  summary_ref TEXT NULL,
  compaction_reason TEXT NOT NULL,
  overflow_triggered INTEGER NOT NULL DEFAULT 1,
  auto_triggered INTEGER NOT NULL DEFAULT 1,
  token_reduction_estimate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compaction_records_session_created_at ON compaction_records(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compaction_records_task_created_at ON compaction_records(task_id, created_at);
`);
/**
 * Migration 5: Events and approvals
 */
const MIGRATION_05_EVENTS_APPROVALS = defineMigration(5, "events_approvals", `
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NULL,
  execution_id VARCHAR(255) NULL,
  event_type TEXT NOT NULL,
  event_tier TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  trace_id VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_task_created_at ON events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_execution_created_at ON events(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type_created_at ON events(event_type, created_at);

CREATE TABLE IF NOT EXISTS event_consumer_acks (
  id VARCHAR(255) PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  consumer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  acked_at TIMESTAMPTZ NULL,
  error_code VARCHAR(100) NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_consumer_event_consumer ON event_consumer_acks(event_id, consumer_id);

CREATE TABLE IF NOT EXISTS approvals (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  status TEXT NOT NULL,
  request_json JSONB NOT NULL,
  response_json JSONB NULL,
  timeout_policy TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_task_status ON approvals(task_id, status);
`);
/**
 * Migration 6: Resources, memory, and artifacts
 */
const MIGRATION_06_RESOURCES = defineMigration(6, "resources", `
CREATE TABLE IF NOT EXISTS file_locks (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NULL,
  execution_id VARCHAR(255) NULL,
  lock_scope TEXT NOT NULL,
  resource_path TEXT NOT NULL,
  lock_mode TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_file_locks_owner ON file_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_locks_resource ON file_locks(resource_path);

CREATE TABLE IF NOT EXISTS memories (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NULL,
  scope TEXT NOT NULL,
  content_json JSONB NOT NULL,
  classification TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS experience_cache (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NOT NULL,
  task_context TEXT NOT NULL,
  task_intent TEXT NOT NULL,
  tools_used_json JSONB NOT NULL,
  outcome TEXT NOT NULL,
  final_error_code VARCHAR(100) NULL,
  quality_score DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experience_cache_quality_created_at
  ON experience_cache(quality_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experience_cache_outcome_created_at
  ON experience_cache(outcome, created_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  step_id VARCHAR(255) NULL,
  kind TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum VARCHAR(255) NULL,
  lineage_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_task_created_at ON artifacts(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_execution_created_at ON artifacts(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_step_id ON artifacts(task_id, step_id, created_at);

CREATE TABLE IF NOT EXISTS tool_result_files (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  tool_name TEXT NOT NULL,
  artifact_id VARCHAR(255) NOT NULL,
  output_kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_result_files_task_id ON tool_result_files(task_id);
`);
/**
 * Migration 7: Billing and entitlements
 */
export { MIGRATION_01_INITIAL_SCHEMA, MIGRATION_02_EXECUTION_CORE, MIGRATION_03_WORKER_QUEUE, MIGRATION_04_SESSIONS_MESSAGING, MIGRATION_05_EVENTS_APPROVALS, MIGRATION_06_RESOURCES, };
//# sourceMappingURL=pg-migrations-runtime.js.map