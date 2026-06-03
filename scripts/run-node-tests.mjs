import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDefaultTestConcurrency } from "./lib/test-concurrency.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const DEFAULT_TEST_AUDIT_INTEGRITY_HMAC_KEY = "testing-audit-integrity-key-012345";

export const DEFAULT_NODE_TEST_CONCURRENCY = resolveDefaultTestConcurrency();

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
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

/**
 * @param {readonly string[]} testPaths
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
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
  const env = {
    ...process.env,
    AA_AUDIT_INTEGRITY_HMAC_KEY:
      process.env.AA_AUDIT_INTEGRITY_HMAC_KEY ?? DEFAULT_TEST_AUDIT_INTEGRITY_HMAC_KEY,
  };

  const exitCode = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
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
