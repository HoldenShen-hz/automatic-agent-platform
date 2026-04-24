import { ENTERPRISE_GOVERNANCE_DDL } from "../../control-plane/incident-control/enterprise-governance-schema.js";
import { OUTBOX_SCHEMA_SQL } from "./sql/outbox-schema.js";
import { CONTROL_PLANE_LOAD_BALANCING_DDL } from "./sql/control-plane-load-balancing-ddl.js";
import { AUTHORITATIVE_SCHEMA_SQL } from "./sql/authoritative-schema.js";
import {
  LLM_EVAL_DDL,
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
} from "../../prompt-engine/eval/prompt-model-policy-governance-schema.js";
import {
  BILLING_COLLECTION_FOUNDATION_SQL,
  CONTROL_PLANE_LOAD_BALANCING_FOUNDATION_SQL,
  DATA_PLANE_FLOW_FOUNDATION_SQL,
  DLQ_RECORDS_SQL,
  ENTERPRISE_GOVERNANCE_FOUNDATION_SQL,
  EVENT_DEAD_LETTERS_SQL,
  LLM_EVAL_AND_GOVERNANCE_FOUNDATION_SQL,
  PRODUCT_GOVERNANCE_TENANT_SCOPE_SQL,
  RELEASE_DEPLOYMENT_LEDGER_SQL,
  RELEASE_EXECUTION_REPORTS_SQL,
  SECRET_LEASES_SQL,
  SESSION_EVENTS_SQL,
  SKILL_GOVERNANCE_FOUNDATION_SQL,
  TASK_TENANT_SCOPE_SQL,
  TENANT_DATA_NAMESPACE_FOUNDATION_SQL,
  WORKFLOW_DISPATCH_RECEIPT_AUDIT_SQL,
} from "./sqlite/sqlite-migration-runtime-part3.js";

export type SchemaInventoryCategory =
  | "core_truth"
  | "runtime_extension"
  | "governance_extension"
  | "reliability_extension";

export type DocumentedSchemaInventoryGroup =
  | "workflow_execution"
  | "decision_policy"
  | "knowledge_artifact"
  | "ops_governance"
  | "ai_operations"
  | "domain_organization"
  | "maturity_lifecycle";

export interface SchemaInventoryRecord {
  readonly tableName: string;
  readonly category: SchemaInventoryCategory;
  readonly documentedGroup: DocumentedSchemaInventoryGroup;
  readonly source: string;
}

const SCHEMA_INVENTORY_SOURCES = [
  {
    source: "authoritative_schema",
    category: "core_truth",
    sql: AUTHORITATIVE_SCHEMA_SQL,
  },
  {
    source: "tenant_data_namespace_foundation",
    category: "runtime_extension",
    sql: TENANT_DATA_NAMESPACE_FOUNDATION_SQL,
  },
  {
    source: "data_plane_flow_foundation",
    category: "runtime_extension",
    sql: DATA_PLANE_FLOW_FOUNDATION_SQL,
  },
  {
    source: "release_deployment_ledger",
    category: "runtime_extension",
    sql: RELEASE_DEPLOYMENT_LEDGER_SQL,
  },
  {
    source: "secret_leases",
    category: "reliability_extension",
    sql: SECRET_LEASES_SQL,
  },
  {
    source: "release_execution_reports",
    category: "runtime_extension",
    sql: RELEASE_EXECUTION_REPORTS_SQL,
  },
  {
    source: "workflow_dispatch_receipt_audit",
    category: "runtime_extension",
    sql: WORKFLOW_DISPATCH_RECEIPT_AUDIT_SQL,
  },
  {
    source: "llm_eval_foundation",
    category: "governance_extension",
    sql: LLM_EVAL_AND_GOVERNANCE_FOUNDATION_SQL,
  },
  {
    source: "enterprise_governance_foundation",
    category: "governance_extension",
    sql: ENTERPRISE_GOVERNANCE_FOUNDATION_SQL,
  },
  {
    source: "control_plane_load_balancing_foundation",
    category: "runtime_extension",
    sql: CONTROL_PLANE_LOAD_BALANCING_FOUNDATION_SQL,
  },
  {
    source: "skill_governance_foundation",
    category: "governance_extension",
    sql: SKILL_GOVERNANCE_FOUNDATION_SQL,
  },
  {
    source: "task_tenant_scope",
    category: "runtime_extension",
    sql: TASK_TENANT_SCOPE_SQL,
  },
  {
    source: "billing_collection_foundation",
    category: "runtime_extension",
    sql: BILLING_COLLECTION_FOUNDATION_SQL,
  },
  {
    source: "product_governance_tenant_scope",
    category: "governance_extension",
    sql: PRODUCT_GOVERNANCE_TENANT_SCOPE_SQL,
  },
  {
    source: "event_dead_letters",
    category: "reliability_extension",
    sql: EVENT_DEAD_LETTERS_SQL,
  },
  {
    source: "session_events",
    category: "runtime_extension",
    sql: SESSION_EVENTS_SQL,
  },
  {
    source: "dlq_records",
    category: "reliability_extension",
    sql: DLQ_RECORDS_SQL,
  },
  {
    source: "prompt_model_policy_governance",
    category: "governance_extension",
    sql: PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
  },
  {
    source: "llm_eval",
    category: "governance_extension",
    sql: LLM_EVAL_DDL,
  },
  {
    source: "enterprise_governance",
    category: "governance_extension",
    sql: ENTERPRISE_GOVERNANCE_DDL,
  },
  {
    source: "control_plane_load_balancing",
    category: "runtime_extension",
    sql: CONTROL_PLANE_LOAD_BALANCING_DDL,
  },
  {
    source: "outbox",
    category: "reliability_extension",
    sql: OUTBOX_SCHEMA_SQL,
  },
] as const;

const CREATE_TABLE_PATTERN = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;

const DOCUMENTED_GROUP_PATTERNS: readonly Array<{
  readonly group: DocumentedSchemaInventoryGroup;
  readonly pattern: RegExp;
}> = [
  {
    group: "workflow_execution",
    pattern: /^(agent_execution_records|delegation_events|delegations|event_consumer_acks|events|execution_.*|executions|heartbeat_snapshots|lease_audits|messages|outbox|sessions|session_events|takeover_sessions|tasks|worker_snapshots|workflow_.*)$/,
  },
  {
    group: "decision_policy",
    pattern: /^(action_proposals|approvals|budget_alerts|entitlement_decisions|evolution_policies|evolution_proposals|governance_gate_events|governance_releases|operator_actions|quota_counters|skill_execution_policies)$/,
  },
  {
    group: "knowledge_artifact",
    pattern: /^(artifacts|experience_cache|intel_briefs|intel_items|marketplace_listings|memories|pack_.*|perception_sources|prompt_.*|tool_result_files)$/,
  },
  {
    group: "ops_governance",
    pattern: /^(coordinator_instance_snapshots|dead_letters|dlq_records|enterprise_governance_reports|event_dead_letters|file_locks|gateway_targets|incident_handoff_records|remote_log_entries|secret_leases)$/,
  },
  {
    group: "ai_operations",
    pattern: /^(analytics_facts|cost_.*|eval_.*|pmf_validation_reports|token_usage_daily|usage_events)$/,
  },
  {
    group: "domain_organization",
    pattern: /^(billing_accounts|billing_invoices|billing_payment_sessions|data_namespaces|deployment_bindings|organization_memberships|organizations|tenant_.*|tenants|workspace_memberships|workspaces)$/,
  },
  {
    group: "maturity_lifecycle",
    pattern: /^(archive_bundles|compaction_records|data_movement_jobs|deployment_execution_reports|environment_promotion_history|evolution_logs|release_.*|replay_datasets)$/,
  },
] as const;

const DEFAULT_DOCUMENTED_GROUP_BY_CATEGORY: Readonly<Record<SchemaInventoryCategory, DocumentedSchemaInventoryGroup>> = {
  core_truth: "workflow_execution",
  runtime_extension: "maturity_lifecycle",
  governance_extension: "decision_policy",
  reliability_extension: "ops_governance",
};

function resolveDocumentedGroup(
  tableName: string,
  category: SchemaInventoryCategory,
): DocumentedSchemaInventoryGroup {
  for (const candidate of DOCUMENTED_GROUP_PATTERNS) {
    if (candidate.pattern.test(tableName)) {
      return candidate.group;
    }
  }
  return DEFAULT_DOCUMENTED_GROUP_BY_CATEGORY[category];
}

export class SchemaInventoryService {
  public listTables(): SchemaInventoryRecord[] {
    const tables = new Map<string, SchemaInventoryRecord>();
    for (const source of SCHEMA_INVENTORY_SOURCES) {
      for (const match of source.sql.matchAll(CREATE_TABLE_PATTERN)) {
        const tableName = match[1];
        if (tableName == null || tables.has(tableName)) {
          continue;
        }
        tables.set(tableName, {
          tableName,
          category: source.category,
          documentedGroup: resolveDocumentedGroup(tableName, source.category),
          source: source.source,
        });
      }
    }
    return [...tables.values()].sort((left, right) => left.tableName.localeCompare(right.tableName));
  }

  public buildSummary(): {
    totalTables: number;
    byCategory: Record<SchemaInventoryCategory, number>;
    byDocumentedGroup: Record<DocumentedSchemaInventoryGroup, number>;
    sources: string[];
  } {
    const tables = this.listTables();
    return {
      totalTables: tables.length,
      byCategory: tables.reduce<Record<SchemaInventoryCategory, number>>(
        (summary, table) => {
          summary[table.category] += 1;
          return summary;
        },
        {
          core_truth: 0,
          runtime_extension: 0,
          governance_extension: 0,
          reliability_extension: 0,
        },
      ),
      byDocumentedGroup: tables.reduce<Record<DocumentedSchemaInventoryGroup, number>>(
        (summary, table) => {
          summary[table.documentedGroup] += 1;
          return summary;
        },
        {
          workflow_execution: 0,
          decision_policy: 0,
          knowledge_artifact: 0,
          ops_governance: 0,
          ai_operations: 0,
          domain_organization: 0,
          maturity_lifecycle: 0,
        },
      ),
      sources: [...new Set(tables.map((table) => table.source))],
    };
  }
}
