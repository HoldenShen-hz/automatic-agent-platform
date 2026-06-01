import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = process.cwd();
const testsRoot = resolve(workspaceRoot, "tests");
const scriptPath = fileURLToPath(import.meta.url);
const DEFAULT_TEST_CONCURRENCY = 12;
const defaultRegularConcurrency = DEFAULT_TEST_CONCURRENCY;
const regularConcurrency = readConcurrency("AA_TEST_CONCURRENCY", defaultRegularConcurrency);
const heavyweightConcurrency = readConcurrency("AA_HEAVY_TEST_CONCURRENCY", DEFAULT_TEST_CONCURRENCY);
const performanceConcurrency = readConcurrency("AA_PERF_TEST_CONCURRENCY", DEFAULT_TEST_CONCURRENCY);
const leakConcurrency = readConcurrency("AA_LEAK_TEST_CONCURRENCY", DEFAULT_TEST_CONCURRENCY);
const testMaxOldSpaceSizeMb = readOptionalPositiveInteger("AA_TEST_MAX_OLD_SPACE_MB", 1536);
const DEFAULT_LAYER_FILE_SLICE = Object.freeze({
  offset: 0,
  limit: null,
});

export const LAYER_DEFINITIONS = {
  leaks: {
    prefixes: ["tests/leaks/"],
    concurrency: leakConcurrency,
  },
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
    concurrency: heavyweightConcurrency,
  },
  golden: {
    prefixes: ["tests/golden/"],
    concurrency: regularConcurrency,
  },
  e2e: {
    prefixes: ["tests/e2e/"],
    concurrency: heavyweightConcurrency,
  },
  performance: {
    prefixes: ["tests/performance/"],
    concurrency: performanceConcurrency,
  },
};

const PRESET_DEFINITIONS = {
  smoke: ["leaks", "unit", "invariants"],
  dev: ["leaks", "unit", "invariants", "golden"],
  full: ["leaks", "unit", "invariants", "integration", "golden", "e2e", "performance"],
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

function readOptionalPositiveInteger(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }
  if (raw === "0") {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer or 0, received: ${raw}`);
  }
  return parsed;
}

function readOptionalNonNegativeInteger(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${envName} must be a non-negative integer, received: ${raw}`);
  }
  return parsed;
}

function listFilesRecursively(rootPath) {
  const results = [];
  const pending = [rootPath];
  const skippedDirectories = new Set(["node_modules", ".git", "dist", "coverage", ".cache"]);

  while (pending.length > 0) {
    const current = pending.pop();
    if (current == null) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (skippedDirectories.has(entry.name)) {
          continue;
        }
        pending.push(fullPath);
        continue;
      }
      results.push(fullPath);
    }
  }

  return results;
}

function normalizeRelativePath(filePath) {
  return relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

export function readLayerFileSlice() {
  const offset = readOptionalNonNegativeInteger("AA_LAYER_FILE_OFFSET", DEFAULT_LAYER_FILE_SLICE.offset);
  const limit = readOptionalPositiveInteger("AA_LAYER_FILE_LIMIT", DEFAULT_LAYER_FILE_SLICE.limit);
  return { offset, limit };
}

function applyLayerFileSlice(files, slice) {
  const offset = slice?.offset ?? DEFAULT_LAYER_FILE_SLICE.offset;
  const limit = slice?.limit ?? DEFAULT_LAYER_FILE_SLICE.limit;
  if (offset === 0 && limit == null) {
    return files;
  }

  const end = limit == null ? undefined : offset + limit;
  return files.slice(offset, end);
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

export function listAllTestFiles() {
  return listFilesRecursively(testsRoot)
    .filter((filePath) => /\.(test|spec)\.(ts|tsx|mts)$/.test(filePath))
    .map(normalizeRelativePath)
    .sort((left, right) => left.localeCompare(right));
}

export function selectFilesForLayer(allTestFiles, layerName, slice = DEFAULT_LAYER_FILE_SLICE) {
  const { prefixes } = LAYER_DEFINITIONS[layerName];
  const selected = allTestFiles
    .filter((relativePath) => prefixes.some((prefix) => relativePath.startsWith(prefix)))
    .map((relativePath) => resolve(workspaceRoot, relativePath));

  return applyLayerFileSlice(selected, slice);
}

function hasExecArg(args, prefix) {
  return args.some((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
}

function buildNodeArgsForLayer(layerName, extraNodeArgs) {
  const nodeArgs = [...process.execArgv];

  if (layerName === "leaks" && !hasExecArg(nodeArgs, "--expose-gc")) {
    nodeArgs.push("--expose-gc");
  }
  if (testMaxOldSpaceSizeMb != null && !hasExecArg(nodeArgs, "--max-old-space-size")) {
    nodeArgs.push(`--max-old-space-size=${testMaxOldSpaceSizeMb}`);
  }

  return [
    ...nodeArgs,
    "--import",
    "tsx",
    "--test",
    `--test-concurrency=${LAYER_DEFINITIONS[layerName].concurrency}`,
    ...extraNodeArgs,
  ];
}

function buildChildEnv() {
  const blockedEnvPatterns = [
    /(^|_)TOKEN$/i,
    /(^|_)SECRET$/i,
    /(^|_)PASSWORD$/i,
    /(^|_)API_KEY$/i,
    /(^|_)KEY$/i,
    /^AA_API_KEYS_JSON$/i,
  ];
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (blockedEnvPatterns.some((pattern) => pattern.test(key))) {
      delete env[key];
    }
  }
  return env;
}

function formatLayerSliceLabel(slice) {
  if ((slice?.offset ?? 0) === 0 && (slice?.limit ?? null) == null) {
    return "";
  }

  const limitLabel = slice?.limit == null ? "all" : String(slice.limit);
  return `, slice-offset=${slice?.offset ?? 0}, slice-limit=${limitLabel}`;
}

function runLayer(layerName, files, extraNodeArgs, slice = DEFAULT_LAYER_FILE_SLICE) {
  if (files.length === 0) {
    console.log(`[test-layer] ${layerName}: no test files matched, skipping`);
    return Promise.resolve(0);
  }

  const { concurrency } = LAYER_DEFINITIONS[layerName];
  const heapLabel = testMaxOldSpaceSizeMb == null ? "disabled" : `${testMaxOldSpaceSizeMb}MB`;
  console.log(
    `[test-layer] ${layerName}: ${files.length} files, concurrency=${concurrency}, max-old-space-size=${heapLabel}${formatLayerSliceLabel(slice)}`,
  );

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [...buildNodeArgsForLayer(layerName, extraNodeArgs), ...files],
      {
        cwd: process.cwd(),
        env: buildChildEnv(),
        stdio: "inherit",
      },
    );

    child.once("error", (error) => {
      rejectPromise(error);
    });

    child.once("close", (code, signal) => {
      if (signal != null) {
        process.kill(process.pid, signal);
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

function isEntrypoint() {
  const entryPath = process.argv[1];
  if (entryPath == null) {
    return false;
  }
  return resolve(entryPath) === scriptPath;
}

async function main() {
  if (!existsSync(testsRoot)) {
    console.error("tests directory does not exist.");
    process.exit(1);
  }

  const { layers: requestedLayers, extraNodeArgs } = resolveArguments(process.argv.slice(2));
  const allTestFiles = listAllTestFiles();
  const layerFileSlice = readLayerFileSlice();

  for (const layerName of requestedLayers) {
    const files = selectFilesForLayer(allTestFiles, layerName, layerFileSlice);
    const exitCode = await runLayer(layerName, files, extraNodeArgs, layerFileSlice);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

if (isEntrypoint()) {
  await main();
}
