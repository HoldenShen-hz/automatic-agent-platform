#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const GENERATED_EXTENSIONS = [".js", ".js.map", ".d.ts"];
const ABSOLUTE_PATH_PATTERNS = [
  /\/Users\/[^/\n]+\/[^\n]*/u,
  /\/home\/[^/\n]+\/[^\n]*/u,
  /[A-Za-z]:\\Users\\[^\\\n]+\\[^\n]*/u,
];
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".json", ".jsonl", ".md", ".yaml", ".yml", ".toml"]);
const roots = ["tests", "helpers"];
const findings = [];
const trackedFiles = new Set(listTrackedFiles());

for (const root of roots) {
  if (!existsSync(root)) {
    continue;
  }
  walk(root);
}
findAbsoluteWorkspacePaths();

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!trackedFiles.has(fullPath)) {
      continue;
    }

    if (isGeneratedTestArtifact(fullPath)) {
      findings.push(`generated-test-artifact: ${fullPath}`);
    }

    if (!isTextFile(fullPath) || fullPath.endsWith(".jsonl")) {
      continue;
    }
    const content = readFileSync(fullPath, "utf8");
    if (ABSOLUTE_PATH_PATTERNS.some((pattern) => pattern.test(content))) {
      findings.push(`absolute-workspace-path: ${fullPath}`);
    }
  }
}

function isGeneratedTestArtifact(filePath) {
  if (!GENERATED_EXTENSIONS.some((extension) => filePath.endsWith(extension))) {
    return false;
  }
  if (filePath.endsWith(".test.js") || filePath.endsWith(".test.js.map") || filePath.endsWith(".test.d.ts")) {
    return true;
  }
  return filePath.startsWith("tests/helpers/") || filePath.startsWith("helpers/");
}

function isTextFile(filePath) {
  for (const extension of TEXT_EXTENSIONS) {
    if (filePath.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

function findAbsoluteWorkspacePaths() {
  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }
    for (const filePath of listFiles(root)) {
      if (!trackedFiles.has(filePath) || extname(filePath) === ".map" || !isTextFile(filePath)) {
        continue;
      }
      const content = readFileSync(filePath, "utf8");
      if (ABSOLUTE_PATH_PATTERNS.some((pattern) => pattern.test(content))) {
        findings.push(`absolute-workspace-path: ${filePath}`);
      }
    }
  }
}

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "--", ...roots], { encoding: "utf8" });
  if (result.error == null && result.status === 0) {
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  return roots.flatMap((root) => listFiles(root));
}

function listFiles(root) {
  if (!existsSync(root)) {
    return [];
  }
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    const stats = statSync(current);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(current)) {
        stack.push(join(current, entry));
      }
      continue;
    }
    if (stats.isFile()) {
      results.push(current);
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
}
