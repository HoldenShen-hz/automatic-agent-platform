import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const COVERAGE_LAYERS = ["leaks", "unit", "invariants", "integration", "golden", "e2e", "performance"];
const COVERAGE_ROOT = path.join(repoRoot, "coverage");
const LAYERED_COVERAGE_ROOT = path.join(COVERAGE_ROOT, "layered");
const COVERAGE_LAYER_BATCH_SIZE = {
  unit: 500,
};
const BATCH_TEMP_DIRECTORY_PATTERN = /^(?<layer>[a-z]+)-batch-(?<batch>\d+)-tmp$/;
const COVERAGE_BATCH_MAX_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.AA_COVERAGE_BATCH_MAX_ATTEMPTS ?? "2", 10) || 2,
);
const COVERAGE_SECRET_ENV_PATTERNS = [
  /(^|_)TOKEN$/i,
  /(^|_)SECRET$/i,
  /(^|_)PASSWORD$/i,
  /(^|_)PASS$/i,
  /(^|_)API_KEY$/i,
  /(^|_)KEY$/i,
  /(^|_)AUTH$/i,
  /(^|_)AUTHORIZATION$/i,
  /(^|_)FILE$/i,
  /^AA_API_KEYS_JSON$/i,
];

export function assertRepoSubpath(targetPath, label) {
  const absoluteTarget = path.resolve(targetPath);
  const normalizedRoot = `${repoRoot}${repoRoot.endsWith(path.sep) ? "" : path.sep}`;
  if (absoluteTarget !== repoRoot && !absoluteTarget.startsWith(normalizedRoot)) {
    throw new Error(`${label} must stay within ${repoRoot}: ${absoluteTarget}`);
  }
  return absoluteTarget;
}

function safeRmRecursive(targetPath) {
  rmSync(assertRepoSubpath(targetPath, "coverage path"), { recursive: true, force: true });
}

export function buildCoverageChildEnv(overrides = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value == null) {
      continue;
    }
    if (COVERAGE_SECRET_ENV_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }
    env[key] = value;
  }
  return {
    ...env,
    ...overrides,
  };
}

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

function resolveScriptPathFromCoverageUrl(url) {
  if (typeof url !== "string" || url.length === 0 || url.startsWith("node:")) {
    return null;
  }

  if (url.startsWith("file://")) {
    return fileURLToPath(url);
  }

  return path.isAbsolute(url) ? url : null;
}

function isRelevantCoverageScriptPath(scriptPath) {
  return scriptPath.includes(`${path.sep}dist${path.sep}src${path.sep}`) && existsSync(scriptPath);
}

function readMergedRelevantScriptCoverages(tempDir) {
  const mergedByScriptPath = new Map();

  for (const entry of readdirSync(tempDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(tempDir, entry.name);
    const processCoverage = JSON.parse(readFileSync(filePath, "utf8"));

    for (const scriptCoverage of processCoverage.result ?? []) {
      const scriptPath = resolveScriptPathFromCoverageUrl(scriptCoverage.url);
      if (scriptPath == null || !isRelevantCoverageScriptPath(scriptPath)) {
        continue;
      }

      const existing = mergedByScriptPath.get(scriptPath);
      if (existing == null) {
        mergedByScriptPath.set(scriptPath, scriptCoverage);
        continue;
      }

      const merged = mergeProcessCovs([
        { result: [existing] },
        { result: [scriptCoverage] },
      ]).result[0];
      if (merged != null) {
        mergedByScriptPath.set(scriptPath, merged);
      }
    }
  }

  return [...mergedByScriptPath.values()];
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
  const batchLabel = `${layer}${tempSuffix}`;
  const batchTempDir = assertRepoSubpath(path.join(LAYERED_COVERAGE_ROOT, `${batchLabel}-tmp`), "batch temp dir");
  const batchReportDir = assertRepoSubpath(path.join(LAYERED_COVERAGE_ROOT, `${batchLabel}-report`), "batch report dir");
  const attemptToken = `${process.pid}-${Date.now()}`;

  for (let attempt = 1; attempt <= COVERAGE_BATCH_MAX_ATTEMPTS; attempt += 1) {
    const batchTempDirStage = assertRepoSubpath(`${batchTempDir}.stage-${attemptToken}-${attempt}`, "batch temp stage");
    const batchReportDirStage = assertRepoSubpath(`${batchReportDir}.stage-${attemptToken}-${attempt}`, "batch report stage");
    safeRmRecursive(batchTempDir);
    safeRmRecursive(batchReportDir);
    safeRmRecursive(batchTempDirStage);
    safeRmRecursive(batchReportDirStage);
    mkdirSync(batchTempDirStage, { recursive: true });
    mkdirSync(batchReportDirStage, { recursive: true });

    const result = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=8192",
        c8Entrypoint,
        "--clean",
        "--temp-directory",
        batchTempDirStage,
        "--report-dir",
        batchReportDirStage,
        "--reporter",
        "json-summary",
        process.execPath,
        "--import",
        "tsx",
        "scripts/run-layered-tests.mjs",
        layer,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "inherit",
        env: buildCoverageChildEnv({
          AA_RUNNING_TESTS: "1",
          AA_PRESERVE_DIST: "1",
          ...(options.offset == null ? {} : { AA_LAYER_FILE_OFFSET: String(options.offset) }),
          ...(options.limit == null ? {} : { AA_LAYER_FILE_LIMIT: String(options.limit) }),
        }),
      },
    );

    if (result.status === 0) {
      renameSync(batchTempDirStage, batchTempDir);
      renameSync(batchReportDirStage, batchReportDir);
      copyCoverageFiles(batchTempDir, aggregateTempDir, options.suffix ?? "batch");
      return;
    }

    safeRmRecursive(batchTempDirStage);
    safeRmRecursive(batchReportDirStage);

    if (attempt < COVERAGE_BATCH_MAX_ATTEMPTS) {
      console.warn(
        `[coverage] retrying ${batchLabel} after failed attempt ${attempt}/${COVERAGE_BATCH_MAX_ATTEMPTS}`,
      );
    }
  }

  throw new Error(`c8 layered coverage run failed for ${batchLabel}`);
}

async function buildLayerCoverageSummaryFromRaw(layer, aggregateTempDir) {
  const reportDir = path.join(LAYERED_COVERAGE_ROOT, `${layer}-report`);
  safeRmRecursive(reportDir);
  mkdirSync(reportDir, { recursive: true });

  const coverageMap = createCoverageMap({});

  for (const scriptCoverage of readMergedRelevantScriptCoverages(aggregateTempDir)) {
    const scriptPath = resolveScriptPathFromCoverageUrl(scriptCoverage.url);
    if (
      scriptPath == null
      || !isRelevantCoverageScriptPath(scriptPath)
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

function rebuildMergedRawCoverageFromExistingBatches(aggregateTempDir) {
  const batchTempDirs = readdirSync(LAYERED_COVERAGE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BATCH_TEMP_DIRECTORY_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (batchTempDirs.length === 0) {
    throw new Error("No existing layered coverage batches found to reuse.");
  }

  for (const directoryName of batchTempDirs) {
    copyCoverageFiles(path.join(LAYERED_COVERAGE_ROOT, directoryName), aggregateTempDir, directoryName);
  }
}

export async function generateCoverageSummaryFromCurrentRun() {
  const c8Entrypoint = fileURLToPath(new URL("../../node_modules/c8/bin/c8.js", import.meta.url));
  mkdirSync(LAYERED_COVERAGE_ROOT, { recursive: true });
  const mergedRawTempDir = path.join(LAYERED_COVERAGE_ROOT, "merged-tmp");
  safeRmRecursive(mergedRawTempDir);
  mkdirSync(mergedRawTempDir, { recursive: true });
  const reuseLayeredCoverage = process.env.AA_REUSE_LAYERED_COVERAGE === "1";

  if (reuseLayeredCoverage) {
    rebuildMergedRawCoverageFromExistingBatches(mergedRawTempDir);
  } else {
    const allTestFiles = listAllTestFiles();
    for (const layer of COVERAGE_LAYERS) {
      runCoverageForLayer(c8Entrypoint, layer, allTestFiles, mergedRawTempDir);
    }
  }

  writeCoverageSummary(await buildLayerCoverageSummaryFromRaw("merged", mergedRawTempDir));
}

function isEntrypoint() {
  return process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

export async function main() {
  await generateCoverageSummaryFromCurrentRun();

  const report = buildCoverageReport(loadCoverageSummary());
  writeCoverageArtifacts(report);

  console.log("Coverage report generated.");
  console.log(`Global lines: ${report.global.lines.pct.toFixed(1)}%`);
  console.log(`Lowest directory: ${report.directories[0]?.directory ?? "n/a"} (${report.directories[0]?.metrics.lines.pct.toFixed(1) ?? "n/a"}%)`);
}

if (isEntrypoint()) {
  await main();
}
