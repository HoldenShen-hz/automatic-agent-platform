import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const DEFAULT_SCAN_ROOTS = [
  "docs_zh/reference",
  "docs_zh/releases",
  "docs_zh/adr",
  "docs_zh/architecture",
  "docs_zh/contracts",
  "docs_zh/reviews",
  "docs_zh/quality",
  "docs_en",
  "README.md",
  "AGENTS.md",
  "MEMORY.md",
  "CONTRIBUTING.md",
];

const PROMISE_PATTERNS = [
  /必须|应当|应该|验收|可发布|已完成|行业领先/u,
  /\bMUST\b|\bSHOULD\b|\brequired\b|\bshall\b|\bAcceptance\b|\bDoD\b|\bdone\b|\bfinal\b|\brelease-ready\b|\bproduction-ready\b|\bindustry-leading\b/i,
];

const TOKEN_PATTERNS = {
  release_claim: /release-ready|production-ready|industry-leading|可发布|行业领先/i,
  completion_claim: /\bdone\b|\bfinal\b|已完成|已闭环/i,
  acceptance_criteria: /Acceptance|DoD|验收/i,
  requirement: /必须|应当|应该|\bMUST\b|\bSHOULD\b|\brequired\b|\bshall\b/i,
};

const ARTIFACT_HINTS = [
  { pattern: /pilot/i, artifact: "pilot report" },
  { pattern: /eval/i, artifact: "eval suite" },
  { pattern: /redteam/i, artifact: "redteam result" },
  { pattern: /roi/i, artifact: "ROI baseline" },
  { pattern: /\bCI\b|gate|release gate/i, artifact: "CI gate" },
  { pattern: /\bAPI\b|endpoint/i, artifact: "route/OpenAPI/test" },
  { pattern: /metric/i, artifact: "emitter/exporter/alert" },
  { pattern: /event/i, artifact: "schema/producer/consumer" },
  { pattern: /\bUI\b/i, artifact: "ui route/runtime/test" },
  { pattern: /runbook/i, artifact: "runbook" },
  { pattern: /evidence/i, artifact: "evidence bundle" },
];

function walkMarkdown(rootPath) {
  const results = [];
  const visit = (targetPath) => {
    if (!existsSync(targetPath)) {
      return;
    }
    const stats = statSync(targetPath);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(targetPath).sort()) {
        visit(join(targetPath, entry));
      }
      return;
    }
    if (stats.isFile() && [".md", ".mdx"].includes(extname(targetPath).toLowerCase())) {
      results.push(targetPath);
    }
  };
  visit(rootPath);
  return results;
}

function collectSourceFiles(repoRoot, scanRoots) {
  const files = [];
  for (const root of scanRoots) {
    const absoluteRoot = resolve(repoRoot, root);
    if (!existsSync(absoluteRoot)) {
      continue;
    }
    const stats = statSync(absoluteRoot);
    if (stats.isDirectory()) {
      files.push(...walkMarkdown(absoluteRoot));
    } else if (stats.isFile()) {
      files.push(absoluteRoot);
    }
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function inferPromiseType(text) {
  for (const [type, pattern] of Object.entries(TOKEN_PATTERNS)) {
    if (pattern.test(text)) {
      return type;
    }
  }
  return "requirement";
}

function inferExpectedArtifacts(text) {
  const artifacts = ARTIFACT_HINTS.filter((item) => item.pattern.test(text)).map((item) => item.artifact);
  return [...new Set(artifacts)];
}

function buildPromiseRecord(relativePath, lineNumber, lineText, sequence) {
  const promiseText = lineText.trim();
  return {
    promiseId: `AAS-PROMISE-${String(sequence).padStart(6, "0")}`,
    sourceFile: relativePath,
    sourceSection: `L${lineNumber}`,
    promiseText,
    promiseType: inferPromiseType(promiseText),
    expectedArtifacts: inferExpectedArtifacts(promiseText),
    actualArtifacts: [],
    status: "unverified",
    generatedIssueId: null,
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(path, values) {
  mkdirSync(dirname(path), { recursive: true });
  const payload = values.map((value) => JSON.stringify(value)).join("\n");
  writeFileSync(path, payload.length > 0 ? `${payload}\n` : "", "utf8");
}

function writeMarkdown(path, lines) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

export function buildHistoricalPromiseArtifacts(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const scanRoots = options.scanRoots ?? DEFAULT_SCAN_ROOTS;
  const outputDir = resolve(repoRoot, options.outputDir ?? "artifacts/assurance");
  const sourceFiles = collectSourceFiles(repoRoot, scanRoots);

  const promises = [];
  const files = [];
  let sequence = 1;

  for (const absolutePath of sourceFiles) {
    const relativePath = relative(repoRoot, absolutePath).replaceAll("\\", "/");
    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
    let matchedRows = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (PROMISE_PATTERNS.some((pattern) => pattern.test(line))) {
        promises.push(buildPromiseRecord(relativePath, index + 1, line, sequence));
        matchedRows += 1;
        sequence += 1;
      }
    }
    files.push({
      sourceFile: relativePath,
      scanned: true,
      matchedRows,
    });
  }

  const releaseClaimCount = promises.filter((entry) => entry.promiseType === "release_claim").length;
  const strongClaimWithoutArtifacts = promises.filter(
    (entry) => entry.promiseType === "release_claim" && entry.expectedArtifacts.length === 0,
  );

  const jsonlPath = join(outputDir, "historical-promises.jsonl");
  const driftJsonPath = join(outputDir, "historical-promise-drift-report.json");
  const driftMdPath = join(outputDir, "historical-promise-drift-report.md");

  const driftReport = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scannedRoots: scanRoots,
    scannedFiles: files.length,
    totalPromises: promises.length,
    releaseClaimCount,
    strongClaimWithoutArtifacts: strongClaimWithoutArtifacts.length,
    files,
  };

  writeJsonl(jsonlPath, promises);
  writeJson(driftJsonPath, driftReport);
  writeMarkdown(driftMdPath, [
    "# Historical Promise Drift Report",
    "",
    `- generatedAt: ${driftReport.generatedAt}`,
    `- scannedFiles: ${driftReport.scannedFiles}`,
    `- totalPromises: ${driftReport.totalPromises}`,
    `- releaseClaimCount: ${driftReport.releaseClaimCount}`,
    `- releaseClaimsWithoutArtifactHints: ${driftReport.strongClaimWithoutArtifacts}`,
  ]);

  return {
    promises,
    driftReport,
    outputs: {
      jsonlPath,
      driftJsonPath,
      driftMdPath,
    },
  };
}

export function evaluateHistoricalPromiseArtifacts(result) {
  const reasons = [];
  if (result.driftReport.scannedFiles === 0) {
    reasons.push("no_sources_scanned");
  }
  if (result.promises.length === 0) {
    reasons.push("no_promises_detected");
  }
  return {
    pass: reasons.length === 0,
    reasons,
  };
}
