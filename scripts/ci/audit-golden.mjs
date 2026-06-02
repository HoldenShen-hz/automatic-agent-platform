#!/usr/bin/env node
/**
 * Audit: golden / replay fixtures (§12.4)
 *
 * For every `.golden` fixture the platform relies on, this scanner
 * enforces the §12.4 contract:
 *
 *   - frozenClock MUST be set (wall-clock time, not Date.now)
 *   - deterministicId MUST be set
 *   - seedInjected MUST be set
 *   - exactEventMatch OR allowedDiffList MUST be declared
 *   - extraEvents MUST be backed by an allowedDiffList, otherwise P0
 *   - secretRedaction MUST be true
 *
 * Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.4 and §44.13.3.
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : ".";
})();

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

const RULES = {
  FROZEN_CLOCK_MISSING: "golden.frozen_clock_missing",
  DETERMINISTIC_ID_MISSING: "golden.deterministic_id_missing",
  SEED_INJECTED_MISSING: "golden.seed_injected_missing",
  MATCH_POLICY_MISSING: "golden.match_policy_missing",
  EXTRA_EVENTS_WITHOUT_DIFF_LIST: "golden.extra_events_without_diff_list",
  SECRET_REDACTION_MISSING: "golden.secret_redaction_missing",
  PARSE_FAILED: "golden.parse_failed",
};

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
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
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function isGoldenFixture(path) {
  return extname(path) === ".golden";
}

function loadFixture(file) {
  const text = readFileSync(file, "utf8");
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function findingsForFixture(fixturePath, fixture) {
  const rel = relative(repoRoot, fixturePath);
  const findings = [];
  if (fixture == null || typeof fixture !== "object" || Array.isArray(fixture)) {
    findings.push({
      rule: RULES.FROZEN_CLOCK_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} must be a JSON object.`,
    });
    return findings;
  }

  if (fixture.frozenClock == null) {
    findings.push({
      rule: RULES.FROZEN_CLOCK_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} is missing "frozenClock" (§12.4 requires explicit frozen time, not Date.now()).`,
    });
  }

  if (fixture.deterministicId == null) {
    findings.push({
      rule: RULES.DETERMINISTIC_ID_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} is missing "deterministicId".`,
    });
  }

  if (fixture.seedInjected == null) {
    findings.push({
      rule: RULES.SEED_INJECTED_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} is missing "seedInjected".`,
    });
  }

  const hasExact = "exactEventMatch" in fixture;
  const hasAllowed = Array.isArray(fixture.allowedDiffList) && fixture.allowedDiffList.length >= 0;
  if (!hasExact && !hasAllowed) {
    findings.push({
      rule: RULES.MATCH_POLICY_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} must declare "exactEventMatch" or "allowedDiffList".`,
    });
  }

  if (
    Array.isArray(fixture.extraEvents) &&
    fixture.extraEvents.length > 0 &&
    !hasAllowed
  ) {
    findings.push({
      rule: RULES.EXTRA_EVENTS_WITHOUT_DIFF_LIST,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} declares ${fixture.extraEvents.length} extraEvents but no "allowedDiffList"; extras must be allowlisted.`,
    });
  }

  if (fixture.secretRedaction !== true) {
    findings.push({
      rule: RULES.SECRET_REDACTION_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Golden fixture ${basename(fixturePath)} must set "secretRedaction": true.`,
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
  const targets = stat.isDirectory() ? walk(focusAbs) : [focusAbs];
  const findings = [];
  let scannedFixtureCount = 0;
  for (const file of targets) {
    if (!isGoldenFixture(file)) continue;
    scannedFixtureCount += 1;
    const parsed = loadFixture(file);
    if (!parsed.ok) {
      findings.push({
        rule: RULES.PARSE_FAILED,
        severity: "P0",
        path: relative(repoRoot, file),
        line: 1,
        message: `Golden fixture is not valid JSON: ${parsed.error}`,
      });
      continue;
    }
    findings.push(...findingsForFixture(file, parsed.value));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: scannedFixtureCount,
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
