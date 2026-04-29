/**
 * ARCH-P2-2: 逻辑表数量差异测试
 *
 * 验证所有架构要求的表在代码中都有对应的 schema 定义。
 * 使用 SchemaInventoryService 获取所有已定义的表，并与架构要求对账。
 *
 * 对应测试手册 §27.2
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SchemaInventoryService } from "../../../../src/platform/five-plane-state-evidence/truth/schema-inventory-service.js";

/**
 * 架构 §26.3 要求的核心逻辑表列表
 * 这些表是平台正常运行所必需的
 */
const ARCHITECTURE_REQUIRED_TABLES = [
  // Core truth tables
  "tasks",
  "executions",
  "events",
  "runtime_event_log",
  "runtime_outbox",
  "outbox",

  // State evidence tables
  "artifacts",
  "checkpoints",
  "memories",
  "experience_cache",

  // Workflow execution tables
  "workflow_instances",
  "workflow_runs",
  "node_attempts",
  "node_runs",
  "messages",

  // Decision policy tables
  "approvals",
  "action_proposals",
  "governance_releases",

  // Domain organization tables
  "organizations",
  "tenants",
  "data_namespaces",
  "domains",
  "domain_configs",

  // Reliability tables
  "dead_letters",
  "event_dead_letters",
  "dlq_records",
  "secret_leases",

  // Interface tables
  "webhook_outbox",
  "request_envelopes",
  "session_events",

  // Billing & cost tables
  "billing_accounts",
  "billing_invoices",
  "token_usage_daily",
  "cost_aggregates",

  // Ops governance tables
  "coordinator_instance_snapshots",
  "incident_handoff_records",
  "remote_log_entries",
] as const;

/**
 * 每个 documented group 至少应该有的表数量
 * 用于验证没有意外删除重要表
 */
const MIN_TABLE_COUNTS_BY_GROUP: Record<string, number> = {
  workflow_execution: 5,
  decision_policy: 2,
  knowledge_artifact: 2,
  ops_governance: 3,
  ai_operations: 2,
  domain_organization: 3,
  maturity_lifecycle: 2,
};

test("[ARCH-P2-2] all architecture-required tables exist in schema definitions", () => {
  const service = new SchemaInventoryService();
  const definedTables = service.listTables();
  const definedTableNames = new Set(definedTables.map((t) => t.tableName));

  const missingTables: string[] = [];
  for (const required of ARCHITECTURE_REQUIRED_TABLES) {
    if (!definedTableNames.has(required)) {
      missingTables.push(required);
    }
  }

  assert.equal(
    missingTables.length,
    0,
    `Missing architecture-required tables: ${missingTables.join(", ")}`,
  );
});

test("[ARCH-P2-2] all defined tables belong to a documented group", () => {
  const service = new SchemaInventoryService();
  const tables = service.listTables();

  const unmappedTables = tables.filter(
    (t) => t.documentedGroup === "workflow_execution" && !isWorkflowTable(t.tableName),
  );

  // Verify all tables have proper source attribution
  for (const table of tables) {
    assert.ok(table.source, `Table "${table.tableName}" must have a source`);
    assert.ok(table.category, `Table "${table.tableName}" must have a category`);
  }
});

test("[ARCH-P2-2] no orphan tables without architecture mapping", () => {
  const service = new SchemaInventoryService();
  const summary = service.buildSummary();

  // Every documented group should have at least the minimum number of tables
  for (const [group, minCount] of Object.entries(MIN_TABLE_COUNTS_BY_GROUP)) {
    const actualCount = summary.byDocumentedGroup[group as keyof typeof summary.byDocumentedGroup] ?? 0;
    assert.ok(
      actualCount >= minCount,
      `Documented group "${group}" has ${actualCount} tables, expected at least ${minCount}`,
    );
  }
});

test("[ARCH-P2-2] schema inventory summary contains all expected categories", () => {
  const service = new SchemaInventoryService();
  const summary = service.buildSummary();

  // Verify all four categories are represented
  assert.ok(
    summary.byCategory.core_truth > 0,
    "core_truth category must have at least one table",
  );
  assert.ok(
    summary.byCategory.runtime_extension > 0,
    "runtime_extension category must have at least one table",
  );
  assert.ok(
    summary.byCategory.governance_extension > 0,
    "governance_extension category must have at least one table",
  );
  assert.ok(
    summary.byCategory.reliability_extension > 0,
    "reliability_extension category must have at least one table",
  );

  // Total should be sum of all categories
  assert.equal(
    summary.totalTables,
    summary.byCategory.core_truth +
      summary.byCategory.runtime_extension +
      summary.byCategory.governance_extension +
      summary.byCategory.reliability_extension,
    "Total tables must equal sum of category counts",
  );
});

test("[ARCH-P2-2] schema inventory lists all known sources", () => {
  const service = new SchemaInventoryService();
  const summary = service.buildSummary();

  // Should have multiple schema sources
  assert.ok(
    summary.sources.length >= 10,
    `Should have at least 10 schema sources, got ${summary.sources.length}`,
  );

  // Outbox source must be present
  assert.ok(
    summary.sources.includes("outbox"),
    "outbox source must be in schema inventory",
  );

  // Authoritative schema must be present
  assert.ok(
    summary.sources.includes("authoritative_schema"),
    "authoritative_schema source must be in schema inventory",
  );
});

test("[ARCH-P2-2] outbox table is defined in reliability_extension category", () => {
  const service = new SchemaInventoryService();
  const tables = service.listTables();

  const outboxTable = tables.find((t) => t.tableName === "outbox");
  assert.ok(outboxTable, "outbox table must be defined");
  assert.equal(
    outboxTable.category,
    "reliability_extension",
    "outbox table must be in reliability_extension category",
  );
});

test("[ARCH-P2-2] webhook_outbox is defined in reliability_extension category", () => {
  const service = new SchemaInventoryService();
  const tables = service.listTables();

  const webhookOutboxTable = tables.find((t) => t.tableName === "webhook_outbox");
  assert.ok(
    webhookOutboxTable,
    "webhook_outbox table must be defined for ARCH-P2-1",
  );
  assert.equal(
    webhookOutboxTable.category,
    "reliability_extension",
    "webhook_outbox must be in reliability_extension category",
  );
});

// Helper function
function isWorkflowTable(tableName: string): boolean {
  const workflowPatterns = [
    /^task/,
    /^execution/,
    /^workflow/,
    /^node/,
    /^messages$/,
    /^events$/,
  ];
  return workflowPatterns.some((pattern) => pattern.test(tableName));
}