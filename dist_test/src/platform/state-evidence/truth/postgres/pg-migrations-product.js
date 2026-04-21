/**
 * @fileoverview PostgreSQL migrations for billing, intelligence, PMF, and tenant product governance.
 */
import { defineMigration } from "./pg-schema-support.js";
const MIGRATION_07_BILLING = defineMigration(7, "billing", `
CREATE TABLE IF NOT EXISTS billing_accounts (
  account_id VARCHAR(255) PRIMARY KEY,
  owner_id VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(255) NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_owner_status
  ON billing_accounts(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_workspace_status
  ON billing_accounts(workspace_id, status);

CREATE TABLE IF NOT EXISTS usage_events (
  usage_id VARCHAR(255) PRIMARY KEY,
  account_id VARCHAR(255) NOT NULL,
  subject_id VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(255) NULL,
  tenant_id VARCHAR(255) NULL,
  task_id VARCHAR(255) NULL,
  execution_id VARCHAR(255) NULL,
  metric_type TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL,
  unit_price_usd DOUBLE PRECISION NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_account_captured_at
  ON usage_events(account_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_account_metric_window
  ON usage_events(account_id, metric_type, captured_at DESC);

CREATE TABLE IF NOT EXISTS quota_counters (
  counter_id VARCHAR(255) PRIMARY KEY,
  account_id VARCHAR(255) NOT NULL,
  metric_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  used_quantity DOUBLE PRECISION NOT NULL,
  limit_quantity DOUBLE PRECISION NULL,
  limit_type TEXT NULL,
  reset_policy TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_counters_account_metric_window
  ON quota_counters(account_id, metric_type, window_start, window_end);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id VARCHAR(255) PRIMARY KEY,
  account_id VARCHAR(255) NOT NULL,
  usage_id VARCHAR(255) NULL,
  period_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount_usd DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  source_ref TEXT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_recorded_at
  ON ledger_entries(account_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_period
  ON ledger_entries(account_id, period_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS entitlement_decisions (
  decision_id VARCHAR(255) PRIMARY KEY,
  account_id VARCHAR(255) NOT NULL,
  feature_key TEXT NOT NULL,
  metric_type TEXT NULL,
  requested_quantity DOUBLE PRECISION NULL,
  allowed INTEGER NOT NULL,
  decision_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entitlement_decisions_account_evaluated_at
  ON entitlement_decisions(account_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlement_decisions_feature_evaluated_at
  ON entitlement_decisions(feature_key, evaluated_at DESC);
`);
/**
 * Migration 8: Intelligence and action systems
 */
const MIGRATION_08_INTELLIGENCE = defineMigration(8, "intelligence", `
CREATE TABLE IF NOT EXISTS perception_sources (
  source_id VARCHAR(255) PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  schedule_json JSONB NULL,
  filters_json JSONB NULL,
  priority INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_perception_sources_enabled_priority
  ON perception_sources(enabled, priority DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS intel_items (
  intel_id VARCHAR(255) PRIMARY KEY,
  source_id VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_ref TEXT NOT NULL,
  relevance_score DOUBLE PRECISION NOT NULL,
  importance DOUBLE PRECISION NOT NULL,
  tags_json JSONB NOT NULL,
  dedupe_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intel_items_source_dedupe_key
  ON intel_items(source_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_intel_items_captured_at
  ON intel_items(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_items_importance_relevance
  ON intel_items(importance DESC, relevance_score DESC, captured_at DESC);

CREATE TABLE IF NOT EXISTS intel_briefs (
  brief_id VARCHAR(255) PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  source_scope_json JSONB NOT NULL,
  item_ids_json JSONB NOT NULL,
  overall_summary TEXT NOT NULL,
  recommended_actions_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intel_briefs_generated_at
  ON intel_briefs(generated_at DESC);

CREATE TABLE IF NOT EXISTS action_proposals (
  proposal_id VARCHAR(255) PRIMARY KEY,
  brief_id VARCHAR(255) NOT NULL,
  intel_id VARCHAR(255) NULL,
  task_id VARCHAR(255) NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  requires_approval INTEGER NOT NULL,
  proposal_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_action_proposals_brief_created_at
  ON action_proposals(brief_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_proposals_status_created_at
  ON action_proposals(status, created_at DESC);
`);
/**
 * Migration 9: HITL, evolution, and governance
 */
const MIGRATION_09_GOVERNANCE = defineMigration(9, "governance", `
CREATE TABLE IF NOT EXISTS takeover_sessions (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  operator_id VARCHAR(255) NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_takeover_sessions_task_started_at ON takeover_sessions(task_id, started_at);
CREATE INDEX IF NOT EXISTS idx_takeover_sessions_status ON takeover_sessions(status, started_at);

CREATE TABLE IF NOT EXISTS operator_actions (
  id VARCHAR(255) PRIMARY KEY,
  takeover_session_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  operator_id VARCHAR(255) NOT NULL,
  action_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  action_payload_json JSONB NOT NULL,
  before_state_json JSONB NOT NULL,
  after_state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operator_actions_task_created_at ON operator_actions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operator_actions_session_created_at ON operator_actions(takeover_session_id, created_at);

CREATE TABLE IF NOT EXISTS evolution_proposals (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  source_agent_id VARCHAR(255) NOT NULL,
  kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_id VARCHAR(255) NULL,
  summary TEXT NOT NULL,
  proposal_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ NULL,
  applied_at TIMESTAMPTZ NULL,
  rolled_back_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_evolution_proposals_task_created_at
  ON evolution_proposals(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_proposals_status_updated_at
  ON evolution_proposals(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_proposals_scope_status
  ON evolution_proposals(scope_type, scope_ref, status);

CREATE TABLE IF NOT EXISTS evolution_policies (
  id VARCHAR(255) PRIMARY KEY,
  proposal_id VARCHAR(255) NOT NULL,
  kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  rolled_back_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evolution_policies_proposal_id
  ON evolution_policies(proposal_id);
CREATE INDEX IF NOT EXISTS idx_evolution_policies_scope_status
  ON evolution_policies(scope_type, scope_ref, status);

CREATE TABLE IF NOT EXISTS evolution_logs (
  id VARCHAR(255) PRIMARY KEY,
  proposal_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NULL,
  event_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  before_state_json JSONB NULL,
  after_state_json JSONB NULL,
  metadata_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evolution_logs_proposal_created_at
  ON evolution_logs(proposal_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_task_created_at
  ON evolution_logs(task_id, created_at DESC);
`);
/**
 * Migration 10: PMF validation
 */
const MIGRATION_10_PMF = defineMigration(10, "pmf", `
CREATE TABLE IF NOT EXISTS pmf_validation_reports (
  id VARCHAR(255) PRIMARY KEY,
  profile_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  division_id VARCHAR(255) NULL,
  verdict TEXT NOT NULL,
  summary_json JSONB NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pmf_validation_reports_generated_at
  ON pmf_validation_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmf_validation_reports_profile_generated_at
  ON pmf_validation_reports(profile_name, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmf_validation_reports_division_generated_at
  ON pmf_validation_reports(division_id, generated_at DESC);
`);
/**
 * Migration 11: Completes tenant-scoped product/governance coverage and PG parity for marketplace tables.
 */
const MIGRATION_11_PRODUCT_GOVERNANCE_TENANT_SCOPE = defineMigration(11, "product_governance_tenant_scope", `
CREATE TABLE IF NOT EXISTS extension_packages (
  package_id VARCHAR(255) PRIMARY KEY,
  tenant_id TEXT NULL,
  extension_id TEXT NOT NULL,
  package_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL,
  owner TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  capabilities_json JSONB NOT NULL,
  permissions_json JSONB NOT NULL,
  compatibility_json JSONB NOT NULL,
  signature_verified INTEGER NOT NULL,
  manifest_checksum TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  review_required INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  review_id VARCHAR(255) PRIMARY KEY,
  tenant_id TEXT NULL,
  package_id VARCHAR(255) NOT NULL,
  status TEXT NOT NULL,
  submitter TEXT NOT NULL,
  reviewer TEXT NULL,
  decision_reason_code TEXT NULL,
  findings_json JSONB NOT NULL,
  permission_surface_hash TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS marketplace_publications (
  publication_id VARCHAR(255) PRIMARY KEY,
  tenant_id TEXT NULL,
  package_id VARCHAR(255) NOT NULL,
  review_id VARCHAR(255) NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  compatibility_matrix_json JSONB NOT NULL,
  revocation_reason_code TEXT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_governance_reports (
  report_id VARCHAR(255) PRIMARY KEY,
  tenant_id TEXT NULL,
  summary_json JSONB NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE extension_packages ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE marketplace_reviews ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE marketplace_publications ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE marketplace_governance_reports ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE perception_sources ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE intel_items ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE intel_briefs ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE action_proposals ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;

DROP INDEX IF EXISTS idx_extension_packages_extension_version;
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_packages_tenant_extension_version
  ON extension_packages(COALESCE(tenant_id, ''), extension_id, version);
CREATE INDEX IF NOT EXISTS idx_extension_packages_tenant_updated_at
  ON extension_packages(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_package_submitted_at
  ON marketplace_reviews(package_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_status_submitted_at
  ON marketplace_reviews(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_tenant_submitted_at
  ON marketplace_reviews(tenant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_channel_updated_at
  ON marketplace_publications(channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_package_updated_at
  ON marketplace_publications(package_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_tenant_updated_at
  ON marketplace_publications(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_governance_reports_generated_at
  ON marketplace_governance_reports(generated_at DESC);
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
`);
const MIGRATION_12_AUTHORITATIVE_ASYNC_PARITY = defineMigration(12, "authoritative_async_parity", `
ALTER TABLE memories ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS agent_id VARCHAR(255) NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS execution_id VARCHAR(255) NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS memory_layer TEXT NOT NULL DEFAULT 'layer_3';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source_trust_level TEXT NOT NULL DEFAULT 'trusted';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS quality_score DOUBLE PRECISION NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS hit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS revocation_reason TEXT NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS importance_score DOUBLE PRECISION NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS freshness_score DOUBLE PRECISION NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS content_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_scope_created_at
  ON memories(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_task_created_at
  ON memories(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_session_created_at
  ON memories(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_execution_created_at
  ON memories(execution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_layer_scope_created_at
  ON memories(memory_layer, scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_kind_status
  ON memories(kind, status);
CREATE INDEX IF NOT EXISTS idx_memories_content_hash
  ON memories(content_hash);
CREATE INDEX IF NOT EXISTS idx_memories_importance
  ON memories(importance_score DESC);

CREATE TABLE IF NOT EXISTS secret_registry (
  secret_ref TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  rotation_policy_json JSONB NOT NULL,
  metadata_json JSONB NULL,
  current_version TEXT NULL,
  last_rotated_at TIMESTAMPTZ NULL,
  next_rotation_due_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_registry_status_due_at
  ON secret_registry(status, next_rotation_due_at);
CREATE INDEX IF NOT EXISTS idx_secret_registry_scope
  ON secret_registry(scope_type, scope_ref, status);

CREATE TABLE IF NOT EXISTS secret_usage_audits (
  audit_id TEXT PRIMARY KEY,
  secret_ref TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  task_id VARCHAR(255) NULL,
  execution_id VARCHAR(255) NULL,
  requested_by TEXT NOT NULL,
  granted_to TEXT NOT NULL,
  usage_purpose TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  masked_value TEXT NULL,
  metadata_json JSONB NULL
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
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata_json JSONB NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_events_secret_occurred_at
  ON secret_rotation_events(secret_ref, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_events_status_occurred_at
  ON secret_rotation_events(status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS environment_readiness_records (
  readiness_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  component_type TEXT NOT NULL,
  component_id TEXT NOT NULL,
  credential_ready INTEGER NOT NULL,
  secondary_gates_json JSONB NOT NULL,
  owner TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL,
  is_active INTEGER NOT NULL,
  notes TEXT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_environment_readiness_component_active
  ON environment_readiness_records(environment, component_type, component_id, is_active);
CREATE INDEX IF NOT EXISTS idx_environment_readiness_environment_verified
  ON environment_readiness_records(environment, last_verified_at DESC);

CREATE TABLE IF NOT EXISTS deployment_bindings (
  binding_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  deployment_mode TEXT NOT NULL,
  region TEXT NOT NULL,
  network_boundary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_bindings_tenant_environment
  ON deployment_bindings(tenant_id, environment_id);

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
  required_readiness_checks_json JSONB NOT NULL,
  recommended_commands_json JSONB NOT NULL,
  task_id VARCHAR(255) NULL,
  json_artifact_uri TEXT NULL,
  markdown_artifact_uri TEXT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL
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
  publish_workflow_run_id TEXT NULL,
  publish_workflow_run_url TEXT NULL,
  deploy_workflow_run_id TEXT NULL,
  deploy_workflow_run_url TEXT NULL,
  execution_mode TEXT NOT NULL,
  publish_command TEXT NOT NULL,
  deploy_command TEXT NOT NULL,
  command_results_json JSONB NOT NULL,
  release_bundle_id TEXT NULL,
  task_id VARCHAR(255) NULL,
  json_artifact_uri TEXT NULL,
  markdown_artifact_uri TEXT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL
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
  metadata_json JSONB NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_environment_promotion_history_target_recorded_at
  ON environment_promotion_history(target_environment, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_promotion_history_source_target
  ON environment_promotion_history(source_environment, target_environment, recorded_at DESC);

CREATE TABLE IF NOT EXISTS secret_leases (
  lease_id TEXT PRIMARY KEY,
  secret_ref TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  task_id VARCHAR(255) NULL,
  execution_id VARCHAR(255) NULL,
  requested_by TEXT NOT NULL,
  granted_to TEXT NOT NULL,
  usage_purpose TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_by TEXT NULL,
  revocation_reason_code TEXT NULL,
  source_version TEXT NULL,
  masked_value TEXT NULL,
  metadata_json JSONB NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_leases_secret_issued_at
  ON secret_leases(secret_ref, issued_at DESC, lease_id DESC);
CREATE INDEX IF NOT EXISTS idx_secret_leases_status_expires_at
  ON secret_leases(status, expires_at ASC, lease_id ASC);
CREATE INDEX IF NOT EXISTS idx_secret_leases_granted_to_status
  ON secret_leases(granted_to, status, expires_at ASC);

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
  registry_lease_expires_at TIMESTAMPTZ NULL,
  registry_lease_revoked_at TIMESTAMPTZ NULL,
  publish_workflow_run_id TEXT NULL,
  publish_workflow_run_url TEXT NULL,
  build_command TEXT NOT NULL,
  publish_command TEXT NOT NULL,
  command_results_json JSONB NOT NULL,
  task_id VARCHAR(255) NULL,
  json_artifact_uri TEXT NULL,
  markdown_artifact_uri TEXT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_release_execution_reports_environment_exported_at
  ON release_execution_reports(environment, exported_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_execution_reports_bundle_exported_at
  ON release_execution_reports(bundle_id, exported_at DESC);
`);
const MIGRATION_13_KNOWLEDGE_SEMANTIC_VECTORS = defineMigration(13, "knowledge_semantic_vectors", `
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION
    WHEN undefined_file THEN
      RAISE NOTICE 'pgvector extension is unavailable; skipping knowledge semantic vector table bootstrap';
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS knowledge_semantic_vectors (
        knowledge_ref TEXT PRIMARY KEY,
        chunk_id VARCHAR(255) NOT NULL,
        document_id VARCHAR(255) NOT NULL,
        namespace TEXT NOT NULL,
        embedding_id TEXT NULL,
        embedding_model TEXT NOT NULL,
        embedding vector(32) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    ';
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_knowledge_semantic_vectors_namespace_updated_at
      ON knowledge_semantic_vectors(namespace, updated_at DESC)
    ';
    BEGIN
      EXECUTE '
        CREATE INDEX IF NOT EXISTS idx_knowledge_semantic_vectors_embedding
        ON knowledge_semantic_vectors
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      ';
    EXCEPTION
      WHEN undefined_object THEN
        RAISE NOTICE 'pgvector ivfflat index unavailable; knowledge semantic vectors will use heap scan';
    END;
  END IF;
END $$;
`, {
    downDdl: `
DROP TABLE IF EXISTS knowledge_semantic_vectors;
`,
});
export { MIGRATION_07_BILLING, MIGRATION_08_INTELLIGENCE, MIGRATION_09_GOVERNANCE, MIGRATION_10_PMF, MIGRATION_11_PRODUCT_GOVERNANCE_TENANT_SCOPE, MIGRATION_12_AUTHORITATIVE_ASYNC_PARITY, MIGRATION_13_KNOWLEDGE_SEMANTIC_VECTORS, };
//# sourceMappingURL=pg-migrations-product.js.map