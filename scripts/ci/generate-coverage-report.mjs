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

function summarizeTypeScriptDiagnostics(output) {
  const lines = output.split(/\r?\n/u);
  const diagnosticLines = lines.filter((line) => /error TS\d+:/u.test(line));
  const diagnosticFiles = new Set(
    diagnosticLines
      .map((line) => line.match(/^([^(:]+\.(?:ts|tsx))\(/u)?.[1])
      .filter((value) => value != null),
  );
  return {
    diagnosticCount: diagnosticLines.length,
    diagnosticFiles: [...diagnosticFiles].slice(0, 10),
  };
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
        include: [],
        exclude: ["dist", "node_modules"],
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
    },
  );

  const compiledTests = listCompiledTestFiles(distTestsRoot);
  if (compiledTests.length === 0) {
    throw new Error("tsconfig.build-test.json did not emit any dist/tests/**/*.test.js files");
  }

  if (result.status !== 0) {
    const diagnosticsOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const { diagnosticCount, diagnosticFiles } = summarizeTypeScriptDiagnostics(diagnosticsOutput);
    console.warn(
      `coverage report: TypeScript emit reported ${diagnosticCount} non-blocking diagnostics across ${diagnosticFiles.length} curated test files; continuing with emitted dist/tests bundle`,
    );
    for (const file of diagnosticFiles) {
      console.warn(`- ${file}`);
    }
  }
}

function mirrorCoverageRuntimeSupport() {
  const configSource = path.join(process.cwd(), "config");
  const configTarget = path.join(process.cwd(), "dist", "config");
  if (existsSync(configSource)) {
    rmSync(configTarget, { recursive: true, force: true });
    cpSync(configSource, configTarget, { recursive: true });
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
