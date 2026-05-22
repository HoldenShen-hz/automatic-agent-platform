import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const workspaceRoot = process.cwd();
const testsRoot = resolve(workspaceRoot, "tests");
const defaultRegularConcurrency = readRecommendedRegularConcurrency();
const regularConcurrency = readConcurrency("AA_TEST_CONCURRENCY", defaultRegularConcurrency);
const heavyweightConcurrency = readConcurrency("AA_HEAVY_TEST_CONCURRENCY", Math.max(1, Math.min(2, regularConcurrency)));
const performanceConcurrency = readConcurrency("AA_PERF_TEST_CONCURRENCY", 1);
const leakConcurrency = readConcurrency("AA_LEAK_TEST_CONCURRENCY", 1);
const testMaxOldSpaceSizeMb = readOptionalPositiveInteger("AA_TEST_MAX_OLD_SPACE_MB", 1536);

const LAYER_DEFINITIONS = {
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

function readRecommendedRegularConcurrency() {
  return 12;
}

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

function listFilesRecursively(rootPath) {
  const results = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const current = pending.pop();
    if (current == null) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
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
    "--test-force-exit",
    `--test-concurrency=${LAYER_DEFINITIONS[layerName].concurrency}`,
    ...extraNodeArgs,
  ];
}

function runLayer(layerName, files, extraNodeArgs) {
  if (files.length === 0) {
    console.log(`[test-layer] ${layerName}: no test files matched, skipping`);
    return Promise.resolve(0);
  }

  const { concurrency } = LAYER_DEFINITIONS[layerName];
  const heapLabel = testMaxOldSpaceSizeMb == null ? "disabled" : `${testMaxOldSpaceSizeMb}MB`;
  console.log(`[test-layer] ${layerName}: ${files.length} files, concurrency=${concurrency}, max-old-space-size=${heapLabel}`);

  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [...buildNodeArgsForLayer(layerName, extraNodeArgs), ...files],
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
