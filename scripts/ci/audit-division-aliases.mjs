#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

const repoRoot = resolve(process.cwd());
const aliasesPath = join(repoRoot, "config", "division-coverage", "aliases.yaml");
const GOVERNANCE_SCAN_ROOTS = [
  "config/division-coverage/families",
  "config/division-coverage/scenarios",
  "config/division-coverage/claims",
  "eval/divisions",
  "redteam/divisions",
  "roi/divisions",
  "training-data-policy/divisions",
];

function parseYamlObject(path) {
  if (!existsSync(path)) {
    return {};
  }
  const parsed = parseYaml(readFileSync(path, "utf8"));
  return parsed != null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function walkFiles(rootDir) {
  const output = [];
  if (!existsSync(rootDir)) {
    return output;
  }
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile()) {
        output.push(absolute);
      }
    }
  }
  return output.sort((left, right) => left.localeCompare(right));
}

function buildReport() {
  const aliasDocument = parseYamlObject(aliasesPath);
  const aliasEntries = Array.isArray(aliasDocument.aliases) ? aliasDocument.aliases : [];
  const findings = [];

  const researchAlias = aliasEntries.find((entry) => entry?.alias === "research");
  const ambiguousCandidates = Array.isArray(researchAlias?.ambiguousCandidates)
    ? researchAlias.ambiguousCandidates.filter((entry) => typeof entry === "string")
    : [];
  if (!ambiguousCandidates.includes("academic-research") || !ambiguousCandidates.includes("industry-research")) {
    findings.push("aliases.yaml:research_missing_ambiguous_candidates");
  }

  const deprecatedAliases = aliasEntries
    .filter((entry) => entry?.mode === "deprecated_alias" && typeof entry.alias === "string")
    .map((entry) => entry.alias);

  for (const root of GOVERNANCE_SCAN_ROOTS) {
    for (const file of walkFiles(join(repoRoot, root))) {
      const relativePath = relative(repoRoot, file).replace(/\\/g, "/");
      if (relativePath === "config/division-coverage/aliases.yaml") {
        continue;
      }
      const content = readFileSync(file, "utf8");
      for (const alias of deprecatedAliases) {
        if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(content)) {
          findings.push(`${relativePath}:deprecated_alias_reference:${alias}`);
        }
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    findings,
    findingCount: findings.length,
    deprecatedAliasCount: deprecatedAliases.length,
  };
}

const report = buildReport();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.findingCount > 0) {
  process.exitCode = 1;
}
