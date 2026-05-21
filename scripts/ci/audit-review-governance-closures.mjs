#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function walk(root, predicate) {
  const output = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const path = `${current}/${entry}`;
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && predicate(path)) {
        output.push(path);
      }
    }
  };
  visit(root);
  return output;
}

function countMatches(files, pattern) {
  let count = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    count += source.match(pattern)?.length ?? 0;
  }
  return count;
}

function buildRelativeImportGraph(files) {
  const resolvedFiles = new Set(files.map((file) => resolve(file)));
  const importPattern = /from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;
  const graph = new Map(files.map((file) => [resolve(file), []]));

  const resolveImport = (sourcePath, specifier) => {
    if (!specifier.startsWith(".")) {
      return null;
    }
    const basePath = resolve(sourcePath, "..", specifier);
    const candidates = specifier.endsWith(".ts")
      ? [basePath]
      : [`${basePath}.ts`, resolve(basePath, "index.ts")];
    for (const candidate of candidates) {
      if (resolvedFiles.has(resolve(candidate))) {
        return resolve(candidate);
      }
    }
    return null;
  };

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier) {
        continue;
      }
      const target = resolveImport(file, specifier);
      if (target != null) {
        graph.get(resolve(file)).push(target);
      }
    }
  }
  return graph;
}

function findCycles(graph) {
  const seen = new Map();
  const stack = [];
  const cycles = [];

  const dfs = (node) => {
    seen.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const state = seen.get(next) ?? 0;
      if (state === 0) {
        dfs(next);
      } else if (state === 1) {
        const index = stack.indexOf(next);
        cycles.push([...stack.slice(index), next].map((entry) => relative(process.cwd(), entry)));
      }
      if (cycles.length >= 10) {
        return;
      }
    }
    stack.pop();
    seen.set(node, 2);
  };

  for (const node of graph.keys()) {
    if ((seen.get(node) ?? 0) === 0) {
      dfs(node);
    }
    if (cycles.length >= 10) {
      break;
    }
  }
  return cycles;
}

const srcFiles = walk("src", (file) => file.endsWith(".ts"));
const testFiles = walk("tests", (file) => file.endsWith(".ts"));
const helperFiles = walk("tests/helpers", (file) => file.endsWith(".ts"));
const cliFiles = walk("src/sdk/cli", (file) => file.endsWith(".ts"));

const relativeImportCycles = findCycles(buildRelativeImportGraph(srcFiles));
check(
  "source relative import graph is acyclic",
  relativeImportCycles.length === 0,
  `cycles=${relativeImportCycles.length}${relativeImportCycles.length > 0 ? ` first=${relativeImportCycles[0].join(" -> ")}` : ""}`,
);

const cliRawErrors = cliFiles.filter((file) => readFileSync(file, "utf8").includes("throw new Error("));
check(
  "CLI entrypoints use typed errors instead of raw Error",
  cliRawErrors.length === 0,
  `raw error files: ${cliRawErrors.map((file) => relative(process.cwd(), file)).join(", ") || "none"}`,
);

const datadogTransport = readFileSync("src/platform/shared/observability/transports/datadog-transport.ts", "utf8");
check(
  "Datadog transport uses an explicit HTTPS agent",
  datadogTransport.includes("DEFAULT_DATADOG_HTTPS_AGENT") &&
    datadogTransport.includes("keepAlive: true") &&
    datadogTransport.includes("agent: this.agent"),
  "Datadog outbound HTTPS requests are pinned to an explicit keep-alive Agent",
);

const helperCount = helperFiles.length;
check(
  "test helper inventory is explicit",
  helperCount === 45,
  `tests/helpers TypeScript files=${helperCount}`,
);

const mockDirectiveCount = countMatches(testFiles, /\b(?:vi|jest)\.mock\s*\(/g);
check(
  "tests do not rely on global vi.mock/jest.mock directives",
  mockDirectiveCount === 0,
  `mock directives=${mockDirectiveCount}`,
);

const unlinkSyncCount = countMatches(testFiles, /\bunlinkSync\s*\(/g);
const testCleanupSource = readFileSync("tests/helpers/test-cleanup.ts", "utf8");
check(
  "test cleanup is centralized and unlinkSync usage is bounded",
  unlinkSyncCount < 300 && testCleanupSource.includes("resetAllSingletons"),
  `unlinkSync count=${unlinkSyncCount}`,
);

const timingPrimitiveCount = countMatches(testFiles, /\b(?:setTimeout|sleep|waitFor)\s*\(/g);
check(
  "timing primitive inventory is lower than the historical 1059 count",
  timingPrimitiveCount < 500,
  `timing primitives=${timingPrimitiveCount}`,
);

const largeTestFiles = testFiles.filter((file) => readFileSync(file, "utf8").split(/\r?\n/).length > 1000);
check(
  "large test file inventory is below the historical 98-file count",
  largeTestFiles.length < 98,
  `large test files=${largeTestFiles.length}`,
);

const listenerRegistrationCount = countMatches(srcFiles, /\.(?:on|addListener)\s*\(/g);
const directEventEmitterUsages = countMatches(srcFiles, /from "node:events"|from "events"|extends EventEmitter|new EventEmitter/g);
check(
  "listener lifecycle inventory is improved and direct EventEmitter usage is eliminated",
  listenerRegistrationCount < 60 && directEventEmitterUsages === 0,
  `listener registrations=${listenerRegistrationCount}, direct EventEmitter usages=${directEventEmitterUsages}`,
);

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`review governance closure audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`review governance closure audit passed: ${checks.length}/${checks.length}`);
