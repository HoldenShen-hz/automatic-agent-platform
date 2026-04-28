import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const workspaceRoot = process.cwd();
const testsRoot = resolve(workspaceRoot, "tests");
const regularConcurrency = readConcurrency("AA_TEST_CONCURRENCY", 12);
const performanceConcurrency = readConcurrency("AA_PERF_TEST_CONCURRENCY", 1);

const LAYER_DEFINITIONS = {
  unit: {
    prefixes: ["tests/unit/"],
    concurrency: regularConcurrency,
  },
  invariants: {
    prefixes: ["tests/invariants/"],
    concurrency: regularConcurrency,
  },
  integration: {
    prefixes: ["tests/integration/"],
    concurrency: regularConcurrency,
  },
  golden: {
    prefixes: ["tests/golden/"],
    concurrency: regularConcurrency,
  },
  e2e: {
    prefixes: ["tests/e2e/"],
    concurrency: regularConcurrency,
  },
  performance: {
    prefixes: ["tests/performance/"],
    concurrency: performanceConcurrency,
  },
};

const PRESET_DEFINITIONS = {
  smoke: ["unit", "invariants"],
  dev: ["unit", "invariants", "golden"],
  full: ["unit", "invariants", "integration", "golden", "e2e", "performance"],
};

function readConcurrency(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer, received: ${raw}`);
  }
  return parsed;
}

function listFilesRecursively(rootPath) {
  const results = [];
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function normalizeRelativePath(filePath) {
  return relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function resolveArguments(args) {
  const requested = [];
  const extraNodeArgs = [];

  for (const arg of args) {
    if (arg.startsWith("--")) {
      extraNodeArgs.push(arg);
      continue;
    }
    requested.push(...arg.split(",").map((item) => item.trim()).filter(Boolean));
  }

  const layerTokens = requested.length > 0
    ? requested
    : ["full"];

  const ordered = [];
  for (const token of layerTokens) {
    const layers = PRESET_DEFINITIONS[token] ?? [token];
    for (const layer of layers) {
      if (!(layer in LAYER_DEFINITIONS)) {
        const valid = [
          ...Object.keys(PRESET_DEFINITIONS),
          ...Object.keys(LAYER_DEFINITIONS),
        ].join(", ");
        throw new Error(`Unknown test layer or preset "${token}". Valid values: ${valid}`);
      }
      if (!ordered.includes(layer)) {
        ordered.push(layer);
      }
    }
  }

  return { layers: ordered, extraNodeArgs };
}

function selectFilesForLayer(allTestFiles, layerName) {
  const { prefixes } = LAYER_DEFINITIONS[layerName];
  return allTestFiles
    .filter((relativePath) => prefixes.some((prefix) => relativePath.startsWith(prefix)))
    .map((relativePath) => resolve(workspaceRoot, relativePath));
}

function runLayer(layerName, files, extraNodeArgs) {
  if (files.length === 0) {
    console.log(`[test-layer] ${layerName}: no test files matched, skipping`);
    return Promise.resolve(0);
  }

  const { concurrency } = LAYER_DEFINITIONS[layerName];
  console.log(`[test-layer] ${layerName}: ${files.length} files, concurrency=${concurrency}`);

  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", `--test-concurrency=${concurrency}`, ...extraNodeArgs, ...files],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );

    child.on("exit", (code, signal) => {
      if (signal != null) {
        process.kill(process.pid, signal);
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

if (!existsSync(testsRoot)) {
  console.error("tests directory does not exist.");
  process.exit(1);
}

const { layers: requestedLayers, extraNodeArgs } = resolveArguments(process.argv.slice(2));
const allTestFiles = listFilesRecursively(testsRoot)
  .filter((filePath) => filePath.endsWith(".test.ts"))
  .map(normalizeRelativePath)
  .sort((left, right) => left.localeCompare(right));

for (const layerName of requestedLayers) {
  const files = selectFilesForLayer(allTestFiles, layerName);
  const exitCode = await runLayer(layerName, files, extraNodeArgs);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
