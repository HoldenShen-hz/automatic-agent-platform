#!/usr/bin/env node
/**
 * Audit: tenant isolation
 *
 * Scans routes / repositories / queries for hard-coded or missing tenantId
 * propagation. Pattern from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §9.1.
 *
 * Heuristics:
 *   1. Route handler that reaches a repository without `tenantId` in scope.
 *      We mark a finding when a route's body has `req.`, `request.`, or
 *      `params.` but no `tenantId` reference and the same file imports
 *      a known repository.
 *   2. Repository method whose body builds a SQL/where clause that does
 *      not mention `tenantId`.
 *   3. `broadcastToAll` / `broadcast(` / `clients.forEach` style calls
 *      without an explicit tenant filter.
 *   4. `app.get/post/put/delete` registration in route files that lack
 *      a `tenantGuard` / `requireTenant` middleware.
 *
 * This is a static heuristic, not a full dataflow analysis. False positives
 * are suppressed via the comment marker `// tenant-audit: skip`.
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
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "src";
})();

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const SKIP_MARKER = /\btenant-audit:\s*skip\b/;

const ROUTE_INDICATORS = [
  /app\s*\.\s*(get|post|put|delete|patch)\s*\(/i,
  /router\s*\.\s*(get|post|put|delete|patch)\s*\(/i,
  /@Route\s*\(/i,
  /@Controller\s*\(/i,
];

const REPO_INDICATORS = [
  /Repository\b/,
  /repository\b/,
  /\.findMany\s*\(/,
  /\.findFirst\s*\(/,
  /\.findUnique\s*\(/,
  /\.where\s*\(/,
  /where:\s*\{/,
  /SELECT.*FROM\s+/i,
  /db\s*\.\s*select\s*\(/,
  /db\s*\.\s*query\s*\(/,
];

const TENANT_PATTERNS = [
  /\btenantId\b/,
  /\btenant_id\b/,
  /tenantContext/i,
  /requireTenant/i,
  /tenantGuard/i,
  /withTenant/i,
];

const BROADCAST_INDICATORS = [
  /broadcastToAll\s*\(/,
  /clients\s*\.\s*forEach\s*\(/,
  /io\s*\.\s*emit\s*\(/,
  /publishAll\s*\(/,
];

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

function hasAny(text, patterns) {
  return patterns.some((re) => re.test(text));
}

function findFindings(filePath) {
  const rel = relative(repoRoot, filePath);
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  const hasTenant = hasAny(text, TENANT_PATTERNS);
  const hasRoute = hasAny(text, ROUTE_INDICATORS);
  const hasRepo = hasAny(text, REPO_INDICATORS);
  const hasBroadcast = hasAny(text, BROADCAST_INDICATORS);

  // Heuristic 1: route with no tenant context
  if (hasRoute && !hasTenant) {
    findings.push({
      rule: "tenant_isolation.route_missing_tenant",
      severity: "P0",
      path: rel,
      line: 1,
      message:
        "Route registration detected but no tenantId/tenantGuard/requireTenant reference in file. Cross-tenant access risk.",
    });
  }
  // Heuristic 2: repository without tenant filter
  if (hasRepo && !hasTenant) {
    findings.push({
      rule: "tenant_isolation.repo_missing_tenant",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Repository/query detected but no tenantId filter in file. Cross-tenant data leak risk.",
    });
  }
  // Heuristic 3: broadcast without tenant filter
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_MARKER.test(line)) continue;
    for (const indicator of BROADCAST_INDICATORS) {
      if (indicator.test(line) && !hasTenant) {
        findings.push({
          rule: "tenant_isolation.broadcast_unscoped",
          severity: "P0",
          path: rel,
          line: i + 1,
          message: `Broadcast call '${indicator}' without explicit tenant filter.`,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
    }
  }
  return findings;
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
  const roots = stat.isDirectory() ? [focusAbs] : [focusAbs];
  // When the focus path is a single file, return it directly.
  const files = stat.isDirectory()
    ? roots.flatMap((root) => walk(root))
    : roots.filter((f) => SCAN_EXTS.has(extname(f)));
  const findings = [];
  for (const file of files) {
    findings.push(...findFindings(file));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: files.length,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.some((f) => f.severity === "P0")) {
    process.exitCode = 1;
  }
}

main();
