import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { listCuratedSourceTests } from "../curated-test-selection.mjs";
import { buildCoverageReport, loadCoverageSummary, writeCoverageArtifacts } from "./coverage-lib.mjs";

function listCompiledTestFiles(rootPath) {
  const pending = [rootPath];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (current == null || !existsSync(current)) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (entry.isFile() && fullPath.endsWith(".test.js")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function emitCompiledTestsForCoverage() {
  const distTestsRoot = path.join(process.cwd(), "dist", "tests");
  rmSync(distTestsRoot, { recursive: true, force: true });

  const selectedTestFiles = listCuratedSourceTests(process.cwd()).map((filePath) =>
    path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
  );
  if (selectedTestFiles.length === 0) {
    throw new Error("No curated source tests matched for coverage compilation");
  }

  const coverageTsconfigPath = path.join(process.cwd(), "tsconfig.coverage-curated.json");
  writeFileSync(
    coverageTsconfigPath,
    `${JSON.stringify(
      {
        extends: "./tsconfig.build-test.json",
        compilerOptions: {
          incremental: false,
          noEmitOnError: false,
        },
        files: selectedTestFiles,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const tscEntrypoint = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [tscEntrypoint, "-p", coverageTsconfigPath],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "inherit",
    },
  );

  const compiledTests = listCompiledTestFiles(distTestsRoot);
  if (compiledTests.length === 0) {
    throw new Error("tsconfig.build-test.json did not emit any dist/tests/**/*.test.js files");
  }

  if (result.status !== 0) {
    console.warn("coverage report: test emit reported TypeScript errors; continuing with emitted dist/tests bundle");
  }
}

function mirrorCoverageRuntimeSupport() {
  const configSource = path.join(process.cwd(), "config");
  const configTarget = path.join(process.cwd(), "dist", "config");
  if (existsSync(configSource)) {
    rmSync(configTarget, { recursive: true, force: true });
    cpSync(configSource, configTarget, { recursive: true });
  }

  const helperSource = path.join(process.cwd(), "helpers");
  const helperTarget = path.join(process.cwd(), "dist", "helpers");
  if (existsSync(helperSource)) {
    rmSync(helperTarget, { recursive: true, force: true });
    cpSync(helperSource, helperTarget, { recursive: true });
  }

  const testHelperSource = path.join(process.cwd(), "tests", "helpers");
  const testHelperTarget = path.join(process.cwd(), "dist", "tests", "helpers");
  if (existsSync(testHelperSource)) {
    rmSync(testHelperTarget, { recursive: true, force: true });
    cpSync(testHelperSource, testHelperTarget, { recursive: true });
  }
}

function generateCoverageSummaryFromCurrentRun() {
  emitCompiledTestsForCoverage();
  mirrorCoverageRuntimeSupport();

  const c8Entrypoint = path.join(process.cwd(), "node_modules", "c8", "bin", "c8.js");
  const curatedRunner = path.join(process.cwd(), "scripts", "run-curated-tests.mjs");
  const result = spawnSync(
    process.execPath,
    [
      c8Entrypoint,
      "--clean",
      "--reporter",
      "json-summary",
      "--reporter",
      "json",
      "--reporter",
      "lcovonly",
      "--reporter",
      "html",
      process.execPath,
      curatedRunner,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error("c8 curated coverage run failed");
  }
}

generateCoverageSummaryFromCurrentRun();

const report = buildCoverageReport(loadCoverageSummary());
writeCoverageArtifacts(report);

console.log("Coverage report generated.");
console.log(`Global lines: ${report.global.lines.pct.toFixed(1)}%`);
console.log(`Lowest directory: ${report.directories[0]?.directory ?? "n/a"} (${report.directories[0]?.metrics.lines.pct.toFixed(1) ?? "n/a"}%)`);
