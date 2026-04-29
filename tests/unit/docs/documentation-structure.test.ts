import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DOC_ROOT = join(process.cwd(), "docs_zh");
const ADR_ROOT = join(DOC_ROOT, "adr");
const ADR_README = join(ADR_ROOT, "README.md");
const CONTRACTS_ROOT = join(DOC_ROOT, "contracts");

test("docs_zh root directory and top-level sections exist", () => {
  assert.ok(existsSync(DOC_ROOT));
  assert.ok(existsSync(join(DOC_ROOT, "architecture")));
  assert.ok(existsSync(join(DOC_ROOT, "adr")));
  assert.ok(existsSync(join(DOC_ROOT, "contracts")));
  assert.ok(existsSync(join(DOC_ROOT, "guides")));
  assert.ok(existsSync(join(DOC_ROOT, "migration")));
  assert.ok(existsSync(join(DOC_ROOT, "operations")));
  assert.ok(existsSync(join(DOC_ROOT, "quality")));
  assert.ok(existsSync(join(DOC_ROOT, "reviews")));
  assert.ok(existsSync(join(DOC_ROOT, "analysis")));
  assert.ok(existsSync(join(DOC_ROOT, "domains")));
  assert.ok(existsSync(join(DOC_ROOT, "governance")));
});

test("architecture README exists and references main architecture document", () => {
  const readmePath = join(DOC_ROOT, "architecture", "README.md");
  const content = readFileSync(readmePath, "utf8");
  assert.ok(content.length > 0);
  assert.match(content, /00-platform-architecture/);
});

test("ADR README indexes every ADR file exactly once", () => {
  const readme = readFileSync(ADR_README, "utf8");

  const adrFiles = readdirSync(ADR_ROOT)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  for (const adrFile of adrFiles) {
    const escaped = adrFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      readme,
      new RegExp(`\\(\\./${escaped}\\)`),
      `ADR README missing link to ${adrFile}`,
    );
  }

  const indexedLinks = Array.from(readme.matchAll(/\(\.\/(\d{3}-[^)]+\.md)\)/g))
    .map((m) => m[1]!)
    .sort();

  assert.deepStrictEqual(indexedLinks, adrFiles, "ADR README links do not match actual ADR files");
});

test("all required v2.7 contract documents exist", () => {
  const requiredContracts = [
    "domain_descriptor_and_onboarding_contract.md",
    "nl_entry_and_goal_decomposition_contract.md",
    "proactive_agent_and_autonomy_contract.md",
    "dashboard_and_operator_experience_contract.md",
    "org_hierarchy_and_dynamic_approval_contract.md",
    "sso_scim_and_identity_sync_contract.md",
    "knowledge_boundary_and_federated_search_contract.md",
    "delegated_governance_contract.md",
    "cross_region_routing_and_data_residency_contract.md",
    "quota_preemption_and_fair_scheduling_contract.md",
    "sla_tier_contract.md",
    "marketplace_catalog_and_revenue_contract.md",
    "feedback_improvement_pipeline_contract.md",
    "connector_framework_contract.md",
    "explainability_and_stage_rationale_contract.md",
    "platform_panic_and_resume_contract.md",
    "agent_definition_lifecycle_contract.md",
    "edge_runtime_and_sync_contract.md",
    "behavior_drift_detection_contract.md",
    "cost_attribution_and_optimization_contract.md",
    "workflow_debugger_contract.md",
    "compliance_report_generation_contract.md",
    "capacity_planning_contract.md",
    "multimodal_gateway_contract.md",
    "platform_ops_agent_contract.md",
  ];

  for (const contract of requiredContracts) {
    const path = join(CONTRACTS_ROOT, contract);
    assert.ok(
      existsSync(path),
      `required contract document missing: ${contract}`,
    );
  }
});

test("required structural docs exist at expected paths", () => {
  const requiredDocs = [
    "architecture/00-platform-architecture.md",
    "architecture/01-code-structure.md",
    "architecture/README.md",
    "migration/README.md",
    "quality/README.md",
    "analysis/README.md",
    "analysis/00-architecture-coverage-matrix.md",
    "reviews/architecture-design-vs-implementation-review.md",
    "reviews/architecture-code-cross-review.md",
  ];

  for (const doc of requiredDocs) {
    const path = join(DOC_ROOT, doc);
    assert.ok(
      existsSync(path),
      `required documentation missing: ${doc}`,
    );
  }
});

test("contract documents are non-empty and contain expected keywords", () => {
  const contractFiles = readdirSync(CONTRACTS_ROOT).filter((f) => f.endsWith(".md"));

  assert.ok(contractFiles.length > 0, "no contract documents found");

  for (const contractFile of contractFiles) {
    const content = readFileSync(join(CONTRACTS_ROOT, contractFile), "utf8");
    assert.ok(content.length > 100, `${contractFile} is too short to be a valid contract`);

    const hasContractMarker = /contract|interface|api|service/i.test(content);
    assert.ok(hasContractMarker, `${contractFile} does not appear to be a contract document`);
  }
});