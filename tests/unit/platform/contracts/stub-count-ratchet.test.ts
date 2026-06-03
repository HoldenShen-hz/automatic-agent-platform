import assert from "node:assert/strict";
import test from "node:test";
import { globSync } from "glob";
import { readFileSync } from "fs";

/**
 * Stub count ratchet guardian - SYS-QUAL-7.1
 *
 * Verifies that stub file count (files with <= 20 non-empty lines) does not increase.
 * Stub files indicate incomplete implementation - this test prevents new stubs from being added.
 */

const MAX_STUBS = 95;
const MAX_ORG_GOVERNANCE_STUB_RATIO = 0.05;
const MAX_SCALE_ECOSYSTEM_STUB_RATIO = 0.05;

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/g, ""))
    .join("\n");
}

function getSignificantLines(content: string): string[] {
  return content.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("//")) return false;
    if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return false;
    if (trimmed === "*/") return false;
    return true;
  });
}

function isCompatibilityFacade(content: string): boolean {
  const normalized = stripComments(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  if (normalized.length === 0) {
    return false;
  }

  const statements = normalized
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  return statements.length > 0
    && statements.every((statement) => /^(export\s+\*\s+from\s+|export\s+\{[\s\S]*\}\s+from\s+|export\s+type\s+\{[\s\S]*\}\s+from\s+|import\s+type\s+\{[\s\S]*\}\s+from\s+)/.test(statement));
}

function isDeclarationModule(file: string, content: string): boolean {
  if (
    file.includes("/contracts/constants/")
    || file.includes("/contracts/types/")
    || file.endsWith("-port.ts")
  ) {
    return true;
  }

  const normalized = stripComments(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return false;
  }

  return normalized.every((line) => /^(import\s+type\b|export\s+(interface|type|enum|const)\b|readonly\b|[A-Za-z0-9_]+:\s|[|}{),;]|\);?$)/.test(line));
}

function isStableCliBootstrap(file: string, content: string): boolean {
  return file.startsWith("src/sdk/cli/")
    && content.includes("createStableCli(");
}

function isSchemaFragmentModule(file: string): boolean {
  return /phase_1a_schema_(ddl|sql)_part-|authoritative-schema\.ts$|outbox-schema\.ts$/.test(file);
}

test("[SYS-QUAL-7.1] stub file count does not increase", () => {
  const allFiles = globSync("src/**/*.ts", {
    ignore: ["**/*.d.ts", "**/node_modules/**", "**/index.ts"],
  });

  let stubCount = 0;
  const stubFiles: string[] = [];
  let orgGovernanceFileCount = 0;
  let orgGovernanceStubCount = 0;
  let scaleEcosystemFileCount = 0;
  let scaleEcosystemStubCount = 0;

  for (const file of allFiles) {
    const content = readFileSync(file, "utf8");
    const lines = getSignificantLines(content);

    if (file.startsWith("src/org-governance/")) {
      orgGovernanceFileCount++;
    }
    if (file.startsWith("src/scale-ecosystem/")) {
      scaleEcosystemFileCount++;
    }

    if (isCompatibilityFacade(content)) {
      continue;
    }
    if (isDeclarationModule(file, content)) {
      continue;
    }
    if (isStableCliBootstrap(file, content)) {
      continue;
    }
    if (isSchemaFragmentModule(file)) {
      continue;
    }

    if (lines.length <= 20) {
      stubCount++;
      stubFiles.push(file);
      if (file.startsWith("src/org-governance/")) {
        orgGovernanceStubCount++;
      }
      if (file.startsWith("src/scale-ecosystem/")) {
        scaleEcosystemStubCount++;
      }
    }
  }

  assert.ok(
    stubCount <= MAX_STUBS,
    `Stub count ${stubCount} exceeds ratchet ${MAX_STUBS} — new stubs not allowed. ` +
    `Files with <= 20 lines: ${stubCount}. ` +
    `First 10 stub files: ${stubFiles.slice(0, 10).join(", ")}`,
  );

  const orgGovernanceRatio = orgGovernanceStubCount / Math.max(orgGovernanceFileCount, 1);
  const scaleEcosystemRatio = scaleEcosystemStubCount / Math.max(scaleEcosystemFileCount, 1);

  assert.ok(
    orgGovernanceRatio <= MAX_ORG_GOVERNANCE_STUB_RATIO,
    `org-governance stub ratio ${(orgGovernanceRatio * 100).toFixed(1)}% exceeds ${(MAX_ORG_GOVERNANCE_STUB_RATIO * 100).toFixed(1)}%`,
  );
  assert.ok(
    scaleEcosystemRatio <= MAX_SCALE_ECOSYSTEM_STUB_RATIO,
    `scale-ecosystem stub ratio ${(scaleEcosystemRatio * 100).toFixed(1)}% exceeds ${(MAX_SCALE_ECOSYSTEM_STUB_RATIO * 100).toFixed(1)}%`,
  );
});
