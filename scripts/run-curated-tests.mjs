#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { listCuratedCompiledTests } from "./curated-test-selection.mjs";

const distRoot = resolve(process.cwd(), "dist");
const distTestsRoot = join(distRoot, "tests");
const defaultConcurrency = readPositiveInteger("AA_CURATED_TEST_CONCURRENCY", 12);
const testMaxOldSpaceSizeMb = readOptionalPositiveInteger("AA_TEST_MAX_OLD_SPACE_MB", 1536);
const blockedEnvPatterns = [
  /^AA_CREDENTIALS_ENCRYPTION_KEY$/u,
  /^AA_OAUTH_/u,
  /(_SECRET|_TOKEN|_PASSWORD)$/u,
];

function readPositiveInteger(envName, fallback) {
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

function hasExecArg(args, prefix) {
  return args.some((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
}

function buildChildEnv(source) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (value == null) {
      continue;
    }
    if (blockedEnvPatterns.some((pattern) => pattern.test(key))) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

if (!existsSync(distTestsRoot)) {
  console.error("dist/tests does not exist. Run build:test first.");
  process.exit(1);
}

const selectedFiles = listCuratedCompiledTests(distRoot);

if (selectedFiles.length === 0) {
  console.error("No curated test files matched.");
  process.exit(1);
}

const nodeArgs = [...process.execArgv];
if (testMaxOldSpaceSizeMb != null && !hasExecArg(nodeArgs, "--max-old-space-size")) {
  nodeArgs.push(`--max-old-space-size=${testMaxOldSpaceSizeMb}`);
}

const child = spawn(process.execPath, [...nodeArgs, "--test", `--test-concurrency=${defaultConcurrency}`, ...selectedFiles], {
  cwd: process.cwd(),
  env: buildChildEnv(process.env),
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start curated tests: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal != null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
