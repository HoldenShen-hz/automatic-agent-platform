#!/usr/bin/env node
/**
 * Assurance Layer 6: build issue ledger
 *
 * Aggregates findings from review-ledger, historical-promises, and audit:*
 * scanners into a single normalized issue ledger under
 * artifacts/assurance/issues.{raw,normalized,deduped}.jsonl.
 *
 * Per docs_zh/contracts/issue-ledger-contract.md §3.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

let nextIssueSeq = 1;
function nextIssueId() {
  const id = `AAS-ISSUE-${String(nextIssueSeq).padStart(6, "0")}`;
  nextIssueSeq++;
  return id;
}

function inferReviewIssueStatus(reviewRecord) {
  switch (reviewRecord.status) {
    case "fixed":
    case "done":
      return "verified";
    case "accepted_risk":
      return "accepted_risk";
    case "partial":
      return "in_progress";
    case "needs_revalidation":
    case "stale":
      return "needs_revalidation";
    case "todo":
    default:
      return (reviewRecord.evidenceRefs ?? []).length > 0 ? "open" : "needs_revalidation";
  }
}

function shouldRequireCoverage(issueLike) {
  if (issueLike.coverageRequired === false) {
    return false;
  }
  return !["verified", "closed", "accepted_risk", "needs_revalidation"].includes(issueLike.status);
}

function inferRequiredGates(raw) {
  if (raw.category.startsWith("tenant_isolation.")) {
    return ["audit:tenant-isolation", "redteam:p0"];
  }
  if (raw.category.startsWith("secret_sinks.")) {
    return ["audit:secret-sinks", "redteam:p0"];
  }
  if (raw.auditScript) {
    return [`audit:${raw.auditScript.replace("audit-", "").replaceAll("_", "-")}`];
  }
  if (raw.category === "doc_state.release_claim_overreach" || raw.category.startsWith("release.")) {
    return ["audit:release-claims"];
  }
  if (raw.category === "ui_contract.bridge_or_endpoint_mismatch") {
    return ["audit:public-entrypoints"];
  }
  if (raw.category.startsWith("ops_hygiene.")) {
    return ["audit:docs-sync"];
  }
  if (raw.category.startsWith("test_quality.")) {
    return ["assurance:verify-test-coverage"];
  }
  if (raw.source === "review") {
    return ["assurance:review-import:check"];
  }
  if (raw.source === "release") {
    return ["audit:historical-promises"];
  }
  return [`audit:${raw.category.split(".")[0]}`];
}

function inferRequiredTests(raw, status, coverageRequired) {
  if (!coverageRequired) {
    return ["regression"];
  }
  if (raw.auditScript) {
    return ["audit-tool", "seeded-defect"];
  }
  if (raw.category === "doc_state.release_claim_overreach" || raw.category.startsWith("release.")) {
    return ["audit-tool", "release"];
  }
  if (raw.category.startsWith("test_quality.")) {
    return ["regression"];
  }
  if (status === "in_progress" || status === "open") {
    return ["unit", "regression"];
  }
  return ["regression"];
}

function runAudit(scriptName) {
  const out = spawnSync("node", [`scripts/ci/${scriptName}.mjs`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (out.status !== 0 && !out.stdout) {
    return { findings: [], error: out.stderr };
  }
  try {
    return JSON.parse(out.stdout);
  } catch {
    return { findings: [], error: "parse-fail" };
  }
}

function readStaticAuditFindings() {
  const staticAuditPath = join(outputRoot, "static-audit-findings.jsonl");
  if (!existsSync(staticAuditPath)) return null;
  const findings = [];
  for (const line of readFileSync(staticAuditPath, "utf8").split(/\r?\n/).filter((entry) => entry.trim().length > 0)) {
    try {
      findings.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  return findings;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  // 1. Raw ledger: just collect from each source without dedup.
  const rawIssues = [];
  const normalizedIssues = [];

  // 1a. From review-ledger
  const reviewPath = join(outputRoot, "review-ledger.normalized.jsonl");
  if (existsSync(reviewPath)) {
    for (const line of readFileSync(reviewPath, "utf8").split(/\r?\n/).filter((l) => l.trim())) {
      try {
        const rec = JSON.parse(line);
        rawIssues.push({
          source: "review",
          sourceRef: `${rec.sourceFile}#${rec.rowId}`,
          category: rec.category,
          severity: rec.severity ?? "P1",
          title: rec.title,
          reviewSourceId: rec.reviewSourceId,
          reviewStatus: rec.status,
          reviewSourceKind: rec.sourceKind ?? null,
          evidenceRefs: Array.isArray(rec.evidenceRefs) ? rec.evidenceRefs : [],
        });
      } catch {
        // ignore parse errors
      }
    }
  }

  // 1b. From historical-promises
  const promisePath = join(outputRoot, "historical-promises.jsonl");
  if (existsSync(promisePath)) {
    for (const line of readFileSync(promisePath, "utf8").split(/\r?\n/).filter((l) => l.trim())) {
      try {
        const rec = JSON.parse(line);
        if ((rec.status === "drifted" || rec.status === "unverified") && rec.promiseType === "release_claim") {
          rawIssues.push({
            source: "release",
            sourceRef: `${rec.sourceFile}#${rec.sourceSection}`,
            category: `release.${rec.promiseType}`,
            severity: "P1",
            title: rec.promiseText.slice(0, 120),
            promiseId: rec.promiseId,
            evidenceRefs: Array.isArray(rec.evidenceRefs) ? rec.evidenceRefs : [],
          });
        }
      } catch {
        // ignore
      }
    }
  }

  // 1c. From each audit:* scanner
  const staticAuditFindings = readStaticAuditFindings();
  if (staticAuditFindings != null) {
    for (const finding of staticAuditFindings) {
      if (finding.severity !== "P0" && finding.severity !== "P1") continue;
      rawIssues.push({
        source: "audit",
        sourceRef: `${finding.path}:${finding.line}`,
        category: finding.rule,
        severity: finding.severity,
        title: finding.message,
        auditScript: finding.auditId ?? "static-audit",
      });
    }
  } else {
    const auditScripts = [
      "audit-tenant-isolation",
      "audit-secret-sinks",
      "audit-fire-and-forget",
      "audit-determinism",
      "audit-release-claims",
      "audit-architecture-boundary",
      "audit-path-safety",
      "audit-eval-oracle",
      "audit-plugin-security",
      "audit-ui-token-storage",
      "audit-auth-role-mapping",
      "audit-execution-invariants",
    ];
    for (const script of auditScripts) {
      const out = runAudit(script);
      for (const f of out.findings ?? []) {
        if (f.severity !== "P0" && f.severity !== "P1") continue;
        rawIssues.push({
          source: "audit",
          sourceRef: `${f.path}:${f.line}`,
          category: f.rule,
          severity: f.severity,
          title: f.message,
          auditScript: script,
        });
      }
    }
  }

  // 2. Normalize: assign AAS-ISSUE-* ids, dedup on (category, sourceRef).
  const seen = new Map();
  for (const raw of rawIssues) {
    const key = `${raw.category}|${raw.sourceRef}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.occurrences = (existing.occurrences ?? 1) + 1;
      continue;
    }
    const status =
      raw.source === "review"
        ? inferReviewIssueStatus({
            status: raw.reviewStatus ?? "todo",
            sourceKind: raw.reviewSourceKind,
            evidenceRefs: raw.evidenceRefs ?? [],
          })
        : raw.source === "release"
          ? "open"
          : "open";
    const coverageRequired =
      raw.source === "review"
        ? shouldRequireCoverage({
            status,
            coverageRequired:
              raw.reviewSourceKind === "issue_summary" &&
              (raw.reviewStatus === "todo" || raw.reviewStatus === "partial"),
          })
        : raw.source === "release"
          ? true
          : true;
    const issue = {
      issueId: nextIssueId(),
      source: raw.source,
      sourceRef: raw.sourceRef,
      category: raw.category,
      severity: raw.severity,
      description: raw.title,
      rootCause: null,
      invariantViolated: `INV-${raw.category.toUpperCase().replace(/\./g, "-")}-001`,
      evidence: raw.evidenceRefs ?? [],
      fixStrategy: null,
      requiredTest: inferRequiredTests(raw, status, coverageRequired),
      requiredGate: inferRequiredGates(raw),
      owner: coverageRequired ? "TBD" : null,
      expiry: null,
      status,
      coverageRequired,
      coverageReason: coverageRequired
        ? "active_issue_requires_runtime_or_regression_binding"
        : "historical_or_resolved_issue_kept_for_traceability_only",
      linkedPromiseIds: raw.promiseId ? [raw.promiseId] : [],
      linkedReviewIds: raw.reviewSourceId ? [raw.reviewSourceId] : [],
      createdAt: stamp,
      updatedAt: stamp,
      occurrences: 1,
    };
    seen.set(key, issue);
    normalizedIssues.push(issue);
  }

  // 3. Write outputs.
  writeFileSync(
    join(outputRoot, "issues.raw.jsonl"),
    rawIssues.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  writeFileSync(
    join(outputRoot, "issues.normalized.jsonl"),
    normalizedIssues.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  // Dedup is currently same as normalized (no further clustering in v1).
  writeFileSync(
    join(outputRoot, "issues.deduped.jsonl"),
    normalizedIssues.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );

  // 4. Markdown mirror under docs_zh/quality/issue-ledger/
  const mdDir = join(repoRoot, "docs_zh", "quality", "issue-ledger");
  const enMdDir = join(repoRoot, "docs_en", "quality", "issue-ledger");
  mkdirSync(mdDir, { recursive: true });
  mkdirSync(enMdDir, { recursive: true });
  const md = [
    "# Automatic Agent System — Issue Ledger Mirror",
    "",
    `> Generated: ${stamp}`,
    `> Source: artifacts/assurance/issues.deduped.jsonl`,
    `> Total issues: ${normalizedIssues.length}`,
    "",
    "| ID | Severity | Source | Category | Description |",
    "|---|---|---|---|---|",
    ...normalizedIssues.slice(0, 200).map((i) =>
      `| ${i.issueId} | ${i.severity} | ${i.source} | ${i.category} | ${i.description.slice(0, 80).replace(/\|/g, "\\|")} |`,
    ),
  ].join("\n");
  writeFileSync(join(mdDir, "automatic-agent-system-issues.md"), md + "\n");
  const enMd = [
    "# Automatic Agent System - Issue Ledger Mirror",
    "",
    `> Generated: ${stamp}`,
    `> Source: artifacts/assurance/issues.deduped.jsonl`,
    `> Total issues: ${normalizedIssues.length}`,
    "",
    "| ID | Severity | Source | Category | Description |",
    "|---|---|---|---|---|",
    ...normalizedIssues.slice(0, 200).map((issue) =>
      `| ${issue.issueId} | ${issue.severity} | ${issue.source} | ${issue.category} | ${issue.description.slice(0, 80).replace(/\|/g, "\\|")} |`,
    ),
  ].join("\n");
  writeFileSync(join(enMdDir, "automatic-agent-system-issues.md"), enMd + "\n");

  const summary = {
    generatedAt: stamp,
    rawCount: rawIssues.length,
    normalizedCount: normalizedIssues.length,
    dedupedCount: normalizedIssues.length,
    bySource: normalizedIssues.reduce((acc, i) => {
      acc[i.source] = (acc[i.source] ?? 0) + 1;
      return acc;
    }, {}),
    bySeverity: normalizedIssues.reduce((acc, i) => {
      acc[i.severity] = (acc[i.severity] ?? 0) + 1;
      return acc;
    }, {}),
    outputs: {
      raw: "artifacts/assurance/issues.raw.jsonl",
      normalized: "artifacts/assurance/issues.normalized.jsonl",
      deduped: "artifacts/assurance/issues.deduped.jsonl",
      md: "docs_zh/quality/issue-ledger/automatic-agent-system-issues.md",
      enMd: "docs_en/quality/issue-ledger/automatic-agent-system-issues.md",
    },
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
