import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

export const DEFAULT_NODE_TEST_CONCURRENCY = 12;

export function readNodeTestConcurrency(env = process.env) {
  const raw = env.AA_NODE_TEST_CONCURRENCY;
  if (raw == null || raw.trim().length === 0) {
    return DEFAULT_NODE_TEST_CONCURRENCY;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`AA_NODE_TEST_CONCURRENCY must be a positive integer, received: ${raw}`);
  }
  return parsed;
}

export function buildNodeTestArgs(testPaths, env = process.env) {
  const concurrency = readNodeTestConcurrency(env);
  return [
    "--import",
    "tsx",
    "--test",
    `--test-concurrency=${concurrency}`,
    ...testPaths,
  ];
}

async function main() {
  const args = buildNodeTestArgs(process.argv.slice(2));

  const exitCode = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", rejectPromise);
    child.once("close", (code, signal) => {
      if (signal != null) {
        process.kill(process.pid, signal);
        return;
      }
      resolvePromise(code ?? 1);
    });
  });

  process.exit(exitCode);
}

if (process.argv[1] != null && resolve(process.argv[1]).replaceAll("\\", "/") === scriptPath.replaceAll("\\", "/")) {
  await main();
}
