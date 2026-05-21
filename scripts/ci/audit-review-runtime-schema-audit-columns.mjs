#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const schemaPath = "src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts";
const docPath = "docs_zh/architecture/runtime-audit-and-soft-delete.md";

const coreTables = [
  "task_drafts",
  "confirmed_task_specs",
  "request_envelopes",
  "harness_runs",
  "plan_graph_bundles",
  "graph_patches",
  "node_runs",
  "node_attempts",
  "node_attempt_receipts",
  "side_effect_records",
  "budget_ledgers",
  "budget_reservations",
  "budget_settlements",
  "mission_records",
  "mission_memberships",
  "mission_context_snapshots",
  "run_version_locks",
  "artifact_version_lock_sets",
  "decision_input_bundles",
  "harness_decisions",
  "human_responsibility_records"
];

const exemptTables = ["mission_event_sequences", "runtime_event_log", "runtime_outbox", "runtime_audit_refs"];
const requiredColumns = [
  "created_by",
  "updated_at",
  "updated_by",
  "archived_at",
  "archived_by",
  "is_deleted",
  "deleted_at",
  "deleted_by"
];

const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function getTableBlock(sql, tableName) {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`CREATE TABLE IF NOT EXISTS ${escapedName} \\(([\\s\\S]*?)\\n\\);`);
  return sql.match(pattern)?.[1] ?? "";
}

const schemaSource = read(schemaPath);
const docSource = existsSync(docPath) ? read(docPath) : "";

check("runtime audit doc exists", existsSync(docPath), "runtime audit/soft-delete规范文档已落地");

for (const tableName of coreTables) {
  const block = getTableBlock(schemaSource, tableName);
  check(`${tableName} table exists`, block.length > 0, `${tableName} DDL 可提取`);
  for (const column of requiredColumns) {
    check(`${tableName} has ${column}`, block.includes(column), `${tableName} 包含 ${column}`);
  }
  check(`${tableName} documented`, docSource.includes(`- \`${tableName}\``), `规范文档列出 ${tableName}`);
}

for (const tableName of exemptTables) {
  const block = getTableBlock(schemaSource, tableName);
  check(`${tableName} exempt table exists`, block.length > 0, `${tableName} DDL 可提取`);
  check(`${tableName} stays exempt from is_deleted`, !block.includes("is_deleted"), `${tableName} 保持追加型/系统型豁免`);
  check(`${tableName} documented as exempt`, docSource.includes(`- \`${tableName}\``), `规范文档列出 ${tableName} 豁免`);
}

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`runtime schema audit columns audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`runtime schema audit columns audit passed: ${checks.length}/${checks.length}`);
