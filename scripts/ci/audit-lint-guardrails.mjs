#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

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

const files = walk("src", (path) => path.endsWith(".ts"));
const cycles = findCycles(buildRelativeImportGraph(files));
const rootEslintConfig = readFileSync("eslint.config.js", "utf8");
const uiEslintConfig = readFileSync("ui/eslint.config.js", "utf8");
const secretRoots = ["config", "deploy", ".github"];
const secretPatterns = [
  /gh[pousr]_[A-Za-z0-9]{16,}/,
  /sk-[A-Za-z0-9]{16,}/,
  /AIza[0-9A-Za-z\\-_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/,
];
const secretHits = [];

for (const root of secretRoots) {
  for (const file of walk(root, (path) => /\.(?:ts|js|mjs|json|yaml|yml|md)$/.test(path))) {
    const source = readFileSync(file, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(source))) {
      secretHits.push(file);
    }
  }
}

if (cycles.length > 0) {
  console.error(`relative import cycle detected: ${cycles[0].join(" -> ")}`);
}
if (secretHits.length > 0) {
  console.error(`secret-like literal detected: ${secretHits.join(", ")}`);
}
if (!rootEslintConfig.includes('projectService: true') || !uiEslintConfig.includes('projectService: true')) {
  console.error("eslint guardrail drift: type-aware parserOptions.projectService must stay enabled in both root and ui configs");
}
if (!rootEslintConfig.includes('scripts/**/*.mjs') || !uiEslintConfig.includes('scripts/**/*.mjs')) {
  console.error("eslint guardrail drift: scripts/**/*.mjs must stay covered in both root and ui configs");
}
if (cycles.length > 0 || secretHits.length > 0) {
  process.exit(1);
}

if (
  !rootEslintConfig.includes('projectService: true')
  || !uiEslintConfig.includes('projectService: true')
  || !rootEslintConfig.includes('scripts/**/*.mjs')
  || !uiEslintConfig.includes('scripts/**/*.mjs')
) {
  process.exit(1);
}

console.log("lint guardrail audit passed");
