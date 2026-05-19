#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;

if (inputPath == null || outputPath == null) {
  console.error("usage: npm-audit-to-sarif <input.json> <output.sarif>");
  process.exit(1);
}

const report = JSON.parse(readFileSync(inputPath, "utf8"));
const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
const severityLevel = {
  critical: "error",
  high: "error",
  moderate: "warning",
  low: "note",
  info: "note",
};

const sarif = {
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [
    {
      tool: {
        driver: {
          name: "npm-audit",
          informationUri: "https://docs.npmjs.com/cli/v10/commands/npm-audit",
          rules: vulnerabilities.map(([name, vulnerability]) => ({
            id: `npm-audit/${name}`,
            shortDescription: {
              text: `${name} ${vulnerability.severity} vulnerability`,
            },
            fullDescription: {
              text: vulnerability.via
                .map((entry) => typeof entry === "string" ? entry : `${entry.title} (${entry.url ?? "no advisory URL"})`)
                .join("; "),
            },
            properties: {
              severity: vulnerability.severity,
              fixAvailable: vulnerability.fixAvailable !== false,
            },
          })),
        },
      },
      results: vulnerabilities.map(([name, vulnerability]) => ({
        ruleId: `npm-audit/${name}`,
        level: severityLevel[vulnerability.severity] ?? "warning",
        message: {
          text: `${name} vulnerable range ${vulnerability.range}; fix available=${String(vulnerability.fixAvailable !== false)}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: "package-lock.json",
              },
            },
          },
        ],
      })),
    },
  ],
};

writeFileSync(outputPath, `${JSON.stringify(sarif, null, 2)}\n`);
