#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const GENERATED_EXTENSIONS = [".js", ".js.map", ".d.ts"];
const ABSOLUTE_PATH_PATTERNS = [
  "/Users/holden/Project/automatic_agent/automatic_agent_platform|/Users/holden/",
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
    if (content.includes("/Users/holden/Project/automatic_agent/automatic_agent_platform")
      || content.includes("/Users/holden/")) {
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
    const result = spawnSync(
      "rg",
      ["-l", ABSOLUTE_PATH_PATTERNS[0], root, "-g", "!**/*.map"],
      { encoding: "utf8" },
    );
    if (result.error || result.status === 1) {
      continue;
    }
    if (result.status !== 0) {
      throw result.error ?? new Error(result.stderr || `rg failed for ${root}`);
    }
    for (const line of result.stdout.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trackedFiles.has(trimmed)) {
        findings.push(`absolute-workspace-path: ${trimmed}`);
      }
    }
  }
}

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "--", ...roots], { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || "git ls-files failed while auditing test portability");
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
