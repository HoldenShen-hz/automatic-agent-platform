#!/usr/bin/env node
/**
 * Assurance Layer: promote-expired-assumptions
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §27.2: unverified assumption ledger entries whose `expiry` is in the past
 * are automatically promoted to the issue ledger.
 *
 * Inputs:
 *   --assumptions-file <path>   (default: artifacts/assurance/assumptions.jsonl)
 *   --issues-file <path>        (default: artifacts/assurance/issues.deduped.jsonl)
 *   --report-json <path>        (default: artifacts/assurance/assumption-promotion-report.json)
 *   --report-md <path>          (default: artifacts/quality/issue-ledger/expired-assumption-promotions.md)
 *   --repo-root <path>          (default: process.cwd())
 *   --now <iso-date>            (default: today UTC, used as the "current" date for expiry checks)
 *
 * Behavior:
 *   - Reads assumptions.jsonl, splits into records.
 *   - Reads issues.deduped.jsonl and remembers the max AAS-ISSUE-NNNNNN seq
 *     (and the set of assumptionIds already linked via linkedPromiseIds).
 *   - For each assumption where expiry < now AND status === "unverified":
 *       * Skip if already promoted (assumptionId already present in some
 *         issue's linkedPromiseIds).
 *       * Emit a new AAS-ISSUE-NNNNNN record conforming to
 *         schemas/issue-ledger.schema.json.
 *       * Append to issues.deduped.jsonl (in-place append-only).
 *       * Mark the assumption status as "expired" in the in-memory copy,
 *         then rewrite assumptions.jsonl in place.
 *   - Emits:
 *       * artifacts/assurance/assumption-promotion-report.json
 *         { generatedAt, promoted[], skipped[], errors[], counts }
 *       * artifacts/quality/issue-ledger/expired-assumption-promotions.md
 *         (human readable; rendered in repo on demand)
 *
 * Exit code:
 *   0  on success (including "no expired assumptions" — a no-op tick is still success)
 *   1  on any IO / parse / schema error
 *   2  on bad CLI usage
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

function parseArgs(argv) {
  const opts = {
    repoRoot: process.cwd(),
    assumptionsFile: "artifacts/assurance/assumptions.jsonl",
    issuesFile: "artifacts/assurance/issues.deduped.jsonl",
    reportJson: "artifacts/assurance/assumption-promotion-report.json",
    reportMd: "artifacts/quality/issue-ledger/expired-assumption-promotions.md",
    now: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--repo-root":
        opts.repoRoot = next ? next : process.cwd();
        i++;
        break;
      case "--assumptions-file":
        opts.assumptionsFile = next;
        i++;
        break;
      case "--issues-file":
        opts.issuesFile = next;
        i++;
        break;
      case "--report-json":
        opts.reportJson = next;
        i++;
        break;
      case "--report-md":
        opts.reportMd = next;
        i++;
        break;
      case "--now":
        opts.now = next;
        i++;
        break;
      case "-h":
      case "--help":
        process.stdout.write(
          "promote-expired-assumptions: see header comment in scripts/assurance/promote-expired-assumptions.mjs\n",
        );
        process.exit(0);
        break;
      default:
        process.stderr.write(`promote-expired-assumptions: unknown arg: ${a}\n`);
        process.exit(2);
    }
  }
  return opts;
}

function resolveUnder(root, p) {
  if (!p) return p;
  return isAbsolute(p) ? p : resolve(root, p);
}

function todayUtc(nowIso) {
  if (nowIso) return nowIso.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function isExpired(expiry, today) {
  if (!expiry || typeof expiry !== "string") return false;
  // Lexicographic compare works for YYYY-MM-DD.
  return expiry.slice(0, 10) < today;
}

const ISSUE_ID_RE = /^AAS-ISSUE-(\d{6,})$/;

function maxIssueSeq(issues) {
  let max = 0;
  for (const i of issues) {
    if (typeof i.issueId === "string") {
      const m = i.issueId.match(ISSUE_ID_RE);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
  }
  return max;
}

function indexAssumptionLinks(issues) {
  // Map: assumptionId -> [issueId, issueId, ...] for dedup.
  const map = new Map();
  for (const i of issues) {
    const links = Array.isArray(i.linkedPromiseIds) ? i.linkedPromiseIds : [];
    for (const aid of links) {
      if (typeof aid === "string" && aid.startsWith("AAS-ASSUMPTION-")) {
        if (!map.has(aid)) map.set(aid, []);
        map.get(aid).push(i.issueId);
      }
    }
  }
  return map;
}

function readJsonl(absPath) {
  if (!existsSync(absPath)) {
    return { records: [], missing: true };
  }
  const text = readFileSync(absPath, "utf8");
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // skip malformed lines but record them in the report
      records.push({ __parseError: true, raw: line });
    }
  }
  return { records, missing: false };
}

function writeJsonl(absPath, records) {
  const body = records.map((r) => JSON.stringify(r)).join("\n");
  // Always terminate with newline so subsequent readers don't choke.
  writeFileSync(absPath, body + (body.length > 0 ? "\n" : ""), "utf8");
}

function buildIssueForExpiredAssumption(assumption, issueId, stamp) {
  const sourceRef =
    typeof assumption.sourceRef === "string" && assumption.sourceRef.length > 0
      ? assumption.sourceRef
      : "assumptions:unknown";
  const description =
    typeof assumption.statement === "string" && assumption.statement.length > 0
      ? `Assumption expired without verification: ${assumption.statement.slice(0, 280)}`
      : "Assumption expired without verification";
  const risk =
    typeof assumption.riskIfFalse === "string" && assumption.riskIfFalse.length > 0
      ? assumption.riskIfFalse
      : "unverified assumption may misguide downstream decisions";

  return {
    issueId,
    source: "audit",
    sourceRef,
    category: "audit.assumption-expired",
    severity: "P1",
    plane: null,
    module: null,
    description,
    rootCause: `assumption ${assumption.assumptionId} status=unverified past expiry=${assumption.expiry} riskIfFalse=${risk}`,
    invariantViolated: "INV-AUDIT-ASSUMPTION-EXPIRY-001",
    evidence: Array.isArray(assumption.evidence) ? assumption.evidence : [],
    fixStrategy: "Verify or refute the assumption, then update ledger status.",
    requiredTest: ["audit-tool"],
    requiredGate: ["assurance:assumptions:tick"],
    owner: typeof assumption.owner === "string" && assumption.owner.length > 0 ? assumption.owner : "TBD",
    expiry: null,
    status: "open",
    linkedPromiseIds: [assumption.assumptionId],
    linkedReviewIds: [],
    blockedBy: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function buildMarkdownReport({ stamp, promoted, skipped, errors, assumptionsFile, issuesFile }) {
  const lines = [];
  lines.push("# Expired Assumption Promotion Report");
  lines.push("");
  lines.push(`> Generated: ${stamp}`);
  lines.push(`> Assumptions: \`${assumptionsFile}\``);
  lines.push(`> Issues: \`${issuesFile}\``);
  lines.push(`> Promoted: ${promoted.length} | Skipped: ${skipped.length} | Errors: ${errors.length}`);
  lines.push("");
  if (promoted.length === 0 && skipped.length === 0 && errors.length === 0) {
    lines.push("_No expired assumptions were detected on this run._");
    lines.push("");
    return lines.join("\n");
  }
  if (promoted.length > 0) {
    lines.push("## Promoted");
    lines.push("");
    lines.push("| Issue ID | Assumption | Source Ref | Expiry | Severity |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const p of promoted) {
      const ref = String(p.sourceRef).replace(/\|/g, "\\|");
      lines.push(
        `| ${p.issueId} | \`${p.assumptionId}\` | \`${ref}\` | ${p.expiry} | ${p.severity} |`,
      );
    }
    lines.push("");
  }
  if (skipped.length > 0) {
    lines.push("## Skipped (already promoted or not yet due)");
    lines.push("");
    for (const s of skipped) {
      lines.push(
        `- \`${s.assumptionId}\` (${s.reason}) expiry=${s.expiry ?? "n/a"} status=${s.status ?? "n/a"}`,
      );
    }
    lines.push("");
  }
  if (errors.length > 0) {
    lines.push("## Errors");
    lines.push("");
    for (const e of errors) {
      lines.push(`- \`${e.assumptionId ?? "?"}\`: ${e.message}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv);
  const repoRoot = resolve(opts.repoRoot);
  const assumptionsAbs = resolveUnder(repoRoot, opts.assumptionsFile);
  const issuesAbs = resolveUnder(repoRoot, opts.issuesFile);
  const reportJsonAbs = resolveUnder(repoRoot, opts.reportJson);
  const reportMdAbs = resolveUnder(repoRoot, opts.reportMd);
  const today = todayUtc(opts.now);
  const stamp = new Date().toISOString();

  const report = {
    generatedAt: stamp,
    now: today,
    assumptionsFile: opts.assumptionsFile,
    issuesFile: opts.issuesFile,
    promoted: [],
    skipped: [],
    errors: [],
    counts: { promoted: 0, skipped: 0, errors: 0 },
  };

  // Read inputs.
  const { records: assumptions, missing: assumptionsMissing } = readJsonl(assumptionsAbs);
  const { records: issues, missing: issuesMissing } = readJsonl(issuesAbs);

  if (assumptionsMissing) {
    report.errors.push({
      assumptionId: null,
      message: `assumptions file not found: ${opts.assumptionsFile}`,
    });
  }
  if (issuesMissing) {
    // Tolerated: an empty issues file will be created on first promote.
    report.errors.push({
      assumptionId: null,
      message: `issues file not found, treating as empty: ${opts.issuesFile}`,
    });
  }

  // Pre-compute dedup index and issue id seed.
  const linked = indexAssumptionLinks(issues);
  let nextSeq = maxIssueSeq(issues) + 1;

  // Walk assumptions.
  const updatedAssumptions = [];
  for (const a of assumptions) {
    if (a && a.__parseError) {
      report.errors.push({ assumptionId: null, message: `malformed assumption line: ${a.raw}` });
      updatedAssumptions.push(a);
      continue;
    }
    const aid = a.assumptionId;
    const expired = isExpired(a.expiry, today);
    const eligible = expired && a.status === "unverified";

    if (!expired) {
      report.skipped.push({
        assumptionId: aid,
        reason: "not-yet-due",
        expiry: a.expiry,
        status: a.status,
      });
      updatedAssumptions.push(a);
      continue;
    }
    if (a.status !== "unverified") {
      // Already verified, accepted, expired, or otherwise terminal — do not promote.
      report.skipped.push({
        assumptionId: aid,
        reason: `status-bypass:${a.status}`,
        expiry: a.expiry,
        status: a.status,
      });
      updatedAssumptions.push(a);
      continue;
    }
    // Eligible.
    if (linked.has(aid)) {
      // Already linked to at least one issue. Skip without re-promoting.
      report.skipped.push({
        assumptionId: aid,
        reason: `already-promoted:${linked.get(aid).join(",")}`,
        expiry: a.expiry,
        status: a.status,
      });
      updatedAssumptions.push(a);
      continue;
    }

    try {
      const issueId = `AAS-ISSUE-${String(nextSeq).padStart(6, "0")}`;
      const issue = buildIssueForExpiredAssumption(a, issueId, stamp);
      issues.push(issue);
      linked.set(aid, [issueId]);
      nextSeq++;
      report.promoted.push({
        assumptionId: aid,
        issueId,
        sourceRef: issue.sourceRef,
        expiry: a.expiry,
        severity: issue.severity,
      });
      // Mutate assumption to "expired" status in-place.
      updatedAssumptions.push({ ...a, status: "expired" });
    } catch (e) {
      report.errors.push({
        assumptionId: aid,
        message: String(e?.message ?? e),
      });
      updatedAssumptions.push(a);
    }
  }

  report.counts = {
    promoted: report.promoted.length,
    skipped: report.skipped.length,
    errors: report.errors.length,
  };

  // Write outputs.
  try {
    mkdirSync(dirname(reportJsonAbs), { recursive: true });
    mkdirSync(dirname(reportMdAbs), { recursive: true });
    mkdirSync(dirname(issuesAbs), { recursive: true });
    mkdirSync(dirname(assumptionsAbs), { recursive: true });
  } catch {
    // ignore; writeFileSync will fail loudly if it matters
  }

  // Append-only update to issues.deduped.jsonl: rewrite the full file with
  // original + new entries. This keeps dedup simple and idempotent because
  // linked.has(aid) guards against re-promotion.
  if (issues.length > 0 || !issuesMissing) {
    writeJsonl(issuesAbs, issues);
  }

  // Rewrite assumptions.jsonl with status updates.
  if (!assumptionsMissing) {
    writeJsonl(assumptionsAbs, updatedAssumptions);
  }

  writeFileSync(reportJsonAbs, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const md = buildMarkdownReport({
    stamp,
    promoted: report.promoted,
    skipped: report.skipped,
    errors: report.errors,
    assumptionsFile: opts.assumptionsFile,
    issuesFile: opts.issuesFile,
  });
  writeFileSync(reportMdAbs, md + "\n", "utf8");

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (report.counts.errors > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

try {
  main();
} catch (e) {
  process.stderr.write(`promote-expired-assumptions: ${String(e?.stack ?? e)}\n`);
  process.exitCode = 1;
}
