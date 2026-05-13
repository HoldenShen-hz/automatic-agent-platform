export const RUNTIME_PHYSICAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS task_drafts (
  task_draft_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  principal_json TEXT NOT NULL,
  source TEXT NOT NULL,
  normalized_intent_json TEXT NOT NULL,
  risk_preview_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS confirmed_task_specs (
  confirmed_task_spec_id TEXT PRIMARY KEY,
  task_draft_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  constraint_pack_ref TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS request_envelopes (
  request_id TEXT PRIMARY KEY,
  confirmed_task_spec_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS harness_runs (
  harness_run_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  goal TEXT NULL,
  risk_level TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  confirmed_task_spec_id TEXT NOT NULL,
  request_envelope_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  constraint_pack_ref TEXT NOT NULL,
  version_lock_id TEXT NOT NULL,
  budget_ledger_id TEXT NOT NULL,
  current_seq INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  fencing_token TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_graph_bundles (
  plan_graph_bundle_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  graph_version INTEGER NOT NULL,
  graph_json TEXT NOT NULL,
  validation_report_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_patches (
  graph_patch_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  base_graph_version INTEGER NOT NULL,
  new_graph_version INTEGER NOT NULL,
  operations_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_runs (
  node_run_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  plan_graph_bundle_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  lease_id TEXT,
  fencing_token TEXT,
  current_seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_attempts (
  node_attempt_id TEXT PRIMARY KEY,
  node_run_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  attempt_kind TEXT NOT NULL,
  executor_ref TEXT NOT NULL,
  started_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_attempt_receipts (
  node_attempt_receipt_id TEXT PRIMARY KEY,
  node_attempt_id TEXT NOT NULL,
  node_run_id TEXT NOT NULL,
  receipt_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  produced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS side_effect_records (
  side_effect_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  node_run_id TEXT NOT NULL,
  node_attempt_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_ledgers (
  budget_ledger_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  harness_run_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  hard_cap REAL NOT NULL,
  reserved_amount REAL NOT NULL,
  settled_amount REAL NOT NULL,
  released_amount REAL NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_reservations (
  budget_reservation_id TEXT PRIMARY KEY,
  budget_ledger_id TEXT NOT NULL,
  harness_run_id TEXT NOT NULL,
  node_run_id TEXT,
  amount REAL NOT NULL,
  resource_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_settlements (
  budget_settlement_id TEXT PRIMARY KEY,
  budget_reservation_id TEXT NOT NULL,
  actual_amount REAL NOT NULL,
  settlement_kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_records (
  mission_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  objective TEXT NOT NULL,
  success_criteria_json TEXT NOT NULL,
  owner_principal_id TEXT NOT NULL,
  accountable_principal_id TEXT NULL,
  domain_id TEXT NULL,
  policy_refs_json TEXT NOT NULL,
  risk_profile_ref TEXT NULL,
  budget_envelope_ref TEXT NULL,
  knowledge_boundary_ref TEXT NULL,
  default_workflow_template_refs_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  freeze_reason TEXT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  archived_at TEXT NULL,
  archived_by TEXT NULL,
  version INTEGER NOT NULL,
  etag TEXT NOT NULL,
  CHECK (version >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mission_records_tenant_status
  ON mission_records(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_mission_records_owner
  ON mission_records(tenant_id, owner_principal_id);

CREATE TABLE IF NOT EXISTS mission_memberships (
  membership_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  denied_permissions_json TEXT NOT NULL,
  status TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  expires_at TEXT NULL,
  metadata_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  UNIQUE (mission_id, principal_type, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_memberships_principal
  ON mission_memberships(tenant_id, principal_type, principal_id, status);

CREATE TABLE IF NOT EXISTS mission_context_snapshots (
  mission_snapshot_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  mission_version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  org_id TEXT NULL,
  task_id TEXT NOT NULL,
  confirmed_task_spec_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  signature TEXT NULL,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mission_snapshots_task
  ON mission_context_snapshots(tenant_id, task_id);

CREATE TABLE IF NOT EXISTS mission_event_sequences (
  tenant_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  next_sequence INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, aggregate_type, aggregate_id)
);

CREATE TABLE IF NOT EXISTS run_version_locks (
  run_version_lock_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  runtime_profile_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_version_lock_sets (
  artifact_version_lock_set_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  artifact_locks_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_input_bundles (
  decision_input_bundle_id TEXT PRIMARY KEY,
  harness_run_id TEXT NOT NULL,
  node_run_id TEXT,
  decision_kind TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS harness_decisions (
  harness_decision_id TEXT PRIMARY KEY,
  decision_input_bundle_id TEXT NOT NULL,
  decision_kind TEXT NOT NULL,
  decision TEXT NOT NULL,
  decider_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS human_responsibility_records (
  human_responsibility_record_id TEXT PRIMARY KEY,
  harness_decision_id TEXT NOT NULL,
  human_actor_ref_json TEXT NOT NULL,
  responsibility_scope TEXT NOT NULL,
  acknowledged_risk_class TEXT NOT NULL,
  effective_from TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_event_log (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_seq INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (aggregate_type, aggregate_id, aggregate_seq)
);

CREATE TABLE IF NOT EXISTS runtime_outbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  dispatched_at TEXT
);

CREATE TABLE IF NOT EXISTS runtime_audit_refs (
  audit_ref TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`;
