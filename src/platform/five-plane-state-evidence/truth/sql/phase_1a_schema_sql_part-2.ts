export const PHASE_1A_SCHEMA_SQL_PART_2 = `
CREATE TABLE IF NOT EXISTS execution_tickets (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  queue_name TEXT NULL,
  dispatch_target TEXT NOT NULL DEFAULT 'any',
  required_isolation_level TEXT NOT NULL DEFAULT 'standard',
  required_repo_version TEXT NULL,
  required_capabilities_json TEXT NOT NULL,
  dispatch_after TEXT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  assigned_worker_id TEXT NULL,
  lease_id TEXT NULL,
  claimed_at TEXT NULL,
  consumed_at TEXT NULL,
  invalidated_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  critical_path_rank INTEGER NULL,
  scheduler_seed TEXT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_tickets_queue_status_dispatch_after
  ON execution_tickets(queue_name, status, dispatch_after, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_tickets_execution_created_at ON execution_tickets(execution_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_tickets_active_execution_attempt
  ON execution_tickets(execution_id, attempt)
  WHERE status IN ('pending', 'claimed');

CREATE TABLE IF NOT EXISTS execution_leases (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  fencing_token INTEGER NOT NULL,
  queue_name TEXT NULL,
  status TEXT NOT NULL,
  leased_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_heartbeat_at TEXT NULL,
  released_at TEXT NULL,
  reason_code TEXT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_leases_execution_id ON execution_leases(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_leases_worker_status ON execution_leases(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_execution_leases_expires_at ON execution_leases(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_leases_execution_fencing ON execution_leases(execution_id, fencing_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_leases_active_execution
  ON execution_leases(execution_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS lease_audits (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  lease_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  fencing_token INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY(lease_id) REFERENCES execution_leases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lease_audits_execution_recorded_at ON lease_audits(execution_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_lease_audits_lease_recorded_at ON lease_audits(lease_id, recorded_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  external_session_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_task_id ON sessions(task_id);

CREATE TABLE IF NOT EXISTS gateway_targets (
  target_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  external_target_id TEXT NULL,
  display_name TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  metadata_json TEXT NULL,
  source TEXT NOT NULL,
  last_seen_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gateway_targets_channel_display_name
  ON gateway_targets(channel, display_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_targets_channel_external_target_id
  ON gateway_targets(channel, external_target_id);
CREATE INDEX IF NOT EXISTS idx_gateway_targets_source_updated_at
  ON gateway_targets(source, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  parts_json TEXT NULL,
  attachments_json TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created_at ON messages(session_id, created_at);

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

CREATE TABLE IF NOT EXISTS compaction_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  source_message_ids_json TEXT NOT NULL,
  summary_text TEXT NULL,
  summary_ref TEXT NULL,
  compaction_reason TEXT NOT NULL,
  overflow_triggered INTEGER NOT NULL DEFAULT 1,
  auto_triggered INTEGER NOT NULL DEFAULT 1,
  token_reduction_estimate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compaction_records_session_created_at ON compaction_records(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compaction_records_task_created_at ON compaction_records(task_id, created_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  session_id TEXT NULL,
  execution_id TEXT NULL,
  event_type TEXT NOT NULL,
  event_tier TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  trace_id TEXT NULL,
  schema_version TEXT NULL,
  aggregate_id TEXT NULL,
  run_id TEXT NULL,
  sequence INTEGER NULL,
  causation_id TEXT NULL,
  correlation_id TEXT NULL,
  payload_hash TEXT NULL,
  idempotency_key TEXT NULL,
  replay_behavior TEXT NULL,
  principal TEXT NULL,
  evidence_refs TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_task_created_at ON events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_session_created_at ON events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_execution_created_at ON events(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type_created_at ON events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_sequence ON events(aggregate_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_idempotency_key ON events(idempotency_key);

CREATE TABLE IF NOT EXISTS event_consumer_acks (
  id TEXT PRIMARY KEY,
`;
