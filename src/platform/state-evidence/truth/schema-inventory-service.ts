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

export interface SchemaInventoryRecord {
  readonly tableName: string;
  readonly category: SchemaInventoryCategory;
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
          source: source.source,
        });
      }
    }
    return [...tables.values()].sort((left, right) => left.tableName.localeCompare(right.tableName));
  }

  public buildSummary(): {
    totalTables: number;
    byCategory: Record<SchemaInventoryCategory, number>;
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
      sources: [...new Set(tables.map((table) => table.source))],
    };
  }
}
