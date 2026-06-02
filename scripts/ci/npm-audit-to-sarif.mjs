#!/usr/bin/env node
import { readFileSync, statSync, writeFileSync } from "node:fs";

const MAX_AUDIT_REPORT_BYTES = 10 * 1024 * 1024;

const [, , inputPath, outputPath] = process.argv;

if (inputPath == null || outputPath == null) {
  console.error("usage: npm-audit-to-sarif <input.json> <output.sarif>");
  process.exit(1);
}

function readAuditReport(path) {
  const stats = statSync(path);
  if (!stats.isFile()) {
    throw new Error(`npm_audit.input_not_file:${path}`);
  }
  if (!Number.isFinite(stats.size) || stats.size <= 0 || stats.size > MAX_AUDIT_REPORT_BYTES) {
    throw new Error(`npm_audit.input_size_out_of_range:${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `npm_audit.invalid_json:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const report = readAuditReport(inputPath);
const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
const severityLevel = {
  critical: "error",
  high: "error",
  moderate: "warning",
  low: "note",
  info: "note",
};

function describeViaEntry(entry) {
  if (typeof entry === "string") {
    return entry;
  }
  if (typeof entry !== "object" || entry == null) {
    return "unknown advisory";
  }
  const title = typeof entry.title === "string" && entry.title.trim().length > 0
    ? entry.title.trim()
    : "untitled advisory";
  const url = typeof entry.url === "string" && entry.url.trim().length > 0
    ? entry.url.trim()
    : "no advisory URL";
  return `${title} (${url})`;
}

function collectAdvisories(vulnerability) {
  return Array.isArray(vulnerability.via)
    ? vulnerability.via.filter((entry) => typeof entry === "object" && entry != null)
    : [];
}

function extractGhsaIds(advisories) {
  const ids = new Set();
  for (const advisory of advisories) {
    const url = typeof advisory.url === "string" ? advisory.url : "";
    const source = typeof advisory.source === "string" ? advisory.source : "";
    for (const candidate of [url, source]) {
      const match = candidate.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i);
      if (match != null) {
        ids.add(match[0].toUpperCase());
      }
    }
  }
  return [...ids];
}

function extractCweIds(advisories) {
  const ids = new Set();
  for (const advisory of advisories) {
    const cweValues = Array.isArray(advisory.cwe) ? advisory.cwe : [];
    for (const value of cweValues) {
      if (typeof value === "string" && /^CWE-\d+$/i.test(value)) {
        ids.add(value.toUpperCase());
      }
    }
  }
  return [...ids];
}

function buildTaxonomies(advisories) {
  const cweIds = extractCweIds(advisories);
  if (cweIds.length === 0) {
    return [];
  }
  return [
    {
      name: "CWE",
      organization: "MITRE",
      shortDescription: {
        text: "Common Weakness Enumeration",
      },
      taxa: cweIds.map((id) => ({
        id,
        name: id,
      })),
    },
  ];
}

const sarif = {
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  version: "2.1.0",
  runs: [
    {
      tool: {
        driver: {
          name: "npm-audit",
          informationUri: "https://docs.npmjs.com/cli/v10/commands/npm-audit",
          taxonomies: buildTaxonomies(
            vulnerabilities.flatMap(([, vulnerability]) => collectAdvisories(vulnerability)),
          ),
          rules: vulnerabilities.map(([name, vulnerability]) => ({
            id: `npm-audit/${name}`,
            shortDescription: {
              text: `${name} ${vulnerability.severity} vulnerability`,
            },
            fullDescription: {
              text: (Array.isArray(vulnerability.via) ? vulnerability.via : [])
                .map((entry) => describeViaEntry(entry))
                .join("; "),
            },
            properties: {
              severity: vulnerability.severity,
              fixAvailable: vulnerability.fixAvailable !== false,
              tags: [
                ...extractGhsaIds(collectAdvisories(vulnerability)),
                ...extractCweIds(collectAdvisories(vulnerability)),
              ],
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
        partialFingerprints: {
          package: name,
        },
        taxa: extractCweIds(collectAdvisories(vulnerability)).map((id) => ({
          id,
          toolComponent: {
            name: "npm-audit",
            index: 0,
            guid: "cwe",
          },
        })),
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
