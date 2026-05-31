import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listAllTestFiles, selectFilesForLayer } from "../run-layered-tests.mjs";
import {
  buildCoverageReport,
  loadCoverageSummary,
  writeCoverageArtifacts,
  writeCoverageSummary,
} from "./coverage-lib.mjs";

const require = createRequire(import.meta.url);
const { createCoverageMap } = require("istanbul-lib-coverage");
const { mergeProcessCovs } = require("@bcoe/v8-coverage");
const v8ToIstanbul = require("v8-to-istanbul");

const COVERAGE_LAYERS = ["leaks", "unit", "invariants", "integration", "golden", "e2e", "performance"];
const COVERAGE_ROOT = path.join(process.cwd(), "coverage");
const LAYERED_COVERAGE_ROOT = path.join(COVERAGE_ROOT, "layered");
const COVERAGE_LAYER_BATCH_SIZE = {
  unit: 500,
};

function copyCoverageFiles(sourceDir, destinationDir, prefix) {
  if (!existsSync(sourceDir)) {
    return;
  }

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    copyFileSync(
      path.join(sourceDir, entry.name),
      path.join(destinationDir, `${prefix}-${entry.name}`),
    );
  }
}

function readProcessCoverage(tempDir) {
  let mergedCoverage = null;

  for (const entry of readdirSync(tempDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(tempDir, entry.name);
    const processCoverage = JSON.parse(readFileSync(filePath, "utf8"));
    mergedCoverage = mergedCoverage == null
      ? processCoverage
      : mergeProcessCovs([mergedCoverage, processCoverage]);
  }

  return mergedCoverage;
}

function resolveScriptPathFromCoverageUrl(url) {
  if (typeof url !== "string" || url.length === 0 || url.startsWith("node:")) {
    return null;
  }

  if (url.startsWith("file://")) {
    return fileURLToPath(url);
  }

  return path.isAbsolute(url) ? url : null;
}

function toCoverageSummaryMetric(metric) {
  return {
    covered: metric.covered ?? 0,
    total: metric.total ?? 0,
    skipped: metric.skipped ?? 0,
    pct: metric.pct ?? 100,
  };
}

function buildSummaryFromCoverageMap(coverageMap) {
  const summary = {
    total: Object.fromEntries(
      Object.entries(coverageMap.getCoverageSummary().data).map(([key, metric]) => [key, toCoverageSummaryMetric(metric)]),
    ),
  };

  for (const filePath of coverageMap.files()) {
    summary[filePath] = Object.fromEntries(
      Object.entries(coverageMap.fileCoverageFor(filePath).toSummary().data)
        .map(([key, metric]) => [key, toCoverageSummaryMetric(metric)]),
    );
  }

  return summary;
}

function runCoverageBatch(c8Entrypoint, layer, aggregateTempDir, options = {}) {
  const tempSuffix = options.suffix == null ? "" : `-${options.suffix}`;
  const batchTempDir = path.join(LAYERED_COVERAGE_ROOT, `${layer}${tempSuffix}-tmp`);
  const batchReportDir = path.join(LAYERED_COVERAGE_ROOT, `${layer}${tempSuffix}-report`);
  rmSync(batchTempDir, { recursive: true, force: true });
  rmSync(batchReportDir, { recursive: true, force: true });
  mkdirSync(batchTempDir, { recursive: true });
  mkdirSync(batchReportDir, { recursive: true });

  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=8192",
      c8Entrypoint,
      "--clean",
      "--temp-directory",
      batchTempDir,
      "--report-dir",
      batchReportDir,
      "--reporter",
      "json-summary",
      process.execPath,
      "--import",
      "tsx",
      "scripts/run-layered-tests.mjs",
      layer,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "inherit",
      env: {
        ...process.env,
        AA_RUNNING_TESTS: "1",
        AA_PRESERVE_DIST: "1",
        ...(options.offset == null ? {} : { AA_LAYER_FILE_OFFSET: String(options.offset) }),
        ...(options.limit == null ? {} : { AA_LAYER_FILE_LIMIT: String(options.limit) }),
      },
    },
  );

  if (result.status !== 0) {
    throw new Error(`c8 layered coverage run failed for ${layer}`);
  }

  copyCoverageFiles(batchTempDir, aggregateTempDir, options.suffix ?? "batch");
}

async function buildLayerCoverageSummaryFromRaw(layer, aggregateTempDir) {
  const reportDir = path.join(LAYERED_COVERAGE_ROOT, `${layer}-report`);
  rmSync(reportDir, { recursive: true, force: true });
  mkdirSync(reportDir, { recursive: true });

  const mergedProcessCoverage = readProcessCoverage(aggregateTempDir);
  const coverageMap = createCoverageMap({});

  for (const scriptCoverage of mergedProcessCoverage?.result ?? []) {
    const scriptPath = resolveScriptPathFromCoverageUrl(scriptCoverage.url);
    if (
      scriptPath == null
      || !scriptPath.includes(`${path.sep}dist${path.sep}src${path.sep}`)
      || !existsSync(scriptPath)
    ) {
      continue;
    }

    const converter = v8ToIstanbul(scriptPath);
    await converter.load();
    converter.applyCoverage(scriptCoverage.functions);
    coverageMap.merge(converter.toIstanbul());
  }

  const summary = buildSummaryFromCoverageMap(coverageMap);
  writeFileSync(path.join(reportDir, "coverage-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function runCoverageForLayer(c8Entrypoint, layer, allTestFiles, aggregateTempDir) {
  const layerFiles = selectFilesForLayer(allTestFiles, layer);
  const batchSize = COVERAGE_LAYER_BATCH_SIZE[layer] ?? layerFiles.length;

  const batchCount = Math.ceil(layerFiles.length / batchSize);
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const offset = batchIndex * batchSize;
    const limit = Math.min(batchSize, layerFiles.length - offset);
    if (batchCount > 1) {
      console.log(
        `[coverage] ${layer}: batch ${batchIndex + 1}/${batchCount} (${offset + 1}-${offset + limit} of ${layerFiles.length})`,
      );
    }
    runCoverageBatch(c8Entrypoint, layer, aggregateTempDir, {
      offset,
      limit,
      suffix: `batch-${batchIndex + 1}`,
    });
  }
}

async function generateCoverageSummaryFromCurrentRun() {
  const c8Entrypoint = fileURLToPath(new URL("../../node_modules/c8/bin/c8.js", import.meta.url));
  mkdirSync(LAYERED_COVERAGE_ROOT, { recursive: true });
  const allTestFiles = listAllTestFiles();
  const mergedRawTempDir = path.join(LAYERED_COVERAGE_ROOT, "merged-tmp");
  rmSync(mergedRawTempDir, { recursive: true, force: true });
  mkdirSync(mergedRawTempDir, { recursive: true });

  for (const layer of COVERAGE_LAYERS) {
    runCoverageForLayer(c8Entrypoint, layer, allTestFiles, mergedRawTempDir);
  }

  writeCoverageSummary(await buildLayerCoverageSummaryFromRaw("merged", mergedRawTempDir));
}

await generateCoverageSummaryFromCurrentRun();

const report = buildCoverageReport(loadCoverageSummary());
writeCoverageArtifacts(report);

console.log("Coverage report generated.");
console.log(`Global lines: ${report.global.lines.pct.toFixed(1)}%`);
console.log(`Lowest directory: ${report.directories[0]?.directory ?? "n/a"} (${report.directories[0]?.metrics.lines.pct.toFixed(1) ?? "n/a"}%)`);
