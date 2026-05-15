import assert from "node:assert/strict";
import test from "node:test";

import { SchemaInventoryService } from "../../../../../src/platform/five-plane-state-evidence/truth/schema-inventory-service.js";

test("SchemaInventoryService exposes authoritative logical table inventory", () => {
  const service = new SchemaInventoryService();
  const tables = service.listTables();
  const summary = service.buildSummary();

  assert.equal(summary.totalTables >= 86, true);
  assert.equal(tables.length, summary.totalTables);
  assert.ok(tables.some((table) => table.tableName === "tasks" && table.category === "core_truth" && table.documentedGroup === "workflow_execution"));
  assert.ok(tables.some((table) => table.tableName === "outbox" && table.category === "reliability_extension" && table.documentedGroup === "workflow_execution"));
  assert.ok(tables.some((table) => table.tableName === "eval_runs" && table.category === "governance_extension" && table.documentedGroup === "ai_operations"));
  assert.ok(tables.some((table) => table.tableName === "deployment_bindings" && table.category === "runtime_extension" && table.documentedGroup === "domain_organization"));
  assert.ok(tables.some((table) => table.tableName === "artifacts" && table.documentedGroup === "knowledge_artifact"));
  assert.ok(tables.some((table) => table.tableName === "approvals" && table.documentedGroup === "decision_policy"));
  assert.ok(tables.some((table) => table.tableName === "enterprise_governance_reports" && table.documentedGroup === "ops_governance"));
  assert.ok(tables.some((table) => table.tableName === "release_bundles" && table.documentedGroup === "maturity_lifecycle"));
  assert.ok(tables.some((table) => table.tableName === "task_drafts" && table.source === "runtime_physical_schema"));
  assert.ok(tables.some((table) => table.tableName === "confirmed_task_specs" && table.source === "runtime_physical_schema"));
  assert.ok(tables.some((table) => table.tableName === "request_envelopes" && table.source === "runtime_physical_schema"));
  assert.ok(tables.some((table) => table.tableName === "node_attempt_receipts" && table.source === "runtime_physical_schema"));
  assert.ok(tables.some((table) => table.tableName === "runtime_event_log" && table.source === "runtime_physical_schema"));
  assert.equal(summary.byDocumentedGroup.workflow_execution > 0, true);
  assert.equal(summary.byDocumentedGroup.decision_policy > 0, true);
  assert.equal(summary.byDocumentedGroup.knowledge_artifact > 0, true);
  assert.equal(summary.byDocumentedGroup.ops_governance > 0, true);
  assert.equal(summary.byDocumentedGroup.ai_operations > 0, true);
  assert.equal(summary.byDocumentedGroup.domain_organization > 0, true);
  assert.equal(summary.byDocumentedGroup.maturity_lifecycle > 0, true);
});
