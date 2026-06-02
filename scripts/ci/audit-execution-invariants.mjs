#!/usr/bin/env node
/**
 * Audit: execution invariants
 *
 * Verifies that the repository contains test evidence for the execution /
 * evidence invariants called out by the audit methodology §10 / §11 and
 * §44.7. Unlike older file-name-based versions, this scanner matches
 * invariant categories against the real tests/ layout across invariant,
 * integration, and e2e suites.
 *
 * In single-file mode (--path points to one test file), the audit checks that
 * file's top-level test block count so seeded-defect self-tests can exercise
 * the thin-coverage rule deterministically.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "tests";
})();

const SCAN_EXTS = new Set([".ts"]);
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
]);
const ALLOWLIST_PATH = "config/quality/execution-invariants-allowlist.json";
const THIN_COVERAGE_THRESHOLD = 5;
const TEST_SCAN_ROOTS = [
  "tests/invariants",
  "tests/integration",
  "tests/e2e",
];

const REQUIRED_INVARIANT_CATEGORIES = [
  {
    id: "tenant_isolation",
    displayName: "tenant isolation",
    matchAny: [/\btenant[-_ ]?(isolation|boundary)\b/i, /\bcross[-_ ]tenant\b/i, /\bnoisy[-_ ]neighbor\b/i],
  },
  {
    id: "idempotency",
    displayName: "idempotency",
    matchAny: [/\bidempotenc(?:y|ies)\b/i, /\bx-idempotency-key\b/i],
  },
  {
    id: "lease_fencing",
    displayName: "lease / fencing",
    matchAny: [/\blease[-_ ]?fencing\b/i, /\bfencing(?:token)?\b/i],
  },
  {
    id: "side_effect_receipt",
    displayName: "side-effect receipt",
    matchAll: [/\bside[-_ ]?effect\b/i, /\b(receipt|auditref|audit:\/\/)\b/i],
  },
  {
    id: "audit_chain",
    displayName: "audit chain",
    matchAny: [/\baudit[-_ ]?chain\b/i, /\bauditref\b/i, /audit:\/\//i],
  },
  {
    id: "event_outbox",
    displayName: "event outbox",
    matchAny: [/\boutbox\b/i, /\bevent[-_ ]?atomicity\b/i, /\bevent sourcing replay\b/i],
  },
  {
    id: "recovery_replay",
    displayName: "recovery / replay",
    matchAny: [/\brecovery\b/i, /\breplay\b/i],
  },
  {
    id: "queue_visibility",
    displayName: "queue visibility",
    matchAny: [/\bqueue[-_ ]?visibility\b/i, /\bvisibility timeout\b/i, /\bqueue adapter\b/i, /\bqueue integration\b/i],
  },
];

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { exact: new Set(), prefix: [] };
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
    prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
  };
}

function isAllowlisted(rel, allowlist) {
  if (allowlist.exact.has(rel)) {
    return true;
  }
  return allowlist.prefix.some((prefix) => rel.startsWith(prefix));
}

function countTestBlocks(text) {
  const lines = text.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    if (/^\s*(\/\/|[*\/])/.test(line)) {
      continue;
    }
    if (/^\s*(?:it|test)\s*\(/.test(line)) {
      count += 1;
    }
  }
  return count;
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
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
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

function listRepositoryTestFiles(allowlist) {
  const files = [];
  for (const root of TEST_SCAN_ROOTS) {
    const absoluteRoot = join(repoRoot, root);
    if (!existsSync(absoluteRoot)) {
      continue;
    }
    for (const file of walk(absoluteRoot)) {
      const rel = relative(repoRoot, file).replace(/\\/g, "/");
      if (!isAllowlisted(rel, allowlist)) {
        files.push(file);
      }
    }
  }
  return files;
}

function fileMatchesCategory(rel, text, category) {
  const combined = `${rel}\n${text}`;
  if (Array.isArray(category.matchAll) && category.matchAll.length > 0) {
    return category.matchAll.every((pattern) => pattern.test(combined));
  }
  return category.matchAny.some((pattern) => pattern.test(combined));
}

function findCategoryFindings(allowlist) {
  const files = listRepositoryTestFiles(allowlist);
  const catalog = files.map((file) => {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    return {
      file,
      rel,
      text,
      testBlocks: countTestBlocks(text),
    };
  });

  const findings = [];
  const categoryCoverage = [];

  for (const category of REQUIRED_INVARIANT_CATEGORIES) {
    const evidenceFiles = catalog.filter((entry) => fileMatchesCategory(entry.rel, entry.text, category));
    const totalTestBlocks = evidenceFiles.reduce((sum, entry) => sum + entry.testBlocks, 0);
    categoryCoverage.push({
      category: category.id,
      evidenceFiles: evidenceFiles.map((entry) => entry.rel),
      totalTestBlocks,
    });

    if (evidenceFiles.length === 0) {
      findings.push({
        rule: "execution_invariants.missing_category_coverage",
        severity: "P0",
        path: `tests/${category.id}`,
        line: 0,
        message: `Missing test coverage for ${category.displayName} invariants across tests/invariants, tests/integration, and tests/e2e.`,
        snippet: category.displayName,
      });
      continue;
    }

    if (totalTestBlocks < THIN_COVERAGE_THRESHOLD) {
      findings.push({
        rule: "execution_invariants.thin_category_coverage",
        severity: "P1",
        path: evidenceFiles[0].rel,
        line: 0,
        message: `${category.displayName} invariants only have ${totalTestBlocks} top-level test block(s) across ${evidenceFiles.length} evidence file(s); expected >= ${THIN_COVERAGE_THRESHOLD}.`,
        snippet: evidenceFiles.map((entry) => entry.rel).slice(0, 3).join(", "),
      });
    }
  }

  return { findings, categoryCoverage, scannedFileCount: catalog.length };
}

function findFileFindings(file, allowlist) {
  const rel = relative(repoRoot, file).replace(/\\/g, "/");
  if (isAllowlisted(rel, allowlist)) {
    return [];
  }
  const text = readFileSync(file, "utf8");
  const testBlockCount = countTestBlocks(text);
  if (testBlockCount === 0) {
    return [];
  }
  if (testBlockCount < THIN_COVERAGE_THRESHOLD) {
    return [
      {
        rule: "execution_invariants.thin_coverage",
        severity: "P1",
        path: rel,
        line: 0,
        message: `Test file '${rel}' only has ${testBlockCount} top-level test block(s); expected >= ${THIN_COVERAGE_THRESHOLD}.`,
        snippet: rel,
      },
    ];
  }
  return [];
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
  let findings = [];
  let scannedFileCount = 0;
  let categoryCoverage = [];

  if (stat.isDirectory()) {
    const result = findCategoryFindings(allowlist);
    findings = result.findings;
    scannedFileCount = result.scannedFileCount;
    categoryCoverage = result.categoryCoverage;
  } else if (SCAN_EXTS.has(extname(focusAbs))) {
    findings = findFileFindings(focusAbs, allowlist);
    scannedFileCount = 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount,
    requiredCategories: REQUIRED_INVARIANT_CATEGORIES.map((entry) => entry.id),
    categoryCoverage,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.some((finding) => finding.severity === "P0")) {
    process.exitCode = 1;
  }
}

main();
