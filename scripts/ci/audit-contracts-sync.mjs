#!/usr/bin/env node
/**
 * Audit: contracts sync
 *
 * N-way reconciliation of contract artifacts. Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §8 and §25.2.
 *
 * The old implementation treated concept labels like "Configuration" and
 * "OAPEFLIR" as if they were exact TS/OpenAPI symbol names, which created
 * systematic false positives. This version audits concrete canonical
 * contracts that actually exist in the repo and uses normalized matching
 * across docs / TS / runtime schema / tests.
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "docs_zh/contracts";
})();
const outputPath = join(repoRoot, "artifacts", "assurance", "contracts-sync-report.json");
const ALLOWLIST_PATH = "config/quality/contracts-sync-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx", ".md", ".json", ".yaml", ".yml"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const CONTRACT_SPECS = [
  {
    id: "EventEnvelope",
    docAliases: ["event-envelope-contract"],
    tsTokens: ["EventEnvelope"],
    schemaTokens: ["EventEnvelopeSchema"],
    testTokens: ["EventEnvelope"],
    requiredLayers: ["doc", "ts", "test"],
  },
  {
    id: "HarnessRun",
    docAliases: ["harness-run-contract", "harness-run-lifecycle-contract", "harness_run_lifecycle_contract"],
    tsTokens: ["HarnessRun"],
    schemaTokens: ["HarnessRunSchema"],
    testTokens: ["HarnessRun"],
    requiredLayers: ["doc", "ts", "test"],
  },
  {
    id: "MissionRecord",
    docAliases: ["task-and-workflow-contract", "task_and_workflow_contract"],
    tsTokens: ["MissionRecord"],
    schemaTokens: ["MissionRecordSchema"],
    testTokens: ["MissionRecord"],
    requiredLayers: ["doc", "ts", "schema", "test"],
  },
  {
    id: "BudgetLedger",
    docAliases: ["budget-ledger-contract"],
    tsTokens: ["BudgetLedger"],
    schemaTokens: ["BudgetLedgerSchema"],
    testTokens: ["BudgetLedger"],
    requiredLayers: ["doc", "ts", "test"],
  },
  {
    id: "SideEffectRecord",
    docAliases: ["side-effect-reconciliation-contract"],
    tsTokens: ["SideEffectRecord"],
    schemaTokens: ["SideEffectRecordSchema"],
    testTokens: ["SideEffectRecord"],
    requiredLayers: ["doc", "ts", "test"],
  },
  {
    id: "NodeAttemptReceipt",
    docAliases: ["node-run-attempt-receipt-contract"],
    tsTokens: ["NodeAttemptReceipt"],
    schemaTokens: ["NodeAttemptReceiptSchema"],
    testTokens: ["NodeAttemptReceipt"],
    requiredLayers: ["doc", "ts", "test"],
  },
  {
    id: "ErrorCode",
    docAliases: ["error-code-registry-contract", "app-error-contract"],
    tsTokens: ["ErrorCode", "PlatformErrorCode"],
    schemaTokens: ["ErrorCodeSchema", "PlatformErrorCodeSchema"],
    testTokens: ["ErrorCode", "PlatformErrorCode"],
    requiredLayers: ["doc", "ts", "test"],
  },
  {
    id: "TaskIntake",
    docAliases: ["task-intake-request-contract"],
    tsTokens: ["IntakeRouteInput", "IntakeRouter", "IntakeAdmissionService"],
    schemaTokens: ["taskSchema", "safeJsonParseRecord"],
    testTokens: ["task-intake", "IntakeRouter"],
    requiredLayers: ["doc", "ts", "test"],
  },
];

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { exact: new Set(), prefix: [] };
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
    prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
  };
}

function isAllowlisted(name, allowlist) {
  if (allowlist.exact.has(name)) return true;
  return allowlist.prefix.some((p) => name.startsWith(p));
}

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && SCAN_EXTS.has(extname(entry.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

function fileContainsAnyToken(file, tokens) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  return tokens.some((token) => text.includes(token));
}

function findDoc(spec) {
  const docsRoot = join(repoRoot, "docs_zh", "contracts");
  if (!existsSync(docsRoot)) return null;
  const aliases = spec.docAliases.map(normalize);
  for (const file of readdirSync(docsRoot)) {
    const normalized = normalize(file);
    if (aliases.some((alias) => normalized.includes(alias))) {
      return relative(repoRoot, join(docsRoot, file));
    }
  }
  return null;
}

function findCodeLayer(roots, tokens, filePredicate = () => true) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  for (const root of roots) {
    const absRoot = join(repoRoot, root);
    if (!existsSync(absRoot)) continue;
    for (const file of walk(absRoot)) {
      if (!filePredicate(file)) continue;
      if (fileContainsAnyToken(file, tokens)) {
        return relative(repoRoot, file);
      }
    }
  }
  return null;
}

function findLayers(spec) {
  return {
    doc: findDoc(spec),
    ts: findCodeLayer(["src"], spec.tsTokens, (file) => /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(file)),
    schema: findCodeLayer(["src", "schemas", "eval"], spec.schemaTokens),
    test: findCodeLayer(["tests"], spec.testTokens),
  };
}

function main() {
  const focusAbs = resolve(repoRoot, focusPath);
  let stat;
  try {
    stat = statSync(focusAbs);
  } catch {
    console.error(JSON.stringify({ error: `path not found: ${focusPath}` }));
    process.exitCode = 2;
    return;
  }

  const allowlist = loadAllowlist();
  const findings = [];
  for (const spec of CONTRACT_SPECS) {
    if (isAllowlisted(spec.id, allowlist)) continue;
    const layers = findLayers(spec);
    const missing = spec.requiredLayers.filter((layer) => layers[layer] == null);
    if (missing.length === 0) continue;
    findings.push({
      rule: "contracts_sync.missing_layer",
      severity: "P0",
      path: focusPath,
      line: 1,
      contract: spec.id,
      message: `Contract '${spec.id}' is missing layers: ${missing.join(", ")}.`,
      missingLayers: missing,
      presentLayers: Object.fromEntries(Object.entries(layers).filter(([, value]) => value != null)),
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: relative(repoRoot, focusAbs),
    scannedFileCount: stat.isDirectory() ? walk(focusAbs).length : 1,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };

  mkdirSync(join(repoRoot, "artifacts", "assurance"), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
