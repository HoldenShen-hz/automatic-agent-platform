#!/usr/bin/env node
/**
 * Assurance Layer: collect-assumptions
 *
 * Scans `docs_zh/`, `docs_en/`, `README.md`, `AGENTS.md`, `MEMORY.md` for
 * "assumption-like" statements and emits a ledger under
 *   artifacts/assurance/assumptions.jsonl
 * plus a human-readable summary at
 *   artifacts/assurance/assumptions-summary.md
 *
 * Methodology:
 *   docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 *   §27.2 (Assumption Ledger).
 *
 * Trigger keywords (Chinese + English):
 *   "假定" / "假设" / "默认是" / "默认行为" / "在生产中"
 *   "YONO" / "experimental" / "prototype" / "disabled_by_default"
 *   "expected to" / "assumed to"
 *
 * Each matched line is emitted as a single JSONL record:
 *   {
 *     "assumptionId": "AAS-ASSUMPTION-000001",
 *     "statement":    "...",
 *     "evidence":     [],
 *     "riskIfFalse":  "...",
 *     "owner":        "TBD",
 *     "expiry":       "YYYY-MM-DD",     // 7 days from generation
 *     "status":       "unverified",
 *     "sourceRef":    "path/to/file.md#L<line>"
 *   }
 *
 * Exit code: 0 on success, 2 on IO error.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputDir = join(repoRoot, "artifacts", "assurance");
const outputJsonl = join(outputDir, "assumptions.jsonl");
const outputSummary = join(outputDir, "assumptions-summary.md");

const SCAN_EXTS = new Set([".md", ".markdown", ".mdx"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "artifacts",
  "build",
  ".tmp",
  ".test-db",
  ".cache",
  "archive", // historical archive directories are not authoritative
]);

const ROOT_FILES = ["README.md", "AGENTS.md", "MEMORY.md"];
const ROOT_DIRS = ["docs_zh", "docs_en"];

/** @type {{ re: RegExp; weight: number }[]} */
const TRIGGER_PATTERNS = [
  { re: /假定/g, weight: 2 },
  { re: /假设/g, weight: 2 },
  { re: /默认是/g, weight: 2 },
  { re: /默认行为/g, weight: 2 },
  { re: /在生产中/g, weight: 2 },
  { re: /YONO/g, weight: 1 },
  { re: /\bexperimental\b/gi, weight: 1 },
  { re: /\bprototype\b/gi, weight: 1 },
  { re: /\bdisabled_by_default\b/g, weight: 2 },
  { re: /\bexpected to\b/gi, weight: 1 },
  { re: /\bassumed to\b/gi, weight: 1 },
];

/** Risk heuristic — best-effort. */
const RISK_KEYWORDS = [
  { re: /disabled_by_default|默认(是|行为).*(关|禁用|disabled)/i, risk: "prototype domain exposed as production feature" },
  { re: /\bexperimental\b/i, risk: "experimental API/surface treated as stable" },
  { re: /\bprototype\b/i, risk: "prototype code shipped as production surface" },
  { re: /在生产中/, risk: "production assumption with unverified invariant" },
  { re: /YONO/i, risk: "YONO domain boundary violation" },
];

/**
 * @param {string} line
 * @returns {string}
 */
function deriveRisk(line) {
  for (const { re, risk } of RISK_KEYWORDS) {
    if (re.test(line)) return risk;
  }
  return "unverified assumption may misguide downstream decisions";
}

/**
 * Walks `dir` recursively, returning all file paths.
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && SCAN_EXTS.has(extname(e.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * Collects all source paths to scan.
 * @returns {string[]}
 */
function collectInputs() {
  const files = [];
  for (const f of ROOT_FILES) {
    const abs = join(repoRoot, f);
    if (existsSync(abs) && statSync(abs).isFile()) files.push(abs);
  }
  for (const d of ROOT_DIRS) {
    const abs = join(repoRoot, d);
    if (existsSync(abs)) files.push(...walk(abs));
  }
  // sort + dedupe
  return Array.from(new Set(files.map((p) => resolve(p)))).sort();
}

/**
 * Find assumption-bearing lines and return intermediate records.
 * @param {string} filePath
 * @returns {Omit<import('./types').Assumption, "assumptionId">[]>}
 */
function scanFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const rel = relative(repoRoot, filePath);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 4) continue;
    if (/^\s*(\/\/|[*#>/-]|#)/.test(line) && !/^#+\s*假定|^#+\s*假设/.test(line)) {
      // skip pure markup headings, but keep headings that themselves contain
      // assumption keywords (rare but possible)
    }
    let weight = 0;
    for (const p of TRIGGER_PATTERNS) {
      const m = line.match(p.re);
      if (m) weight += p.weight * m.length;
    }
    if (weight <= 0) continue;
    out.push({
      statement: line.trim().slice(0, 400),
      evidence: [],
      riskIfFalse: deriveRisk(line),
      owner: "TBD",
      // 7 days from generation, per §27.2 recommendation
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: "unverified",
      sourceRef: `${rel}#L${i + 1}`,
      weight,
    });
  }
  return out;
}

function dedupe(records) {
  const seen = new Map();
  for (const r of records) {
    const key = `${r.sourceRef}::${r.statement}`;
    const existing = seen.get(key);
    if (!existing || r.weight > existing.weight) seen.set(key, r);
  }
  return Array.from(seen.values());
}

function assignIds(records) {
  return records.map((r, idx) => ({
    assumptionId: `AAS-ASSUMPTION-${String(idx + 1).padStart(6, "0")}`,
    statement: r.statement,
    evidence: r.evidence,
    riskIfFalse: r.riskIfFalse,
    owner: r.owner,
    expiry: r.expiry,
    status: r.status,
    sourceRef: r.sourceRef,
  }));
}

function buildSummaryMd(records) {
  const lines = [];
  lines.push("# Assumption Ledger Summary");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total assumptions: ${records.length}`);
  lines.push("");
  if (records.length === 0) {
    lines.push("_No assumption statements were detected in the scanned corpus._");
    lines.push("");
    return lines.join("\n");
  }
  lines.push("| ID | Source | Risk | Status | Expiry |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of records) {
    const stmt = r.statement.replace(/\|/g, "\\|").slice(0, 80);
    lines.push(`| ${r.assumptionId} | \`${r.sourceRef}\` | ${r.riskIfFalse} | ${r.status} | ${r.expiry} |`);
    lines.push("");
    lines.push(`> ${stmt}`);
  }
  return lines.join("\n");
}

function main() {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const inputs = collectInputs();
  const raw = inputs.flatMap((p) => scanFile(p));
  const deduped = dedupe(raw);
  // sort by sourceRef for stable output
  deduped.sort((a, b) => String(a.sourceRef).localeCompare(String(b.sourceRef)));
  const records = assignIds(deduped);

  // Write JSONL — one record per line
  const body = records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
  writeFileSync(outputJsonl, body, "utf8");

  // Write summary
  writeFileSync(outputSummary, buildSummaryMd(records), "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        outputJsonl: relative(repoRoot, outputJsonl),
        outputSummary: relative(repoRoot, outputSummary),
        scannedFileCount: inputs.length,
        assumptionCount: records.length,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  main();
} catch (e) {
  process.stderr.write(`collect-assumptions: ${String(e?.stack ?? e)}\n`);
  process.exitCode = 2;
}
