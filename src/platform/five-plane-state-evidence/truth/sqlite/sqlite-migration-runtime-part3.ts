import { LLM_EVAL_DDL, PROMPT_MODEL_POLICY_GOVERNANCE_DDL } from "../../../prompt-engine/eval/prompt-model-policy-governance-schema.js";
import { ENTERPRISE_GOVERNANCE_DDL } from "../../../control-plane/incident-control/enterprise-governance-schema.js";
import { CONTROL_PLANE_LOAD_BALANCING_DDL } from "../sql/control-plane-load-balancing-ddl.js";

export {
  TENANT_DATA_NAMESPACE_FOUNDATION_SQL,
  DATA_PLANE_FLOW_FOUNDATION_SQL,
  RELEASE_DEPLOYMENT_LEDGER_SQL,
  SECRET_LEASES_SQL,
  RELEASE_EXECUTION_REPORTS_SQL,
  WORKFLOW_DISPATCH_RECEIPT_AUDIT_SQL,
  LLM_EVAL_AND_GOVERNANCE_FOUNDATION_SQL,
  ENTERPRISE_GOVERNANCE_FOUNDATION_SQL,
  CONTROL_PLANE_LOAD_BALANCING_FOUNDATION_SQL,
  SKILL_GOVERNANCE_FOUNDATION_SQL,
  TASK_TENANT_SCOPE_SQL,
  BILLING_COLLECTION_FOUNDATION_SQL,
  PRODUCT_GOVERNANCE_TENANT_SCOPE_SQL,
};

const TENANT_DATA_NAMESPACE_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  default_policy_set TEXT NOT NULL,
  organization_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_updated_at
  ON workspaces(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_updated_at
  ON workspaces(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_workspace
  ON workspace_memberships(user_id, workspace_id);

CREATE TABLE IF NOT EXISTS organizations (
  organization_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  billing_account_id TEXT NULL,
  default_tenant_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(billing_account_id) REFERENCES billing_accounts(account_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_organizations_billing_account_updated_at
  ON organizations(billing_account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_organization
  ON organization_memberships(user_id, organization_id);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  storage_scope TEXT NOT NULL,
  identity_scope TEXT NOT NULL,
  policy_scope TEXT NOT NULL,
  artifact_scope TEXT NOT NULL,
  isolation_mode TEXT NOT NULL,
  deployment_mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tenants_organization_updated_at
  ON tenants(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS deployment_bindings (
  binding_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  deployment_mode TEXT NOT NULL,
  region TEXT NOT NULL,
  network_boundary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_bindings_tenant_environment
  ON deployment_bindings(tenant_id, environment_id);

CREATE TABLE IF NOT EXISTS data_namespaces (
  namespace_id TEXT PRIMARY KEY,
  plane TEXT NOT NULL,
  tenant_id TEXT NULL,
  organization_id TEXT NULL,
  workspace_id TEXT NULL,
  retention_policy TEXT NOT NULL,
  encryption_policy TEXT NOT NULL,
  residency_policy TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_data_namespaces_plane_updated_at
  ON data_namespaces(plane, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_namespaces_tenant_plane
  ON data_namespaces(tenant_id, plane, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_namespaces_workspace_plane
  ON data_namespaces(workspace_id, plane, updated_at DESC);
`;
const DATA_PLANE_FLOW_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS analytics_facts (
  fact_id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL,
  tenant_id TEXT NULL,
  organization_id TEXT NULL,
  workspace_id TEXT NULL,
  metric_name TEXT NOT NULL,
  dimension_json TEXT NOT NULL,
  value REAL NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  FOREIGN KEY(namespace_id) REFERENCES data_namespaces(namespace_id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_facts_namespace_metric_captured_at
  ON analytics_facts(namespace_id, metric_name, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_facts_tenant_window
  ON analytics_facts(tenant_id, window_end DESC, metric_name);

CREATE TABLE IF NOT EXISTS archive_bundles (
  bundle_id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL,
  tenant_id TEXT NULL,
  organization_id TEXT NULL,
  workspace_id TEXT NULL,
  bundle_type TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  summary_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(namespace_id) REFERENCES data_namespaces(namespace_id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_archive_bundles_namespace_created_at
  ON archive_bundles(namespace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_bundles_tenant_type
  ON archive_bundles(tenant_id, bundle_type, created_at DESC);

CREATE TABLE IF NOT EXISTS replay_datasets (
  dataset_id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL,
  tenant_id TEXT NULL,
  organization_id TEXT NULL,
  workspace_id TEXT NULL,
  dataset_type TEXT NOT NULL,
  sample_refs_json TEXT NOT NULL,
  truth_refs_json TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(namespace_id) REFERENCES data_namespaces(namespace_id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_replay_datasets_namespace_created_at
  ON replay_datasets(namespace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_datasets_tenant_type
  ON replay_datasets(tenant_id, dataset_type, created_at DESC);

CREATE TABLE IF NOT EXISTS data_movement_jobs (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  organization_id TEXT NULL,
  workspace_id TEXT NULL,
  source_namespace_id TEXT NOT NULL,
  target_namespace_id TEXT NOT NULL,
  source_plane TEXT NOT NULL,
  target_plane TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NULL,
  report_json TEXT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE SET NULL,
  FOREIGN KEY(source_namespace_id) REFERENCES data_namespaces(namespace_id) ON DELETE CASCADE,
  FOREIGN KEY(target_namespace_id) REFERENCES data_namespaces(namespace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_data_movement_jobs_status_started_at
  ON data_movement_jobs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_movement_jobs_tenant_movement
  ON data_movement_jobs(tenant_id, movement_type, started_at DESC);
`;
const RELEASE_DEPLOYMENT_LEDGER_SQL = `
CREATE TABLE IF NOT EXISTS release_bundles (
  bundle_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  image_tag TEXT NOT NULL,
  image_ref TEXT NOT NULL,
  rollout_strategy TEXT NOT NULL,
  deployment_namespace TEXT NOT NULL,
  cluster_name TEXT NOT NULL,
  config_path TEXT NOT NULL,
  config_bundle_ref TEXT NOT NULL,
  registry_credential_ref TEXT NOT NULL,
  deployment_credential_ref TEXT NOT NULL,
  publish_workflow_path TEXT NOT NULL,
  deploy_workflow_path TEXT NOT NULL,
  required_readiness_checks_json TEXT NOT NULL,
  recommended_commands_json TEXT NOT NULL,
  task_id TEXT NULL,
  json_artifact_uri TEXT NULL,
  markdown_artifact_uri TEXT NULL,
  generated_at TEXT NOT NULL,
  exported_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_release_bundles_environment_exported_at
  ON release_bundles(environment, exported_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_bundles_version_exported_at
  ON release_bundles(version, exported_at DESC);

CREATE TABLE IF NOT EXISTS deployment_execution_reports (
  execution_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  rollout_strategy TEXT NOT NULL,
  target_eligible INTEGER NOT NULL,
  config_bundle_ref TEXT NOT NULL,
  config_version_id TEXT NULL,
  registry_secret_ref TEXT NOT NULL,
  registry_secret_provider_kind TEXT NOT NULL,
  registry_secret_resolved INTEGER NOT NULL,
  deployment_secret_ref TEXT NOT NULL,
  deployment_secret_provider_kind TEXT NOT NULL,
  deployment_secret_resolved INTEGER NOT NULL,
  execution_mode TEXT NOT NULL,
  publish_command TEXT NOT NULL,
  deploy_command TEXT NOT NULL,
  command_results_json TEXT NOT NULL,
  release_bundle_id TEXT NULL,
  task_id TEXT NULL,
  json_artifact_uri TEXT NULL,
  markdown_artifact_uri TEXT NULL,
  generated_at TEXT NOT NULL,
  exported_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_deployment_execution_reports_environment_exported_at
  ON deployment_execution_reports(environment, exported_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_execution_reports_mode_exported_at
  ON deployment_execution_reports(execution_mode, exported_at DESC);

CREATE TABLE IF NOT EXISTS environment_promotion_history (
  promotion_id TEXT PRIMARY KEY,
  source_environment TEXT NULL,
  target_environment TEXT NOT NULL,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  rollout_strategy TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision_status TEXT NOT NULL,
  release_bundle_id TEXT NULL,
  deployment_execution_id TEXT NULL,
  reason_code TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata_json TEXT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_environment_promotion_history_target_recorded_at
  ON environment_promotion_history(target_environment, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_promotion_history_source_target
  ON environment_promotion_history(source_environment, target_environment, recorded_at DESC);
`;
const SECRET_LEASES_SQL = `
CREATE TABLE IF NOT EXISTS secret_leases (
  lease_id TEXT PRIMARY KEY,
  secret_ref TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  requested_by TEXT NOT NULL,
  granted_to TEXT NOT NULL,
  usage_purpose TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL,
  revoked_at TEXT NULL,
  revoked_by TEXT NULL,
  revocation_reason_code TEXT NULL,
  source_version TEXT NULL,
  masked_value TEXT NULL,
  metadata_json TEXT NULL,
  FOREIGN KEY(secret_ref) REFERENCES secret_registry(secret_ref) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_leases_secret_issued_at
  ON secret_leases(secret_ref, issued_at DESC, lease_id DESC);
CREATE INDEX IF NOT EXISTS idx_secret_leases_status_expires_at
  ON secret_leases(status, expires_at ASC, lease_id ASC);
CREATE INDEX IF NOT EXISTS idx_secret_leases_granted_to_status
  ON secret_leases(granted_to, status, expires_at ASC);
`;
const RELEASE_EXECUTION_REPORTS_SQL = `
CREATE TABLE IF NOT EXISTS release_execution_reports (
  execution_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  rollout_strategy TEXT NOT NULL,
  image_ref TEXT NOT NULL,
  image_repository TEXT NOT NULL,
  registry_secret_ref TEXT NOT NULL,
  registry_secret_provider_kind TEXT NOT NULL,
  registry_secret_resolved INTEGER NOT NULL,
  registry_secret_access_mode TEXT NOT NULL,
  registry_lease_id TEXT NULL,
  registry_lease_status TEXT NULL,
  registry_lease_expires_at TEXT NULL,
  registry_lease_revoked_at TEXT NULL,
  build_command TEXT NOT NULL,
  publish_command TEXT NOT NULL,
  command_results_json TEXT NOT NULL,
  task_id TEXT NULL,
  json_artifact_uri TEXT NULL,
  markdown_artifact_uri TEXT NULL,
  generated_at TEXT NOT NULL,
  exported_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_release_execution_reports_environment_exported_at
  ON release_execution_reports(environment, exported_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_execution_reports_bundle_exported_at
  ON release_execution_reports(bundle_id, exported_at DESC);
`;
const WORKFLOW_DISPATCH_RECEIPT_AUDIT_SQL = `
ALTER TABLE release_execution_reports ADD COLUMN publish_workflow_run_id TEXT NULL;
ALTER TABLE release_execution_reports ADD COLUMN publish_workflow_run_url TEXT NULL;
ALTER TABLE deployment_execution_reports ADD COLUMN publish_workflow_run_id TEXT NULL;
ALTER TABLE deployment_execution_reports ADD COLUMN publish_workflow_run_url TEXT NULL;
ALTER TABLE deployment_execution_reports ADD COLUMN deploy_workflow_run_id TEXT NULL;
ALTER TABLE deployment_execution_reports ADD COLUMN deploy_workflow_run_url TEXT NULL;
`;
const LLM_EVAL_AND_GOVERNANCE_FOUNDATION_SQL = `
${LLM_EVAL_DDL}

${PROMPT_MODEL_POLICY_GOVERNANCE_DDL}
`;
const ENTERPRISE_GOVERNANCE_FOUNDATION_SQL = `
${ENTERPRISE_GOVERNANCE_DDL}
`;
const CONTROL_PLANE_LOAD_BALANCING_FOUNDATION_SQL = `
${CONTROL_PLANE_LOAD_BALANCING_DDL}
`;
const SKILL_GOVERNANCE_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS skill_registry (
  id TEXT NULL,
  skill_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  required_tools_json TEXT NOT NULL,
  required_permissions_json TEXT NOT NULL,
  cacheable INTEGER NOT NULL DEFAULT 0,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0,
  avg_duration_ms REAL NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_registry_skill_id
  ON skill_registry(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_registry_lifecycle_updated_at
  ON skill_registry(lifecycle, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_registry_risk_updated_at
  ON skill_registry(risk_level, updated_at DESC);

CREATE TABLE IF NOT EXISTS skill_execution_policies (
  skill_id TEXT PRIMARY KEY,
  allow_execution INTEGER NOT NULL DEFAULT 1,
  require_approval INTEGER NOT NULL DEFAULT 0,
  max_concurrent_executions INTEGER NOT NULL DEFAULT 5,
  max_executions_per_hour INTEGER NOT NULL DEFAULT 100,
  rate_limit_window_ms INTEGER NOT NULL DEFAULT 3600000,
  blocked_message TEXT NULL,
  FOREIGN KEY(skill_id) REFERENCES skill_registry(skill_id) ON DELETE CASCADE
);
`;
const TASK_TENANT_SCOPE_SQL = `
ALTER TABLE tasks ADD COLUMN tenant_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_updated_at
  ON tasks(tenant_id, status, updated_at DESC);
`;
const BILLING_COLLECTION_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS billing_invoices (
  invoice_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  workspace_id TEXT NULL,
  tenant_id TEXT NULL,
  period_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  subtotal_usd REAL NOT NULL,
  tax_usd REAL NOT NULL,
  total_usd REAL NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  external_invoice_ref TEXT NULL,
  due_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT NULL,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_account_created_at
  ON billing_invoices(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_status
  ON billing_invoices(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_payment_sessions (
  session_id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  gateway_kind TEXT NOT NULL,
  gateway_session_ref TEXT NOT NULL,
  checkout_url TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  currency TEXT NOT NULL,
  expires_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  settled_at TEXT NULL,
  failure_code TEXT NULL,
  FOREIGN KEY(invoice_id) REFERENCES billing_invoices(invoice_id) ON DELETE CASCADE,
  FOREIGN KEY(account_id) REFERENCES billing_accounts(account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_billing_payment_sessions_invoice_created_at
  ON billing_payment_sessions(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payment_sessions_account_status
  ON billing_payment_sessions(account_id, status, created_at DESC);
`;
const PRODUCT_GOVERNANCE_TENANT_SCOPE_SQL = `
ALTER TABLE extension_packages ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE marketplace_reviews ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE marketplace_publications ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE marketplace_governance_reports ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE perception_sources ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE intel_items ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE intel_briefs ADD COLUMN tenant_id TEXT NULL;
ALTER TABLE action_proposals ADD COLUMN tenant_id TEXT NULL;

DROP INDEX IF EXISTS idx_extension_packages_extension_version;
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_packages_tenant_extension_version
  ON extension_packages(COALESCE(tenant_id, ''), extension_id, version);
CREATE INDEX IF NOT EXISTS idx_extension_packages_tenant_updated_at
  ON extension_packages(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_tenant_submitted_at
  ON marketplace_reviews(tenant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_tenant_updated_at
  ON marketplace_publications(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_governance_reports_tenant_generated_at
  ON marketplace_governance_reports(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_perception_sources_tenant_enabled_priority
  ON perception_sources(tenant_id, enabled, priority DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_items_tenant_captured_at
  ON intel_items(tenant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_items_tenant_importance_relevance
  ON intel_items(tenant_id, importance DESC, relevance_score DESC, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_briefs_tenant_generated_at
  ON intel_briefs(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_proposals_tenant_brief_created_at
  ON action_proposals(tenant_id, brief_id, created_at DESC);
`;

export const MEMORY_ENHANCEMENT_SQL = `
-- 5A-1: Add kind/status/importance/freshness/content_hash columns to memories table
ALTER TABLE memories ADD COLUMN kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE memories ADD COLUMN importance_score REAL NULL;
ALTER TABLE memories ADD COLUMN freshness_score REAL NULL;
ALTER TABLE memories ADD COLUMN content_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_kind_status ON memories(kind, status);
CREATE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance_score DESC);

-- 5A-2: session_summaries table
CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_id TEXT NULL,
  agent_id TEXT NULL,
  summary_text TEXT NOT NULL,
  key_decisions TEXT NULL,
  key_outcomes TEXT NULL,
  memory_ids_referenced TEXT NULL,
  token_count INTEGER NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_summaries_session ON session_summaries(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_summaries_task ON session_summaries(task_id, created_at DESC);
`;

export const EVENT_DEAD_LETTERS_SQL = `
CREATE TABLE IF NOT EXISTS event_dead_letters (
  id TEXT PRIMARY KEY,
  original_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  dead_lettered_at TEXT NOT NULL,
  reprocessed_at TEXT NULL,
  reprocess_result TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_dlq_type ON event_dead_letters(event_type, dead_lettered_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_dlq_consumer ON event_dead_letters(consumer_id, dead_lettered_at DESC);
`;

export const SESSION_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, created_at ASC);
`;

/**
 * Migration 41: Adds persistent Dead Letter Queue records table.
 * This replaces the in-memory Map storage to survive process restarts.
 */
export const DLQ_RECORDS_SQL = `
CREATE TABLE IF NOT EXISTS dlq_records (
  dead_letter_id TEXT PRIMARY KEY,
  source_event_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  error_code TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  original_timestamp TEXT NULL,
  failure_category TEXT NULL,
  retry_exhausted_at TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_dlq_records_status ON dlq_records(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_records_consumer ON dlq_records(consumer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_records_source_event ON dlq_records(source_event_id);
`;

export const BILLING_USAGE_EVENT_CANONICAL_ATTRIBUTION_SQL = `
ALTER TABLE usage_events ADD COLUMN harness_run_id TEXT NULL;
ALTER TABLE usage_events ADD COLUMN node_run_id TEXT NULL;
ALTER TABLE usage_events ADD COLUMN attempt_id TEXT NULL;
ALTER TABLE usage_events ADD COLUMN step_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_harness_run_captured_at
  ON usage_events(harness_run_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_node_run_captured_at
  ON usage_events(node_run_id, captured_at DESC);
`;

/**
 * Migration 50: Adds persistent config version snapshots and rollout tracking.
 * R15-78: ConfigVersioningService now persists version snapshots to SQLite.
 * R15-79: ConfigRolloutService now persists active rollouts to SQLite.
 */
export const CONFIG_VERSIONING_AND_ROLLOUT_SQL = `
-- Config version snapshots table for durable version history
CREATE TABLE IF NOT EXISTS config_version_snapshots (
  version_id TEXT PRIMARY KEY,
  config_path TEXT NOT NULL,
  layer TEXT NOT NULL,
  source_id TEXT NULL,
  content_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NULL,
  reason TEXT NULL,
  parent_version_id TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_config_version_snapshots_path_created
  ON config_version_snapshots(config_path, layer, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_version_snapshots_parent
  ON config_version_snapshots(parent_version_id);

-- Config rollback points table
CREATE TABLE IF NOT EXISTS config_rollback_points (
  rollback_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  config_path TEXT NOT NULL,
  layer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_config_rollback_points_path
  ON config_rollback_points(config_path, layer, created_at DESC);

-- Active config rollouts table for durable rollout tracking
CREATE TABLE IF NOT EXISTS config_rollouts (
  rollout_id TEXT PRIMARY KEY,
  config_path TEXT NOT NULL,
  layer TEXT NOT NULL,
  source_id TEXT NULL,
  stage_phase TEXT NOT NULL,
  stage_percentage INTEGER NOT NULL,
  stage_min_duration_ms INTEGER NOT NULL,
  stage_auto_progress INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  target_percentage INTEGER NOT NULL,
  current_percentage INTEGER NOT NULL,
  metadata_json TEXT NULL,
  health_gates_json TEXT NOT NULL,
  last_health_check_at TEXT NULL,
  last_health_check_passed INTEGER NULL
);
CREATE INDEX IF NOT EXISTS idx_config_rollouts_path
  ON config_rollouts(config_path, layer, source_id);
CREATE INDEX IF NOT EXISTS idx_config_rollouts_stage
  ON config_rollouts(stage_phase, updated_at DESC);
`;
