#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  loadYamlObject,
  toObjectArray,
} from "./division-coverage-lib.mjs";

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

function normalizeIsoOrNull(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function isApprovedActiveClaim(entry, now) {
  if (entry.status !== "approved") {
    return false;
  }
  const expiresAt = normalizeIsoOrNull(entry.expiresAt);
  return expiresAt == null || Date.parse(expiresAt) >= now.getTime();
}

export function buildBenchmarkEvidenceReconciliation(platformRoot = process.cwd(), now = new Date()) {
  const configRoot = join(platformRoot, "config", "division-coverage");
  const readinessConfig = loadYamlObject(join(configRoot, "family-readiness.yaml"));
  const benchmarkConfig = loadYamlObject(join(configRoot, "benchmark-map.yaml"));
  const evidenceConfig = loadYamlObject(join(configRoot, "minimum-leading-evidence.yaml"));
  const calibrationConfig = loadYamlObject(join(configRoot, "benchmark-calibration.yaml"));
  const expansionConfig = loadYamlObject(join(configRoot, "family-expansion.yaml"));
  const claimsConfig = loadYamlObject(join(configRoot, "claims", "records.yaml"));

  const benchmarkByFamily = new Map(toObjectArray(benchmarkConfig.families).map((entry) => [entry.familyId, entry]));
  const evidenceByFamily = new Map(toObjectArray(evidenceConfig.families).map((entry) => [entry.familyId, entry]));
  const calibrationByFamily = new Map(toObjectArray(calibrationConfig.families).map((entry) => [entry.familyId, entry]));
  const expansionByFamily = new Map(toObjectArray(expansionConfig.families).map((entry) => [entry.familyId, entry]));
  const approvedClaimCountByFamily = new Map();
  for (const claim of toObjectArray(claimsConfig.claims)) {
    const familyId = typeof claim.familyId === "string" ? claim.familyId : null;
    if (familyId == null || !isApprovedActiveClaim(claim, now)) {
      continue;
    }
    approvedClaimCountByFamily.set(familyId, (approvedClaimCountByFamily.get(familyId) ?? 0) + 1);
  }

  const rows = toObjectArray(readinessConfig.families).map((family) => {
    const familyId = typeof family.familyId === "string" ? family.familyId : "unknown-family";
    const benchmark = benchmarkByFamily.get(familyId) ?? {};
    const evidence = evidenceByFamily.get(familyId) ?? {};
    const calibration = calibrationByFamily.get(familyId) ?? {};
    const expansion = expansionByFamily.get(familyId) ?? {};
    return {
      familyId,
      targetClaimLevel: typeof family.targetClaimLevel === "string" ? family.targetClaimLevel : "designed",
      benchmarkCount: toObjectArray(benchmark.benchmarks).length,
      internalMetricCount: toObjectArray(benchmark.internalMappings).length,
      mvpThresholdCount: toObjectArray(evidence.mvpThresholds).length,
      leadershipThresholdCount: toObjectArray(evidence.leadershipThresholds).length,
      hasCalibration: Object.keys(calibration).length > 0,
      hasExpansionPlan: Object.keys(expansion).length > 0,
      approvedActiveClaimCount: approvedClaimCountByFamily.get(familyId) ?? 0,
    };
  });

  const findings = rows.flatMap((row) => {
    const issues = [];
    if (row.benchmarkCount === 0) issues.push(`${row.familyId}:missing_external_benchmark`);
    if (row.internalMetricCount === 0) issues.push(`${row.familyId}:missing_internal_metric`);
    if (row.mvpThresholdCount === 0) issues.push(`${row.familyId}:missing_mvp_threshold`);
    if (row.leadershipThresholdCount === 0) issues.push(`${row.familyId}:missing_leadership_threshold`);
    if (!row.hasCalibration) issues.push(`${row.familyId}:missing_calibration_contract`);
    if (!row.hasExpansionPlan) issues.push(`${row.familyId}:missing_expansion_plan`);
    if (row.targetClaimLevel !== "designed" && row.approvedActiveClaimCount === 0) {
      issues.push(`${row.familyId}:missing_active_claim_support`);
    }
    return issues;
  });

  return {
    generatedAt: now.toISOString(),
    familyCount: rows.length,
    findingCount: findings.length,
    status: findings.length === 0 ? "pass" : "fail",
    rows,
    findings,
  };
}

function buildMarkdown(report) {
  const lines = [
    "# Benchmark Evidence Reconciliation",
    "",
    `- GeneratedAt: ${report.generatedAt}`,
    `- Families: ${report.familyCount}`,
    `- Findings: ${report.findingCount}`,
    `- Status: ${report.status}`,
    "",
    "| Family | Benchmarks | Metrics | MVP thresholds | Leadership thresholds | Calibration | Expansion | Approved active claims |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- | ---: |",
  ];
  for (const row of report.rows) {
    lines.push(`| ${row.familyId} | ${row.benchmarkCount} | ${row.internalMetricCount} | ${row.mvpThresholdCount} | ${row.leadershipThresholdCount} | ${row.hasCalibration ? "yes" : "no"} | ${row.hasExpansionPlan ? "yes" : "no"} | ${row.approvedActiveClaimCount} |`);
  }
  if (report.findings.length > 0) {
    lines.push("", "## Findings", "");
    for (const finding of report.findings) {
      lines.push(`- ${finding}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const report = buildBenchmarkEvidenceReconciliation(process.cwd());
  const outputRoot = join(process.cwd(), "artifacts", "leadership");
  writeJson(join(outputRoot, "benchmark-evidence-reconciliation.json"), report);
  writeMarkdown(join(outputRoot, "benchmark-evidence-reconciliation.md"), buildMarkdown(report));
  process.stdout.write(`${JSON.stringify({ status: report.status, findingCount: report.findingCount, familyCount: report.familyCount })}\n`);
  process.exit(report.findingCount === 0 ? 0 : 1);
}
