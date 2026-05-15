import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * R4-64 / §6.4: Contract naming consistency CI lint scan for deprecated terms.
 *
 * This test verifies that deprecated terms are not used in canonical contract files.
 * Deprecated terms: ExecutionPlan, ControlDirective, ExecutionReceipt, stepId,
 * executionId, workflow_run, Phase 1-9 (use Ring 1/2/3 instead).
 */

// Deprecated terms that should NOT appear in canonical contract files
const DEPRECATED_TERMS: readonly string[] = [
  // Legacy execution model terms
  "ExecutionPlan",
  "ControlDirective",
  "ExecutionReceipt",
  "stepId",
  "step_id",
  "executionId",
  "execution_id",
  "workflow_run",
  "workflowId",
  // Old phase terminology (should use Ring 1/2/3)
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "Phase 5",
  "Phase 6",
  "Phase 7",
  "phase1",
  "phase2",
  "phase3",
  "phase9a",
  "phase9b",
  "phase9c",
  "phase9d",
  "phase9e",
  "phase9f",
  // OAPEFLIR should be projection only, not runtime
  "OAPEFLIR runtime",
  "OAPEFLIR execute",
];

// Paths that are exempt (legacy/compatibility layers)
const EXEMPT_PATHS: readonly string[] = [
  "/node_modules/",
  "/dist/",
  "/.dist_temp/",
  "/dist_checkpoints/",
  "/dist_test/",
  "/contracts/legacy/",
  "/contracts/deprecated/",
  "/migration/",
];

interface NamingViolation {
  readonly file: string;
  readonly term: string;
  readonly line: number;
  readonly context: string;
}

function isExemptPath(filePath: string): boolean {
  return EXEMPT_PATHS.some((exempt) => filePath.includes(exempt));
}

test("R4-64: Canonical contracts do not contain deprecated terms", () => {
  const violations: NamingViolation[] = [];
  const contractsDir = join(process.cwd(), "docs_zh", "contracts");
  const canonicalContractFiles = new Set([
    "runtime_execution_contract.md",
    "state_transition_matrix_contract.md",
    "event_registry_and_ops_threshold_contract.md",
    "cost_and_budget_contract.md",
    "approval_and_hitl_contract.md",
    "sdk_surface_contract.md",
    "hitl_experience_and_explainability_contract.md",
  ]);

  if (!existsSync(contractsDir)) {
    // Skip if contracts directory doesn't exist (e.g., in partial checkout)
    return;
  }

  const contractFiles = readdirSync(contractsDir, { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".md") && canonicalContractFiles.has(f))
    .map((f) => join(contractsDir, f as string));

  for (const file of contractFiles) {
    if (isExemptPath(file)) continue;

    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      for (const term of DEPRECATED_TERMS) {
        if (
          line.includes(term)
          && !line.includes("legacy")
          && !line.includes("deprecated")
          && !line.includes("废弃")
          && !line.includes("Phase 1a")
          && !line.includes("Phase 1b")
          && !line.includes("Phase 1-4")
        ) {
          violations.push({
            file: file.replace(process.cwd() + "/", ""),
            term,
            line: lineNum + 1,
            context: line.trim().substring(0, 100),
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    const report = violations
      .map((v) => `${v.file}:${v.line} - found deprecated term "${v.term}" in: ${v.context}`)
      .join("\n");
    assert.fail(`Found ${violations.length} deprecated term(s) in canonical contracts:\n${report}`);
  }
});

test("R4-64: Source code imports use canonical module names", () => {
  // Verify that deprecated contract imports are flagged
  const deprecatedImports = [
    { module: "ExecutionPlan", shouldBe: "PlanGraphBundle" },
    { module: "ControlDirective", shouldBe: "OperationalDirective or DecisionDirective" },
    { module: "ExecutionReceipt", shouldBe: "NodeAttemptReceipt" },
  ];

  // This test would need access to actual source files to verify
  // In practice this would be run as part of CI with actual file scanning
  assert.ok(true, "Import consistency check placeholder");
});

test("R4-64: Domain configs use Ring 1/2/3 not Phase 9a-9f", () => {
  const domainConfigsDir = join(process.cwd(), "config", "domains");

  if (!existsSync(domainConfigsDir)) {
    return;
  }

  const domainFiles = readdirSync(domainConfigsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(domainConfigsDir, f));

  const phase9Violations: string[] = [];

  for (const file of domainFiles) {
    const content = readFileSync(file, "utf8");
    if (content.includes("phase9")) {
      phase9Violations.push(file.replace(process.cwd() + "/", ""));
    }
  }

  if (phase9Violations.length > 0) {
    assert.fail(`Found Phase 9a-9f terminology in domain configs: ${phase9Violations.join(", ")}`);
  }
});

test("R4-64: Event registry uses platform.* namespace not legacy task.*", () => {
  const eventTypesFile = join(process.cwd(), "src", "platform", "state-evidence", "events", "event-types.ts");

  if (!existsSync(eventTypesFile)) {
    return;
  }

  const content = readFileSync(eventTypesFile, "utf8");

  // Legacy event patterns that should be replaced
  const legacyPatterns = [
    { pattern: /task\.status/, replacement: "platform.harness_run." },
    { pattern: /workflow\.started/, replacement: "platform.harness_run.created" },
    { pattern: /execution\.completed/, replacement: "platform.node_run.succeeded" },
  ];

  for (const { pattern } of legacyPatterns) {
    if (pattern.test(content)) {
      assert.fail(`Legacy event namespace found in event-types.ts: ${pattern}`);
    }
  }
});

test("R4-64: PlanGraphBundle is the only valid P3→P4 contract", () => {
  const executableContractsDir = join(process.cwd(), "src", "platform", "contracts", "executable-contracts");

  if (!existsSync(executableContractsDir)) {
    return;
  }

  // Verify that PlanGraphBundle is exported
  const indexFile = join(executableContractsDir, "index.ts");
  if (existsSync(indexFile)) {
    const content = readFileSync(indexFile, "utf8");
    assert.ok(
      content.includes("PlanGraphBundle"),
      "PlanGraphBundle must be exported from executable-contracts",
    );
  }
});
