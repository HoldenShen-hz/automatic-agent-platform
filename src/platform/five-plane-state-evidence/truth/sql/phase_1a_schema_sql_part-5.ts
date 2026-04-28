/**
 * Phase 1A Schema SQL Part 5 - Missing Tables
 *
 * Implements missing tables identified in §26 storage layer review:
 * - Multi-tenancy: tenants, tenant_quotas, tenant_billing
 * - Agent delegation: delegations, delegation_events
 * - Cost management: cost_reports, budget_alerts, token_usage_daily
 * - Marketplace: marketplace_listings, pack_reviews, pack_downloads
 * - Prompt management: prompt_bundles, prompt_versions, prompt_ab_tests
 */

export const PHASE_1A_SCHEMA_SQL_PART_5 = `

-- ═══════════════════════════════════════════════════════════════════════════
-- MULTI-TENANCY TABLES (§26)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'default_tenant',
  status TEXT NOT NULL DEFAULT 'active',
  billing_plan TEXT NULL,
  sla_level TEXT NULL,
  allowed_regions_json TEXT NULL,
  quotas_json TEXT NULL,
  metadata_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_billing_plan ON tenants(billing_plan);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  quota_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  monthly_limit INTEGER NOT NULL,
  current_usage INTEGER NOT NULL DEFAULT 0,
  alert_threshold REAL NOT NULL DEFAULT 0.8,
  reset_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_quotas_tenant_resource
  ON tenant_quotas(tenant_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_reset_at ON tenant_quotas(reset_at);

CREATE TABLE IF NOT EXISTS tenant_billing (
  billing_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  billing_plan TEXT NOT NULL,
  billing_period_start TEXT NOT NULL,
  billing_period_end TEXT NOT NULL,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_url TEXT NULL,
  paid_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_billing_tenant_period
  ON tenant_billing(tenant_id, billing_period_start);

-- ═══════════════════════════════════════════════════════════════════════════
-- AGENT DELEGATION TABLES (§26)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS delegations (
  delegation_id TEXT PRIMARY KEY,
  parent_agent_id TEXT NOT NULL,
  child_agent_id TEXT NOT NULL,
  delegation_chain_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  depth INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NULL,
  result_ref TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delegations_parent ON delegations(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations(status);
CREATE INDEX IF NOT EXISTS idx_delegations_expires ON delegations(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS delegation_events (
  event_id TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(delegation_id) REFERENCES delegations(delegation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delegation_events_delegation
  ON delegation_events(delegation_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- COST MANAGEMENT TABLES (§26)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cost_reports (
  report_id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_cost_usd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  resource_costs_json TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_reports_tenant_period
  ON cost_reports(tenant_id, period_start);
CREATE INDEX IF NOT EXISTS idx_cost_reports_submitted_at
  ON cost_reports(submitted_at DESC);

CREATE TABLE IF NOT EXISTS budget_alerts (
  alert_id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  budget_type TEXT NOT NULL,
  threshold_usd REAL NOT NULL,
  current_spend_usd REAL NOT NULL DEFAULT 0,
  alert_level TEXT NOT NULL,
  triggered_at TEXT NULL,
  acknowledged_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_tenant_type
  ON budget_alerts(tenant_id, budget_type);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_triggered
  ON budget_alerts(triggered_at)
  WHERE triggered_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS token_usage_daily (
  usage_id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  pack_id TEXT NULL,
  date TEXT NOT NULL,
  model_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  step_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_usage_daily_tenant_date
  ON token_usage_daily(tenant_id, date, model_id, step_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_daily_date
  ON token_usage_daily(date DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- MARKETPLACE TABLES (§26)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS marketplace_listings (
  listing_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NULL,
  version TEXT NOT NULL,
  published_at TEXT NULL,
  deprecated_at TEXT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_pack
  ON marketplace_listings(pack_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status
  ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category
  ON marketplace_listings(category);

CREATE TABLE IF NOT EXISTS pack_reviews (
  review_id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT NULL,
  body TEXT NULL,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pack_reviews_listing
  ON pack_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_pack_reviews_user
  ON pack_reviews(user_id);

CREATE TABLE IF NOT EXISTS pack_downloads (
  download_id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  tenant_id TEXT NULL,
  user_id TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  source TEXT NULL,
  FOREIGN KEY(listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pack_downloads_listing
  ON pack_downloads(listing_id);
CREATE INDEX IF NOT EXISTS idx_pack_downloads_tenant
  ON pack_downloads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pack_downloads_downloaded_at
  ON pack_downloads(downloaded_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- PROMPT MANAGEMENT TABLES (§26)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prompt_bundles (
  bundle_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  domain TEXT NOT NULL,
  task_type TEXT NOT NULL,
  pack_id TEXT NULL,
  system_prompt_content TEXT NOT NULL,
  user_prompt_content TEXT NULL,
  few_shot_examples_json TEXT NULL,
  constraints_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  deprecated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_bundles_name_version
  ON prompt_bundles(name, version);
CREATE INDEX IF NOT EXISTS idx_prompt_bundles_domain_task
  ON prompt_bundles(domain, task_type);
CREATE INDEX IF NOT EXISTS idx_prompt_bundles_pack
  ON prompt_bundles(pack_id);

CREATE TABLE IF NOT EXISTS prompt_versions (
  version_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  version TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  traffic_weight INTEGER NOT NULL DEFAULT 100,
  traffic_allocation_json TEXT NULL,
  created_at TEXT NOT NULL,
  deprecated_at TEXT NULL,
  FOREIGN KEY(bundle_id) REFERENCES prompt_bundles(bundle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_bundle
  ON prompt_versions(bundle_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_current
  ON prompt_versions(bundle_id, is_current)
  WHERE is_current = 1;

CREATE TABLE IF NOT EXISTS prompt_ab_tests (
  test_id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  control_version TEXT NOT NULL,
  treatment_version TEXT NOT NULL,
  traffic_split_percent INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'draft',
  start_time TEXT NULL,
  end_time TEXT NULL,
  metrics_json TEXT NOT NULL,
  results_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(bundle_id) REFERENCES prompt_bundles(bundle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prompt_ab_tests_bundle
  ON prompt_ab_tests(bundle_id);
CREATE INDEX IF NOT EXISTS idx_prompt_ab_tests_status
  ON prompt_ab_tests(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delegations_created_at ON delegations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_reports_created_at ON cost_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_bundles_created_at ON prompt_bundles(created_at DESC);
`;