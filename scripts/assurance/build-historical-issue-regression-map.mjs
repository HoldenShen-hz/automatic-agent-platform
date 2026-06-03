#!/usr/bin/env node
/**
 * Assurance Layer: historical issue regression map
 *
 * Restores the methodology-required reverse mapping from every machine-readable
 * issue to its current automation footprint:
 *   - audit / gate bindings
 *   - regression tests
 *   - seeded defects
 *   - review closure status
 *
 * The artifact is intentionally diagnostic. It should surface gaps such as
 * "fixed without gate" or "accepted risk without expiry", but generating the
 * map itself must stay fail-safe so the rest of assurance can inspect it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readJsonlIfExists(path) {
  if (!existsSync(path)) {
    return [];
  }
  const records = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      records.push(JSON.parse(line));
    } catch {
      // Keep the map best-effort; broken lines show up as missing data.
    }
  }
  return records;
}

function normalizeGateName(gate) {
  if (typeof gate !== "string" || gate.length === 0) {
    return "";
  }
  if (gate.startsWith("audit:")) {
    return gate.replace("audit:", "audit-");
  }
  return gate;
}

function buildMarkdown(report) {
  const lines = [
    "# Historical Issue Regression Map",
    "",
    `> Generated: ${report.generatedAt}`,
    `> Issue count: ${report.issueCount}`,
    `> Missing automation count: ${report.summary.missingAutomationCount}`,
    "",
    "| Issue | Classification | Gates | Regression Tests | Seeded Defects | Missing Controls |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...report.mappings.slice(0, 300).map((mapping) =>
      `| ${mapping.historicalIssueId} | ${mapping.classification} | ${mapping.requiredAuditRules.join(", ") || "-"} | ${mapping.regressionTests.length} | ${mapping.regressionSeeds.length} | ${mapping.missingControls.join(", ") || "-"} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  const issues = readJsonlIfExists(join(outputRoot, "issues.deduped.jsonl"));
  const reviews = readJsonlIfExists(join(outputRoot, "review-ledger.normalized.jsonl"));
  const issueToTestMap = readJsonIfExists(join(outputRoot, "issue-to-test-map.json"))?.bindings ?? {};
  const seededDefects = readJsonIfExists(join(outputRoot, "seeded-defect-report.json"))?.results ?? [];

  const reviewById = new Map(reviews.map((review) => [review.reviewSourceId, review]));
  const seedsByGate = new Map();
  for (const result of seededDefects) {
    const gate = normalizeGateName(result.gate);
    if (!gate) {
      continue;
    }
    const current = seedsByGate.get(gate) ?? [];
    current.push(result);
    seedsByGate.set(gate, current);
  }

  const mappings = issues.map((issue) => {
    const linkedReviews = (issue.linkedReviewIds ?? [])
      .map((id) => reviewById.get(id))
      .filter(Boolean);
    const linkedStatuses = [...new Set(linkedReviews.map((review) => review.status))];
    const reviewEvidenceRefs = [...new Set(linkedReviews.flatMap((review) => review.evidenceRefs ?? []))];
    const requiredAuditRules = [...new Set((issue.requiredGate ?? []).filter((gate) => typeof gate === "string" && gate.length > 0))];
    const normalizedGates = requiredAuditRules.map(normalizeGateName).filter(Boolean);
    const regressionSeeds = normalizedGates.flatMap((gate) => {
      const results = seedsByGate.get(gate) ?? [];
      return results.map((result) => ({
        gate,
        fixtureId: result.manifest ?? null,
        passed: Array.isArray(result.seeds) ? result.seeds.every((seed) => seed.pass === true) : false,
        seedCount: Array.isArray(result.seeds) ? result.seeds.length : 0,
      }));
    });
    const regressionTests = issueToTestMap[issue.issueId] ?? [];
    const acceptedRisk =
      issue.status === "accepted_risk" ||
      linkedStatuses.includes("accepted_risk");
    const reviewClosed =
      linkedStatuses.includes("fixed") ||
      linkedStatuses.includes("done");
    const hasAutomationGate = requiredAuditRules.length > 0;
    const hasRegressionTest = regressionTests.length > 0;
    const hasSeed = regressionSeeds.some((seed) => seed.passed);
    const hasEvidence = (issue.evidence ?? []).length > 0 || reviewEvidenceRefs.length > 0;

    let classification = "Not Fixed";
    if (acceptedRisk) {
      classification = "Accepted Risk";
    } else if (reviewClosed && hasAutomationGate && hasRegressionTest) {
      classification = "Fixed with Gate";
    } else if (reviewClosed) {
      classification = "Fixed without Gate";
    }

    const missingControls = [];
    if (!hasAutomationGate) {
      missingControls.push("missing_audit_rule");
    }
    if (!hasRegressionTest) {
      missingControls.push("missing_regression_test");
    }
    if (!hasSeed && normalizedGates.some((gate) => gate.startsWith("audit-"))) {
      missingControls.push("missing_seeded_defect");
    }
    if (!hasEvidence) {
      missingControls.push("missing_evidence_ref");
    }
    if (issue.owner === "TBD") {
      missingControls.push("owner_tbd");
    }
    if (acceptedRisk && !issue.expiry) {
      missingControls.push("accepted_risk_missing_expiry");
    }

    return {
      historicalIssueId: issue.issueId,
      originalFinding: issue.description,
      category: issue.category,
      severity: issue.severity,
      requiredAuditRules,
      requiredInvariant: issue.invariantViolated,
      regressionTests,
      regressionSeeds,
      releaseGate: requiredAuditRules.length > 0 ? "rc:check" : null,
      classification,
      currentStatus: issue.status,
      owner: issue.owner,
      linkedReviewStatuses: linkedStatuses,
      linkedPromiseIds: issue.linkedPromiseIds ?? [],
      missingControls,
    };
  });

  const summary = {
    fixedWithGateCount: mappings.filter((mapping) => mapping.classification === "Fixed with Gate").length,
    fixedWithoutGateCount: mappings.filter((mapping) => mapping.classification === "Fixed without Gate").length,
    acceptedRiskCount: mappings.filter((mapping) => mapping.classification === "Accepted Risk").length,
    notFixedCount: mappings.filter((mapping) => mapping.classification === "Not Fixed").length,
    missingAutomationCount: mappings.filter((mapping) =>
      mapping.missingControls.some((control) =>
        control === "missing_audit_rule" ||
        control === "missing_regression_test" ||
        control === "missing_seeded_defect"
      )
    ).length,
  };

  const report = {
    generatedAt: stamp,
    issueCount: mappings.length,
    summary,
    mappings,
  };

  writeFileSync(
    join(outputRoot, "historical-issue-regression-map.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(outputRoot, "historical-issue-regression-map.md"),
    buildMarkdown(report),
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: stamp,
        issueCount: report.issueCount,
        summary,
        outputs: {
          json: "artifacts/assurance/historical-issue-regression-map.json",
          md: "artifacts/assurance/historical-issue-regression-map.md",
        },
      },
      null,
      2,
    )}\n`,
  );
}

main();
