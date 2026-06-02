#!/usr/bin/env node
/**
 * Audit: contracts sync
 *
 * N-way reconciliation of contract artifacts. Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §8 and §25.2.
 *
 * For each contract under docs_zh/contracts/, we look for:
 *   1. A TypeScript type in src/platform/contracts/ that names the contract
 *      (matched by a symbolic ID like `EventEnvelope` / `HarnessRun` /
 *      `TaskIntakeRequest` / `Mission` / `BudgetLedger` / `SideEffect` /
 *      `Receipt` / `ErrorCode`).
 *   2. A Zod schema (.schema.ts) declaring the same shape.
 *   3. A JSON schema file (.schema.json).
 *   4. An OpenAPI spec (openapi.yaml) referencing the name.
 *   5. A test file under tests/contract/ that references the symbol.
 *
 * The audit emits a finding per missing layer.
 *
 * Allowlist: `config/quality/contracts-sync-allowlist.json`.
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "docs_zh/contracts";
})();
const ALLOWLIST_PATH = "config/quality/contracts-sync-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx", ".md", ".json", ".yaml", ".yml"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const P0_CONTRACT_NAMES = [
  "EventEnvelope",
  "HarnessRun",
  "TaskIntakeRequest",
  "Mission",
  "BudgetLedger",
  "SideEffect",
  "Receipt",
  "ErrorCode",
  "Configuration",
  "OAPEFLIR",
];

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

function findDocsFor(name) {
  // 1. Look for contract docs
  const docsPath = "docs_zh/contracts";
  if (!existsSync(docsPath)) return { doc: null, ts: null, zod: null, json: null, openapi: null, test: null };
  let doc = null;
  for (const file of readdirSync(docsPath)) {
    if (file.toLowerCase().includes(name.toLowerCase())) {
      doc = join(docsPath, file);
      break;
    }
  }
  // 2. TS type
  let ts = null;
  const tsPath = "src/platform/contracts";
  if (existsSync(tsPath)) {
    for (const file of walk(tsPath)) {
      const text = readFileSync(file, "utf8");
      if (new RegExp(`\\b(export\\s+)?(interface|type|class)\\s+${name}\\b`).test(text)) {
        ts = file;
        break;
      }
    }
  }
  // 3. Zod / JSON schema
  let zod = null;
  let json = null;
  const schemasPath = "schemas";
  if (existsSync(schemasPath)) {
    for (const file of walk(schemasPath)) {
      if (file.toLowerCase().includes(name.toLowerCase()) && file.endsWith(".schema.json")) {
        json = file;
      }
    }
  }
  for (const file of walk("src")) {
    const text = readFileSync(file, "utf8");
    if (new RegExp(`z\\.object[^\\n]*${name}|z\\.enum\\([^)]*${name}`, "i").test(text)) {
      zod = file;
      break;
    }
  }
  // 4. OpenAPI
  let openapi = null;
  for (const path of ["openapi.yaml", "openapi.yml", "openapi.json"]) {
    if (existsSync(path)) {
      const text = readFileSync(path, "utf8");
      if (text.includes(name)) {
        openapi = path;
        break;
      }
    }
  }
  // 5. Test
  let test = null;
  for (const file of walk("tests")) {
    if (file.includes("contract") && readFileSync(file, "utf8").includes(name)) {
      test = file;
      break;
    }
  }
  return { doc, ts, zod, json, openapi, test };
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
  for (const name of P0_CONTRACT_NAMES) {
    if (isAllowlisted(name, allowlist)) continue;
    const layers = findDocsFor(name);
    const missing = Object.entries(layers)
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    if (missing.length === 0) continue;
    findings.push({
      rule: "contracts_sync.missing_layer",
      severity: "P0",
      path: focusPath,
      line: 1,
      contract: name,
      message: `Contract '${name}' is missing layers: ${missing.join(", ")}.`,
      missingLayers: missing,
      presentLayers: Object.fromEntries(Object.entries(layers).filter(([, v]) => v !== null)),
    });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
