#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = normalizeMode(process.argv[2] ?? "detect-only");
const artifactPath = join(
  root,
  "artifacts/validation/architecture/architecture-boundary-scan-report.json"
);
const sarifArtifactPath = join(
  root,
  "artifacts/validation/architecture/architecture-boundary-scan-report.sarif"
);

const rules = [
  {
    id: "AB-001",
    title: "direct tool executor import outside execution or harness surfaces",
    matchers: [
      "five-plane-execution/tool-executor/",
      "five-plane-execution/tool-executor.",
    ],
    allowedPrefixes: [
      "src/platform/five-plane-execution/",
      "src/platform/five-plane-orchestration/harness/"
    ],
    severity: "high"
  },
  {
    id: "AB-002",
    title: "direct memory import outside state-evidence or harness surfaces",
    matchers: [
      "five-plane-state-evidence/memory/",
      "five-plane-state-evidence/memory.",
    ],
    allowedPrefixes: [
      "src/platform/five-plane-state-evidence/",
      "src/platform/five-plane-orchestration/harness/"
    ],
    severity: "high"
  },
  {
    id: "AB-003",
    title: "direct stable release gate import outside stability or sdk surfaces",
    matchers: [
      "stable-release-gate.js",
      "stable-release-gate.ts",
      "stable-release-gate\"",
      "stable-release-gate'",
    ],
    allowedPrefixes: [
      "src/platform/shared/stability/",
      "src/platform/stability/",
      "src/sdk/"
    ],
    severity: "critical"
  },
  {
    id: "AB-004",
    title: "direct release pipeline cli import outside sdk surfaces",
    matchers: [
      "sdk/cli/release-pipeline/",
      "sdk/cli/release-pipeline.",
    ],
    allowedPrefixes: [
      "src/sdk/"
    ],
    severity: "critical"
  }
];

const sourceFiles = listFiles("src", (file) => file.endsWith(".ts") || file.endsWith(".tsx"));
const findings = [];

for (const rule of rules) {
  for (const file of sourceFiles) {
    const rel = relative(root, file);
    if (rule.allowedPrefixes.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    if (matchesRule(content, rule)) {
      findings.push({
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        file: rel
      });
    }
  }
}

const report = {
  mode,
  checkedAt: new Date().toISOString(),
  checkedFileCount: sourceFiles.length,
  status: findings.length === 0 ? "passed" : mode === "enforce" ? "failed" : "findings_detected",
  findings,
  summary: {
    totalFindings: findings.length,
    high: findings.filter((item) => item.severity === "high").length,
    critical: findings.filter((item) => item.severity === "critical").length
  },
  rules: rules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    severity: rule.severity,
    matcher: rule.matchers.join(" | "),
    allowedPrefixes: rule.allowedPrefixes
  }))
};

mkdirSync(dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(sarifArtifactPath, `${JSON.stringify(buildSarifReport(report), null, 2)}\n`, "utf8");

if (findings.length === 0) {
  console.log(`architecture boundary scan passed: ${artifactPath}`);
  process.exit(0);
}

console.log(`architecture boundary scan ${mode}: ${artifactPath}`);
for (const finding of findings) {
  console.log(`${finding.severity} ${finding.ruleId} ${finding.file} - ${finding.title}`);
}

if (mode === "enforce") {
  process.exit(1);
}

function buildSarifReport(scanReport) {
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "architecture-boundary-scan",
            informationUri: "https://github.com/HoldenShen-hz/automatic-agent-platform",
            rules: rules.map((rule) => ({
              id: rule.id,
              shortDescription: {
                text: rule.title,
              },
              properties: {
                severity: rule.severity,
              },
            })),
          },
        },
        results: scanReport.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: finding.severity === "critical" ? "error" : "warning",
          message: {
            text: finding.title,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: finding.file,
                },
              },
            },
          ],
        })),
      },
    ],
  };
}

function normalizeMode(value) {
  if (value === "detect-only" || value === "enforce") {
    return value;
  }
  throw new Error(`unsupported architecture boundary scan mode: ${value}`);
}

function matchesRule(content, rule) {
  return rule.matchers.some((matcher) => content.includes(matcher));
}

function listFiles(relativePath, predicate = () => true) {
  const start = join(root, relativePath);
  if (!existsSync(start)) {
    return [];
  }
  const results = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (entry === "node_modules" || entry === "dist" || entry === ".git") {
          continue;
        }
        stack.push(join(current, entry));
      }
      continue;
    }
    if (stat.isFile() && predicate(current)) {
      results.push(current);
    }
  }
  return results.sort();
}
