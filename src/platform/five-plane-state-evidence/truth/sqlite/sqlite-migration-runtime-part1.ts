export {
  WORKER_TELEMETRY_HEARTBEAT_SQL,
  WORKER_RESTART_SEMANTICS_SQL,
  AGENT_EXECUTION_RECORD_SQL,
  REMOTE_FALLBACK_ROUTING_SQL,
  WORKER_ISOLATION_ROUTING_SQL,
  MESSAGE_PARTS_SQL,
  REMOTE_REPO_VERSION_ROUTING_SQL,
  REMOTE_SESSION_TELEMETRY_SQL,
  REMOTE_LOG_AGGREGATION_SQL,
  TRUSTED_REMOTE_WORKER_REGISTRATION_SQL,
  EVENT_SESSION_ID_SQL,
  // R4-30 (INV-FENCING): Add lease_id and fencing_token columns for fencing token enforcement
  HARNESS_RUN_LEASE_FENCING_MIGRATION_SQL,
  SIDE_EFFECT_LEASE_FENCING_MIGRATION_SQL,
  BUDGET_LEDGER_LEASE_FENCING_MIGRATION_SQL,
  WORKER_IDENTITY_AND_CAPACITY_SQL,
  EXECUTION_TICKET_GRAPH_SCHEDULING_SQL,
};

const HARNESS_RUN_LEASE_FENCING_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS harness_runs (
  harness_run_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant:local',
  confirmed_task_spec_id TEXT NOT NULL DEFAULT 'confirmed_task_spec:bootstrap',
  request_envelope_id TEXT NOT NULL DEFAULT 'request_envelope:bootstrap',
  status TEXT NOT NULL DEFAULT 'created',
  version_lock_id TEXT NOT NULL DEFAULT 'version_lock:bootstrap',
  budget_ledger_id TEXT NOT NULL DEFAULT 'budget_ledger:bootstrap',
  current_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
ALTER TABLE harness_runs ADD COLUMN lease_id TEXT NULL;
ALTER TABLE harness_runs ADD COLUMN fencing_token TEXT NULL;
`;

const SIDE_EFFECT_LEASE_FENCING_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS side_effect_records (
  side_effect_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL DEFAULT 'harness_run:bootstrap',
  node_run_id TEXT NOT NULL DEFAULT 'node_run:bootstrap',
  node_attempt_id TEXT NOT NULL DEFAULT 'node_attempt:bootstrap',
  effect_kind TEXT NOT NULL DEFAULT 'other',
  idempotency_key TEXT NOT NULL DEFAULT 'bootstrap',
  status TEXT NOT NULL DEFAULT 'pending',
  risk_class TEXT NOT NULL DEFAULT 'medium',
  pre_commit_policy_proof_ref TEXT NOT NULL DEFAULT 'policy_proof:bootstrap',
  deadline TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
ALTER TABLE side_effect_records ADD COLUMN lease_id TEXT NULL;
ALTER TABLE side_effect_records ADD COLUMN fencing_token TEXT NULL;
`;

const BUDGET_LEDGER_LEASE_FENCING_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS budget_ledgers (
  budget_ledger_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant:local',
  harness_run_id TEXT NOT NULL DEFAULT 'harness_run:bootstrap',
  currency TEXT NOT NULL DEFAULT 'USD',
  hard_cap REAL NOT NULL DEFAULT 0,
  reserved_amount REAL NOT NULL DEFAULT 0,
  settled_amount REAL NOT NULL DEFAULT 0,
  released_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE budget_ledgers ADD COLUMN lease_id TEXT NULL;
ALTER TABLE budget_ledgers ADD COLUMN fencing_token TEXT NULL;
`;

const WORKER_TELEMETRY_HEARTBEAT_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN cpu_pct REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN memory_mb REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN tool_backlog_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE worker_snapshots ADD COLUMN current_step_id TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN last_progress_at TEXT NULL;
`;
const WORKER_RESTART_SEMANTICS_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN runtime_instance_id TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN restarted_from_runtime_instance_id TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN restart_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE heartbeat_snapshots ADD COLUMN runtime_instance_id TEXT NULL;
ALTER TABLE heartbeat_snapshots ADD COLUMN restart_generation INTEGER NOT NULL DEFAULT 0;
`;
const AGENT_EXECUTION_RECORD_SQL = `
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
`;
const REMOTE_FALLBACK_ROUTING_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN placement TEXT NOT NULL DEFAULT 'local';
ALTER TABLE execution_tickets ADD COLUMN dispatch_target TEXT NOT NULL DEFAULT 'any';
`;
const WORKER_ISOLATION_ROUTING_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN isolation_level TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE execution_tickets ADD COLUMN required_isolation_level TEXT NOT NULL DEFAULT 'standard';
`;
const MESSAGE_PARTS_SQL = `
ALTER TABLE messages ADD COLUMN parts_json TEXT NULL;
`;
const REMOTE_REPO_VERSION_ROUTING_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN repo_version TEXT NULL;
ALTER TABLE execution_tickets ADD COLUMN required_repo_version TEXT NULL;
`;
const REMOTE_SESSION_TELEMETRY_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN remote_session_status TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN last_acknowledged_stream_offset TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN stream_resume_success_rate REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN credential_refresh_success_rate REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN session_consistency_check_status TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN session_consistency_checked_at TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN saturation REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN active_lease_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE worker_snapshots ADD COLUMN mean_startup_latency_ms INTEGER NULL;
ALTER TABLE worker_snapshots ADD COLUMN sandbox_success_rate REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN repo_cache_hit_rate REAL NULL;
`;
const REMOTE_LOG_AGGREGATION_SQL = `
CREATE TABLE IF NOT EXISTS remote_log_entries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  runtime_instance_id TEXT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_remote_log_entries_task_created_at
  ON remote_log_entries(task_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_remote_log_entries_execution_created_at
  ON remote_log_entries(execution_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_remote_log_entries_worker_created_at
  ON remote_log_entries(worker_id, created_at, id);
`;
const TRUSTED_REMOTE_WORKER_REGISTRATION_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN registration_verified_at TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN registration_challenge_id TEXT NULL;
CREATE TABLE IF NOT EXISTS worker_registration_challenges (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  challenge_token_hash TEXT NOT NULL,
  allowed_capabilities_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worker_registration_challenges_worker_created_at
  ON worker_registration_challenges(worker_id, created_at DESC);
`;
const EVENT_SESSION_ID_SQL = `
ALTER TABLE events ADD COLUMN session_id TEXT NULL;
ALTER TABLE events ADD COLUMN schema_version TEXT NULL;
ALTER TABLE events ADD COLUMN aggregate_id TEXT NULL;
ALTER TABLE events ADD COLUMN run_id TEXT NULL;
ALTER TABLE events ADD COLUMN sequence INTEGER NULL;
ALTER TABLE events ADD COLUMN causation_id TEXT NULL;
ALTER TABLE events ADD COLUMN correlation_id TEXT NULL;
ALTER TABLE events ADD COLUMN payload_hash TEXT NULL;
ALTER TABLE events ADD COLUMN idempotency_key TEXT NULL;
ALTER TABLE events ADD COLUMN replay_behavior TEXT NULL;
ALTER TABLE events ADD COLUMN principal TEXT NULL;
ALTER TABLE events ADD COLUMN evidence_refs TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_events_session_created_at ON events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_sequence ON events(aggregate_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_idempotency_key ON events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_causation_id ON events(causation_id, created_at);
`;
const WORKER_IDENTITY_AND_CAPACITY_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN service_identity TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN mtls_peer_fingerprint TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN allowed_node_run_tenants TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE worker_snapshots ADD COLUMN running_executions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE worker_snapshots ADD COLUMN max_concurrency INTEGER NOT NULL DEFAULT 1;
ALTER TABLE worker_snapshots ADD COLUMN queue_affinity TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
`;
const EXECUTION_TICKET_GRAPH_SCHEDULING_SQL = `
ALTER TABLE execution_tickets ADD COLUMN critical_path_rank INTEGER NULL;
ALTER TABLE execution_tickets ADD COLUMN scheduler_seed TEXT NULL;
`;
