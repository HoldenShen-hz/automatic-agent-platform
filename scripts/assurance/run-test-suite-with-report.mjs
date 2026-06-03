#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function readFlag(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

function main() {
  const separatorIndex = process.argv.indexOf("--");
  const commandArgs = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : [];
  if (commandArgs.length === 0) {
    throw new Error("test_suite_report.missing_command");
  }

  const suiteId = readFlag("--suite-id", "unnamed-suite");
  const reportPath = readFlag("--report");
  if (!reportPath) {
    throw new Error("test_suite_report.missing_report_path");
  }

  const repoRoot = resolve(process.cwd());
  const outputPath = resolve(repoRoot, reportPath);
  const [command, ...args] = commandArgs;
  const startedAt = new Date();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const endedAt = new Date();

  const report = {
    generatedAt: endedAt.toISOString(),
    suiteId,
    reportPath,
    command,
    args,
    cwd: repoRoot,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    exitCode: result.status ?? 1,
    ok: (result.status ?? 1) === 0,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.ok) {
    process.exitCode = report.exitCode;
  }
}

main();
