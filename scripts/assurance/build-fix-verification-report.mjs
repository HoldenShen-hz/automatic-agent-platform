#!/usr/bin/env node
/**
 * Assurance Layer: Fix Verification Contract report
 *
 * Builds a machine-readable report for review items already marked
 * fixed/done, verifying whether each one has:
 *   - evidence refs
 *   - bound regression tests
 *   - at least one explicit gate reference
 *
 * This implements the methodology's "Fix Verification Contract" as a
 * repo artifact even before every historical item is fully backfilled.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

function readJson(path) {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function normalizeGate(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const generatedAt = new Date().toISOString();
  const reviewLedger = readJsonl(join(outputRoot, "review-ledger.normalized.jsonl"));
  const testMetadata = readJson(join(outputRoot, "test-metadata.json")) ?? { entries: [] };
  const issueToTest = readJson(join(outputRoot, "issue-to-test-map.json")) ?? { bindings: {} };

  const metadataByPath = new Map();
  for (const entry of testMetadata.entries ?? []) {
    if (typeof entry?.path === "string") {
      metadataByPath.set(entry.path, entry);
    }
  }

  const records = [];
  for (const finding of reviewLedger) {
    if (finding.status !== "fixed" && finding.status !== "done") {
      continue;
    }
    const canonicalIssueId =
      typeof finding.canonicalIssueId === "string" && finding.canonicalIssueId.length > 0
        ? finding.canonicalIssueId
        : null;
    const boundTests = new Set([
      ...(Array.isArray(finding.testRefs) ? finding.testRefs : []),
      ...((canonicalIssueId != null ? issueToTest.bindings?.[canonicalIssueId] : []) ?? []),
    ]);
    const gateRefs = new Set();
    for (const testPath of boundTests) {
      const meta = metadataByPath.get(testPath);
      const gate = normalizeGate(meta?.gate);
      if (gate != null) {
        gateRefs.add(gate);
      }
    }
    for (const evidence of Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs : []) {
      const match = String(evidence).match(/\b(audit:[a-z0-9:_-]+|test:[a-z0-9:_-]+)\b/i);
      if (match?.[1]) {
        gateRefs.add(match[1]);
      }
    }

    const result = {
      canonicalIssueId,
      sourceFile: finding.sourceFile,
      rowId: finding.rowId,
      title: finding.title,
      reviewStatus: finding.status,
      evidenceRefs: Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs : [],
      testsAdded: [...boundTests].sort(),
      gatesObserved: [...gateRefs].sort(),
      verification: {
        hasEvidence: Array.isArray(finding.evidenceRefs) && finding.evidenceRefs.length > 0,
        hasTests: boundTests.size > 0,
        hasGate: gateRefs.size > 0,
      },
    };
    records.push({
      ...result,
      status:
        result.verification.hasEvidence && result.verification.hasTests && result.verification.hasGate
          ? "pass"
          : "fail",
    });
  }

  const summary = {
    generatedAt,
    totalClosedFindings: records.length,
    passCount: records.filter((record) => record.status === "pass").length,
    failCount: records.filter((record) => record.status === "fail").length,
    outputs: {
      json: "artifacts/assurance/fix-verification-report.json",
      md: "artifacts/assurance/fix-verification-report.md",
    },
  };

  writeFileSync(
    join(outputRoot, "fix-verification-report.json"),
    `${JSON.stringify({ ...summary, records }, null, 2)}\n`,
    "utf8",
  );

  const markdown = [
    "# Fix Verification Report",
    "",
    `> Generated: ${generatedAt}`,
    `> Closed findings: ${summary.totalClosedFindings}`,
    `> Pass: ${summary.passCount} | Fail: ${summary.failCount}`,
    "",
    "| Issue | Status | Evidence | Tests | Gates | Title |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...records.slice(0, 200).map((record) =>
      `| ${record.canonicalIssueId ?? `${record.sourceFile}#${record.rowId}`} | ${record.status} | ${record.verification.hasEvidence ? "Y" : "N"} | ${record.verification.hasTests ? "Y" : "N"} | ${record.verification.hasGate ? "Y" : "N"} | ${String(record.title).replace(/\|/g, "\\|")} |`,
    ),
  ].join("\n");
  writeFileSync(join(outputRoot, "fix-verification-report.md"), `${markdown}\n`, "utf8");

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
