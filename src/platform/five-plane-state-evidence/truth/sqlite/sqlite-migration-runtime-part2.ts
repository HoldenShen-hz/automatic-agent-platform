export {
  REMOTE_WORKSPACE_SYNC_TELEMETRY_SQL,
  SECRET_MANAGEMENT_FOUNDATION_SQL,
  TIER1_AUDIT_EVENT_INTEGRITY_SQL,
  MEMORY_SCOPE_AND_QUALITY_SQL,
  EVOLUTION_MVP_SQL,
  EXPERIENCE_CACHE_SQL,
  PMF_VALIDATION_REPORTS_SQL,
  BILLING_FOUNDATION_SQL,
  PERCEPTION_MVP_SQL,
  GATEWAY_TARGET_DIRECTORY_SQL,
  ENTERPRISE_FOUNDATION_SQL,
  MARKETPLACE_GOVERNANCE_SQL
};

const REMOTE_WORKSPACE_SYNC_TELEMETRY_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN workspace_sync_status TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN workspace_sync_checked_at TEXT NULL;
`;
const SECRET_MANAGEMENT_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS secret_registry (
  secret_ref TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  rotation_policy_json TEXT NOT NULL,
  metadata_json TEXT NULL,
  current_version TEXT NULL,
  last_rotated_at TEXT NULL,
  next_rotation_due_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_registry_status_due_at
  ON secret_registry(status, next_rotation_due_at);
CREATE INDEX IF NOT EXISTS idx_secret_registry_scope
  ON secret_registry(scope_type, scope_ref, status);

CREATE TABLE IF NOT EXISTS secret_usage_audits (
  audit_id TEXT PRIMARY KEY,
  secret_ref TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  requested_by TEXT NOT NULL,
  granted_to TEXT NOT NULL,
  usage_purpose TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  expires_at TEXT NULL,
  masked_value TEXT NULL,
  metadata_json TEXT NULL,
  FOREIGN KEY(secret_ref) REFERENCES secret_registry(secret_ref) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_usage_audits_secret_resolved_at
  ON secret_usage_audits(secret_ref, resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_usage_audits_execution_resolved_at
  ON secret_usage_audits(execution_id, resolved_at DESC);

CREATE TABLE IF NOT EXISTS secret_rotation_events (
  event_id TEXT PRIMARY KEY,
  secret_ref TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  rotation_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  previous_version TEXT NULL,
  next_version TEXT NULL,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NULL,
  FOREIGN KEY(secret_ref) REFERENCES secret_registry(secret_ref) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_events_secret_occurred_at
  ON secret_rotation_events(secret_ref, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_events_status_occurred_at
  ON secret_rotation_events(status, occurred_at DESC);
`;
const TIER1_AUDIT_EVENT_INTEGRITY_SQL = `
CREATE TABLE IF NOT EXISTS event_integrity_records (
  event_id TEXT PRIMARY KEY,
  chain_position INTEGER NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_created_at TEXT NOT NULL,
  event_checksum TEXT NOT NULL,
  previous_chain_hash TEXT NULL,
  chain_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_integrity_chain_position
  ON event_integrity_records(chain_position);
CREATE INDEX IF NOT EXISTS idx_event_integrity_event_created_at
  ON event_integrity_records(event_created_at, chain_position);
`;
const MEMORY_SCOPE_AND_QUALITY_SQL = `
ALTER TABLE memories ADD COLUMN session_id TEXT NULL;
ALTER TABLE memories ADD COLUMN agent_id TEXT NULL;
ALTER TABLE memories ADD COLUMN execution_id TEXT NULL;
ALTER TABLE memories ADD COLUMN memory_layer TEXT NOT NULL DEFAULT 'layer_3';
ALTER TABLE memories ADD COLUMN source_trust_level TEXT NOT NULL DEFAULT 'trusted';
ALTER TABLE memories ADD COLUMN quality_score REAL NULL;
ALTER TABLE memories ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN last_accessed_at TEXT NULL;
ALTER TABLE memories ADD COLUMN expires_at TEXT NULL;
ALTER TABLE memories ADD COLUMN revoked_at TEXT NULL;
ALTER TABLE memories ADD COLUMN revocation_reason TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_memories_scope_created_at
  ON memories("scope", created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_task_created_at
  ON memories(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_session_created_at
  ON memories(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_execution_created_at
  ON memories(execution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_layer_scope_created_at
  ON memories(memory_layer, "scope", created_at DESC);
`;
const EVOLUTION_MVP_SQL = `
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
const EXPERIENCE_CACHE_SQL = `
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
`;
const PMF_VALIDATION_REPORTS_SQL = `
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
`;
const BILLING_FOUNDATION_SQL = `
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
  harness_run_id TEXT NULL,
  node_run_id TEXT NULL,
  attempt_id TEXT NULL,
  execution_id TEXT NULL,
  step_id TEXT NULL,
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
`;
const PERCEPTION_MVP_SQL = `
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
`;
const GATEWAY_TARGET_DIRECTORY_SQL = `
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
`;
const ENTERPRISE_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS environment_readiness_records (
  readiness_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  component_type TEXT NOT NULL,
  component_id TEXT NOT NULL,
  credential_ready INTEGER NOT NULL,
  secondary_gates_json TEXT NOT NULL,
  owner TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  notes TEXT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_environment_readiness_component_active
  ON environment_readiness_records(environment, component_type, component_id, is_active);
CREATE INDEX IF NOT EXISTS idx_environment_readiness_environment_verified
  ON environment_readiness_records(environment, last_verified_at DESC);

CREATE TABLE IF NOT EXISTS enterprise_capability_reports (
  report_id TEXT PRIMARY KEY,
  account_id TEXT NULL,
  workspace_id TEXT NULL,
  tenant_id TEXT NULL,
  environment TEXT NOT NULL,
  deployment_mode TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_enterprise_capability_reports_generated_at
  ON enterprise_capability_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_capability_reports_environment_generated_at
  ON enterprise_capability_reports(environment, generated_at DESC);
`;
const MARKETPLACE_GOVERNANCE_SQL = `
CREATE TABLE IF NOT EXISTS extension_packages (
  package_id TEXT PRIMARY KEY,
  extension_id TEXT NOT NULL,
  package_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL,
  owner TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  compatibility_json TEXT NOT NULL,
  signature_verified INTEGER NOT NULL,
  manifest_checksum TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  review_required INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_packages_extension_version
  ON extension_packages(extension_id, version);
CREATE INDEX IF NOT EXISTS idx_extension_packages_type_updated_at
  ON extension_packages(package_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  review_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  status TEXT NOT NULL,
  submitter TEXT NOT NULL,
  reviewer TEXT NULL,
  decision_reason_code TEXT NULL,
  findings_json TEXT NOT NULL,
  permission_surface_hash TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  decided_at TEXT NULL,
  FOREIGN KEY(package_id) REFERENCES extension_packages(package_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_package_submitted_at
  ON marketplace_reviews(package_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_status_submitted_at
  ON marketplace_reviews(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_publications (
  publication_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  compatibility_matrix_json TEXT NOT NULL,
  revocation_reason_code TEXT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(package_id) REFERENCES extension_packages(package_id) ON DELETE CASCADE,
  FOREIGN KEY(review_id) REFERENCES marketplace_reviews(review_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_channel_updated_at
  ON marketplace_publications(channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_package_updated_at
  ON marketplace_publications(package_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_governance_reports (
  report_id TEXT PRIMARY KEY,
  summary_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketplace_governance_reports_generated_at
  ON marketplace_governance_reports(generated_at DESC);
`;
