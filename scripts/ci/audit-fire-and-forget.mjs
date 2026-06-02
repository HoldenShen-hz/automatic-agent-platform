#!/usr/bin/env node
/**
 * Audit: fire-and-forget Promise
 *
 * Scans src/ for unawaited Promise-returning calls. Pattern from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §20.6.2.
 *
 * A "fire-and-forget" call is one that:
 *   1. Returns a Promise (call to a method that returns a Promise, or
 *      an `async`/`await`-able callee, or a `Promise.<T>` type);
 *   2. Is not awaited, not chained, not returned, and not stored in a variable;
 *   3. Appears as a bare expression statement.
 *
 * High-severity cases: catch handlers that swallow errors silently (`.catch(() => {})`)
 * around async work, or `.then(...)` chains without `.catch(...)`.
 *
 * Output: JSON to stdout with `findings[]` of shape:
 *   { rule, severity, path, line, column, message, snippet }
 *
 * Exit code:
 *   0  -- no P0/P1 findings (with --check) or report mode (no --check)
 *   1  -- one or more P0/P1 findings (with --check)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "src";
})();

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
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

// Async/Promise callee tokens (heuristic): these are method names that
// conventionally return Promises in this codebase, and bare calls
// to them as expression statements are a strong fire-and-forget signal.
const PROMISE_RETURNING_METHODS = new Set([
  "send",
  "publish",
  "emit",
  "dispatch",
  "enqueue",
  "ack",
  "nack",
  "commit",
  "settle",
  "refresh",
  "flush",
  "capture",
  "schedule",
  "raise",
  "broadcast",
  "acknowledge",
  "fire",
  "trigger",
  "run",
  "exec",
  "execute",
  "apply",
  "settleWith",
  "transition",
  "load",
  "write",
  "save",
  "record",
  "append",
  "emit",
  "submit",
  "resolve",
  "reject",
  "process",
  "handle",
]);

const fireAndForgetRegex = /^\s*([A-Za-z_$][A-Za-z0-9_$.]*)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/m;

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

function findFindings(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    // Skip comments & obvious safe lines
    if (line.length === 0) continue;
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
    // await / return / assignment means not fire-and-forget
    if (/(?:^|\s)(?:await|return|const|let|var|yield)\s+/.test(raw)) continue;
    // Skip if the call is being passed as an argument (probably awaited by caller)
    if (/,\s*$/.test(raw) || /\(\s*$/.test(raw)) continue;

    const match = line.match(fireAndForgetRegex);
    if (!match) continue;
    const callee = match[2];
    if (!PROMISE_RETURNING_METHODS.has(callee)) continue;
    // Final-shape filter: the line is an expression statement ending in `);` or `)`
    if (!/[\);]\s*$/.test(line)) continue;
    // Skip if there's a `.catch` or `.then` chained on the same line (already handled)
    if (/\.then\s*\(/.test(line) && /\.catch\s*\(/.test(line)) continue;

    findings.push({
      rule: "fire_and_forget_promise",
      severity: "P1",
      path: relative(repoRoot, filePath),
      line: i + 1,
      column: raw.indexOf(match[0]) + 1,
      message: `Bare call to .${callee}(...) is not awaited; downstream failures will be silently dropped.`,
      snippet: raw.length > 200 ? raw.slice(0, 200) + "…" : raw,
    });
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
  if (checkMode && findings.some((f) => f.severity === "P0" || f.severity === "P1")) {
    process.exitCode = 1;
  }
}

main();
