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
        if (rec.status === "drifted" || rec.status === "unverified") {
          rawIssues.push({
            source: "release",
            sourceRef: `${rec.sourceFile}#${rec.sourceSection}`,
            category: `release.${rec.promiseType}`,
            severity: "P1",
            title: rec.promiseText.slice(0, 120),
            promiseId: rec.promiseId,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  // 1c. From each audit:* scanner
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

  // 2. Normalize: assign AAS-ISSUE-* ids, dedup on (category, sourceRef).
  const seen = new Map();
  for (const raw of rawIssues) {
    const key = `${raw.category}|${raw.sourceRef}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.occurrences = (existing.occurrences ?? 1) + 1;
      continue;
    }
    const issue = {
      issueId: nextIssueId(),
      source: raw.source,
      sourceRef: raw.sourceRef,
      category: raw.category,
      severity: raw.severity,
      description: raw.title,
      rootCause: null,
      invariantViolated: `INV-${raw.category.toUpperCase().replace(/\./g, "-")}-001`,
      evidence: [],
      fixStrategy: null,
      requiredTest: ["unit", "regression"],
      requiredGate: [raw.auditScript ? `audit:${raw.auditScript.replace("audit-", "")}` : `audit:${raw.category.split(".")[0]}`],
      owner: "TBD",
      expiry: null,
      status: "open",
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
