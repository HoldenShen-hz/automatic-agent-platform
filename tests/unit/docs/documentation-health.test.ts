import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const DOC_ROOT = join(process.cwd(), "docs_zh");
const ADR_ROOT = join(DOC_ROOT, "adr");
const ADR_README = join(ADR_ROOT, "README.md");
const CONTRACTS_ROOT = join(DOC_ROOT, "contracts");
const COVERAGE_MATRIX = join(DOC_ROOT, "analysis", "00-architecture-coverage-matrix.md");
const ARCHITECTURE_REVIEW = join(DOC_ROOT, "reviews", "architecture-design-vs-implementation-review.md");

function listMarkdownFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...listMarkdownFiles(fullPath));
    } else if (entry.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function extractRelativeMarkdownLinks(markdown: string): string[] {
  const matches = markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
  const links: string[] = [];
  for (const match of matches) {
    const rawTarget = match[1]?.trim().replace(/^<|>$/g, "") ?? "";
    if (
      rawTarget.length === 0 ||
      rawTarget.startsWith("#") ||
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("mailto:")
    ) {
      continue;
    }
    links.push(rawTarget.split("#", 1)[0]!);
  }
  return links;
}

test("documentation markdown links resolve to existing local files", () => {
  const markdownFiles = listMarkdownFiles(DOC_ROOT);

  for (const filePath of markdownFiles) {
    const content = readFileSync(filePath, "utf8");
    const relativeLinks = extractRelativeMarkdownLinks(content);

    for (const relativeLink of relativeLinks) {
      const resolved = join(dirname(filePath), relativeLink);
      assert.ok(
        existsSync(resolved),
        `${filePath} contains a broken relative link: ${relativeLink}`,
      );
    }
  }
});

test("ADR README indexes every ADR markdown file exactly once", () => {
  const readme = readFileSync(ADR_README, "utf8");
  const adrFiles = listMarkdownFiles(ADR_ROOT)
    .filter((filePath) => !filePath.endsWith("README.md"))
    .map((filePath) => filePath.split("/").at(-1) ?? "");

  for (const adrFile of adrFiles) {
    assert.match(readme, new RegExp(`\\(\\./${adrFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
  }

  const indexedLinks = Array.from(readme.matchAll(/\(\.\/(\d{3}-[^)]+\.md)\)/g)).map((match) => match[1]!);
  assert.deepEqual(indexedLinks.sort(), [...adrFiles].sort());
});

test("documentation root contains required structural files", () => {
  assert.ok(existsSync(join(DOC_ROOT, "README.md")));
  assert.ok(existsSync(ADR_ROOT));
  assert.ok(existsSync(ADR_README));
  assert.ok(existsSync(join(DOC_ROOT, "architecture", "README.md")));
  assert.ok(existsSync(join(DOC_ROOT, "migration", "README.md")));
  assert.ok(existsSync(join(DOC_ROOT, "quality", "README.md")));
  assert.ok(existsSync(join(DOC_ROOT, "analysis", "README.md")));
});

test("v2.7 coverage matrix and new authoritative contracts exist", () => {
  assert.ok(existsSync(COVERAGE_MATRIX));

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

  for (const fileName of requiredContracts) {
    assert.ok(existsSync(join(CONTRACTS_ROOT, fileName)), `missing contract file: ${fileName}`);
  }
});

test("architecture implementation review is aligned to current closure wording", () => {
  const review = readFileSync(ARCHITECTURE_REVIEW, "utf8");
  assert.match(review, /架构设计 vs 实现状态/);
  assert.match(review, /collaboration-protocol/);
  assert.match(review, /canonical-meta-model/);
  assert.match(review, /ConstraintPack/);
});
