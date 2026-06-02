#!/usr/bin/env node
/**
 * Audit: redteam suite (§12.3)
 *
 * For every redteam suite file (YAML or JSON) the platform treats as
 * P0 evidence, this scanner enforces the §12.3 contract:
 *
 *   - $schema reference MUST point at redteam/schemas/redteam-suite.schema.json
 *   - per-case fields: caseId, objective, severity, scope, evidenceRefs
 *   - evidenceRefs[] MUST be a non-empty array
 *   - suite MUST declare: runner, result, criticalSuccessCount, releaseBlocking
 *   - criticalSuccessCount MUST be >= 1
 *   - at least one suite MUST be releaseBlocking: true (P0 suites)
 *   - "result" MUST NOT be a placeholder like "TODO" or "pending"
 *
 * Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.3 and §44.13.1.
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

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

const REQUIRED_CASE_FIELDS = ["caseId", "severity", "objective", "scope", "evidenceRefs"];
const REQUIRED_SUITE_FIELDS = [
  "$schema",
  "divisionId",
  "caseCount",
  "reportRef",
  "lastRefreshedAt",
  "cases",
  "runner",
  "result",
  "criticalSuccessCount",
  "releaseBlocking",
];
const PLACEHOLDER_RESULT_PATTERN = /^(TODO|pending|tbd|fixme|null|undefined|)$/i;

const RULES = {
  SCHEMA_MISSING: "redteam.suite_schema_missing",
  SCHEMA_WRONG_REF: "redteam.suite_schema_wrong_ref",
  SUITE_REQUIRED_FIELD_MISSING: "redteam.suite_required_field_missing",
  SUITE_CASES_MISSING: "redteam.suite_cases_missing",
  CASE_REQUIRED_FIELD_MISSING: "redteam.case_required_field_missing",
  CASE_EVIDENCE_REFS_MISSING: "redteam.case_evidence_refs_missing",
  CASE_EVIDENCE_REFS_EMPTY: "redteam.case_evidence_refs_empty",
  CRITICAL_SUCCESS_COUNT_MISSING: "redteam.critical_success_count_missing",
  CRITICAL_SUCCESS_COUNT_NOT_POSITIVE: "redteam.critical_success_count_not_positive",
  RELEASE_BLOCKING_MISSING: "redteam.release_blocking_missing",
  RELEASE_BLOCKING_NOT_BOOL: "redteam.release_blocking_not_bool",
  RESULT_PLACEHOLDER: "redteam.result_placeholder",
  RESULT_MISSING: "redteam.result_missing",
  RUNNER_MISSING: "redteam.runner_missing",
  NO_RELEASE_BLOCKING_SUITE: "redteam.no_release_blocking_suite",
  PARSE_FAILED: "redteam.parse_failed",
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

function isRedteamSuiteCandidate(path) {
  const base = basename(path);
  if (base === "redteam-suite.yaml" || base === "redteam-suite.yml" || base === "redteam-suite.json") {
    return true;
  }
  return false;
}

function loadSuite(file) {
  const text = readFileSync(file, "utf8");
  const ext = extname(file);
  if (ext === ".json") {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  try {
    const v = parseYaml(text);
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function asObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function findingsForSuite(suitePath, suite) {
  const rel = relative(repoRoot, suitePath);
  const findings = [];
  const obj = asObject(suite);
  if (!obj) {
    findings.push({
      rule: RULES.SUITE_CASES_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite root must be an object.",
    });
    return findings;
  }

  // $schema
  const schemaRef = obj.$schema;
  if (schemaRef == null) {
    findings.push({
      rule: RULES.SCHEMA_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite is missing $schema reference.",
    });
  } else if (schemaRef !== "redteam/schemas/redteam-suite.schema.json") {
    findings.push({
      rule: RULES.SCHEMA_WRONG_REF,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Redteam suite $schema must be "redteam/schemas/redteam-suite.schema.json" (got ${JSON.stringify(schemaRef)}).`,
    });
  }

  // required suite fields
  for (const f of REQUIRED_SUITE_FIELDS) {
    if (obj[f] == null) {
      findings.push({
        rule: RULES.SUITE_REQUIRED_FIELD_MISSING,
        severity: "P0",
        path: rel,
        line: 1,
        message: `Redteam suite is missing required field "${f}".`,
      });
    }
  }

  // runner
  const runner = asObject(obj.runner);
  if (obj.runner == null) {
    findings.push({
      rule: RULES.RUNNER_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite has no runner entry.",
    });
  } else if (!runner) {
    findings.push({
      rule: RULES.RUNNER_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite runner must be an object with runnerId/runnerVersion.",
    });
  }

  // result
  if (obj.result == null) {
    findings.push({
      rule: RULES.RESULT_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite has no result field.",
    });
  } else if (typeof obj.result === "string" && PLACEHOLDER_RESULT_PATTERN.test(obj.result.trim())) {
    findings.push({
      rule: RULES.RESULT_PLACEHOLDER,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Redteam suite result is a placeholder string "${obj.result}". Provide a concrete runner result.`,
    });
  }

  // criticalSuccessCount
  if (obj.criticalSuccessCount == null) {
    findings.push({
      rule: RULES.CRITICAL_SUCCESS_COUNT_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite is missing criticalSuccessCount.",
    });
  } else if (typeof obj.criticalSuccessCount !== "number" || obj.criticalSuccessCount < 1) {
    findings.push({
      rule: RULES.CRITICAL_SUCCESS_COUNT_NOT_POSITIVE,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Redteam suite criticalSuccessCount=${JSON.stringify(obj.criticalSuccessCount)} (must be >= 1).`,
    });
  }

  // releaseBlocking
  if (obj.releaseBlocking == null) {
    findings.push({
      rule: RULES.RELEASE_BLOCKING_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite is missing releaseBlocking flag.",
    });
  } else if (typeof obj.releaseBlocking !== "boolean") {
    findings.push({
      rule: RULES.RELEASE_BLOCKING_NOT_BOOL,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Redteam suite releaseBlocking must be boolean (got ${typeof obj.releaseBlocking}).`,
    });
  }

  // cases
  const cases = Array.isArray(obj.cases) ? obj.cases : null;
  if (!cases) {
    findings.push({
      rule: RULES.SUITE_CASES_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite is missing a non-empty cases array.",
    });
    return findings;
  }
  if (cases.length === 0) {
    findings.push({
      rule: RULES.SUITE_CASES_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: "Redteam suite cases array is empty.",
    });
    return findings;
  }

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const caseLabel = c && typeof c === "object" && typeof c.caseId === "string" ? c.caseId : `#${i + 1}`;
    if (c == null || typeof c !== "object" || Array.isArray(c)) {
      findings.push({
        rule: RULES.CASE_REQUIRED_FIELD_MISSING,
        severity: "P0",
        path: rel,
        line: 1,
        message: `Redteam case ${caseLabel} must be an object.`,
      });
      continue;
    }
    for (const f of REQUIRED_CASE_FIELDS) {
      if (c[f] == null) {
        findings.push({
          rule: RULES.CASE_REQUIRED_FIELD_MISSING,
          severity: "P0",
          path: rel,
          line: 1,
          message: `Redteam case ${caseLabel} is missing required field "${f}".`,
        });
      }
    }
    if (c.evidenceRefs != null) {
      if (!Array.isArray(c.evidenceRefs)) {
        findings.push({
          rule: RULES.CASE_EVIDENCE_REFS_MISSING,
          severity: "P0",
          path: rel,
          line: 1,
          message: `Redteam case ${caseLabel} evidenceRefs must be an array.`,
        });
      } else if (c.evidenceRefs.length === 0) {
        findings.push({
          rule: RULES.CASE_EVIDENCE_REFS_EMPTY,
          severity: "P0",
          path: rel,
          line: 1,
          message: `Redteam case ${caseLabel} has empty evidenceRefs[].`,
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
  const targets = stat.isDirectory() ? walk(focusAbs) : [focusAbs];
  const findings = [];
  const seenReleaseBlocking = [];
  let scannedSuiteCount = 0;
  for (const file of targets) {
    if (!isRedteamSuiteCandidate(file)) continue;
    scannedSuiteCount += 1;
    const parsed = loadSuite(file);
    if (!parsed.ok) {
      findings.push({
        rule: RULES.PARSE_FAILED,
        severity: "P0",
        path: relative(repoRoot, file),
        line: 1,
        message: `Redteam suite is not parseable: ${parsed.error}`,
      });
      continue;
    }
    findings.push(...findingsForSuite(file, parsed.value));
    if (parsed.value && typeof parsed.value === "object" && parsed.value.releaseBlocking === true) {
      seenReleaseBlocking.push(relative(repoRoot, file));
    }
  }
  if (scannedSuiteCount > 0 && seenReleaseBlocking.length === 0) {
    findings.push({
      rule: RULES.NO_RELEASE_BLOCKING_SUITE,
      severity: "P0",
      path: focusPath,
      line: 1,
      message: `No redteam suite under ${focusPath} sets releaseBlocking: true; at least one P0 suite is required.`,
    });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: scannedSuiteCount,
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
