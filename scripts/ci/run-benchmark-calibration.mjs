#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  loadYamlObject,
  toObjectArray,
  toStringArray,
} from "./division-coverage-lib.mjs";

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

export function buildBenchmarkCalibrationReport(platformRoot = process.cwd()) {
  const configRoot = join(platformRoot, "config", "division-coverage");
  const readinessConfig = loadYamlObject(join(configRoot, "family-readiness.yaml"));
  const benchmarkConfig = loadYamlObject(join(configRoot, "benchmark-map.yaml"));
  const calibrationConfig = loadYamlObject(join(configRoot, "benchmark-calibration.yaml"));

  const benchmarkByFamily = new Map(
    toObjectArray(benchmarkConfig.families)
      .filter((entry) => typeof entry.familyId === "string")
      .map((entry) => [entry.familyId, entry]),
  );
  const calibrationByFamily = new Map(
    toObjectArray(calibrationConfig.families)
      .filter((entry) => typeof entry.familyId === "string")
      .map((entry) => [entry.familyId, entry]),
  );

  const rows = toObjectArray(readinessConfig.families).map((family) => {
    const familyId = typeof family.familyId === "string" ? family.familyId : "unknown-family";
    const benchmark = benchmarkByFamily.get(familyId) ?? {};
    const calibration = calibrationByFamily.get(familyId) ?? {};
    return {
      familyId,
      displayName: typeof family.displayName === "string" ? family.displayName : familyId,
      owner: typeof calibration.owner === "string" ? calibration.owner : null,
      refreshCadence: typeof calibration.refreshCadence === "string" ? calibration.refreshCadence : null,
      benchmarkCount: toObjectArray(benchmark.benchmarks).length,
      internalMetricCount: toObjectArray(benchmark.internalMappings).length,
      releaseGateConsumption: toStringArray(calibration.releaseGateConsumption),
      claimReviewConsumption: toStringArray(calibration.claimReviewConsumption),
    };
  });

  const findings = rows.flatMap((row) => {
    const issues = [];
    if (row.owner == null) issues.push(`${row.familyId}:missing_owner`);
    if (row.refreshCadence == null) issues.push(`${row.familyId}:missing_refresh_cadence`);
    if (row.benchmarkCount === 0) issues.push(`${row.familyId}:missing_benchmarks`);
    if (row.internalMetricCount === 0) issues.push(`${row.familyId}:missing_internal_mappings`);
    if (row.releaseGateConsumption.length === 0) issues.push(`${row.familyId}:missing_release_gate_consumption`);
    if (row.claimReviewConsumption.length === 0) issues.push(`${row.familyId}:missing_claim_review_consumption`);
    return issues;
  });

  return {
    generatedAt: new Date().toISOString(),
    familyCount: rows.length,
    findingCount: findings.length,
    status: findings.length === 0 ? "pass" : "fail",
    rows,
    findings,
  };
}

function buildMarkdown(report) {
  const lines = [
    "# Benchmark Calibration Report",
    "",
    `- GeneratedAt: ${report.generatedAt}`,
    `- Families: ${report.familyCount}`,
    `- Findings: ${report.findingCount}`,
    `- Status: ${report.status}`,
    "",
    "| Family | Benchmarks | Internal metrics | Owner | Refresh cadence | Release gate | Claim review |",
    "| --- | ---: | ---: | --- | --- | --- | --- |",
  ];
  for (const row of report.rows) {
    lines.push(`| ${row.familyId} | ${row.benchmarkCount} | ${row.internalMetricCount} | ${row.owner ?? "missing"} | ${row.refreshCadence ?? "missing"} | ${row.releaseGateConsumption.join(", ") || "missing"} | ${row.claimReviewConsumption.join(", ") || "missing"} |`);
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
  const report = buildBenchmarkCalibrationReport(process.cwd());
  const outputRoot = join(process.cwd(), "artifacts", "leadership");
  writeJson(join(outputRoot, "benchmark-calibration-report.json"), report);
  writeMarkdown(join(outputRoot, "benchmark-calibration-report.md"), buildMarkdown(report));
  process.stdout.write(`${JSON.stringify({ status: report.status, findingCount: report.findingCount, familyCount: report.familyCount })}\n`);
  process.exit(report.findingCount === 0 ? 0 : 1);
}
