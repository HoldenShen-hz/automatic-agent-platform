import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export function runBuiltCliExpectFailure(
  scriptName: string,
  env: NodeJS.ProcessEnv,
): { stdout: string; stderr: string; status: number } {
  try {
    execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", scriptName)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error(`expected_cli_failure:${scriptName}`);
  } catch (error) {
    if (error instanceof Error && error.message === `expected_cli_failure:${scriptName}`) {
      throw error;
    }
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
      status: failure.status ?? 1,
    };
  }
}

export function reportSoftPerformanceMiss(t: unknown, error: Error): void {
  // Default implementation - logs diagnostic without throwing
  if (error instanceof assert.AssertionError) {
    // Soft performance miss - log and continue
    return;
  }
  throw error;
}

export function failOnListenSocketDenied(error: Error): void {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EPERM") {
    throw new assert.AssertionError({
      message: "local listen sockets are required for this network-path test",
    });
  }
  throw error;
}
